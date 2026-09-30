// Must load first: auto-instrumentation patches modules at import time.
import { otelSdk } from './observability/tracing';

import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Http2ServerRequest } from 'node:http2';
import fastifyCookie from '@fastify/cookie';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger, PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { registerGracefulShutdown } from './bootstrap/graceful-shutdown';
import type { AppConfigService } from './config';
import { parseEnv } from './config/env.schema';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

function requestId(req: IncomingMessage | Http2ServerRequest): string {
  const incoming = req.headers['x-request-id']?.toString();
  return incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
}

async function bootstrap(): Promise<void> {
  // parseEnv, not AppConfigService: the Fastify adapter is built before the Nest container exists.
  const trustProxyHops = parseEnv().TRUST_PROXY_HOPS;
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false,
      // Trust only the known ingress hops; blanket true lets clients spoof X-Forwarded-For.
      trustProxy: trustProxyHops === 0 ? false : trustProxyHops,
      bodyLimit: 1_048_576,
      genReqId: requestId,
    }),
    // Keeps bootstrap lines in JSON once pino takes over.
    { bufferLogs: true },
  );

  app.useLogger(app.get(Logger));

  app.enableVersioning({ type: VersioningType.URI });

  registerGracefulShutdown(app, await app.resolve(PinoLogger), () => otelSdk.shutdown());

  const config = app.get<AppConfigService>(ConfigService);
  const port = config.get('app.port', { infer: true });
  const corsOrigins = config.get('app.cors.origins', { infer: true });
  const cookieSecure = config.get('app.cookie.secure', { infer: true });
  const cookieDomain = config.get('app.cookie.domain', { infer: true });
  const cookieSameSite = config.get('app.cookie.sameSite', { infer: true });

  // Cast: two copies of the fastify types exist (root vs @nestjs/platform-fastify).
  await app.register(fastifyCookie as unknown as Parameters<typeof app.register>[0], {
    defaults: {
      secure: cookieSecure,
      sameSite: cookieSameSite,
      // Omit when unset: some browsers reject a literal Domain=undefined.
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    },
  });

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Request-Id'],
  });

  // Required for the container to be reachable from outside the pod.
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
