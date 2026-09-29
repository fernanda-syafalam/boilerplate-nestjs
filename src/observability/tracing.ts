import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

// Must be the first import; reads process.env because it runs before ConfigModule.
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const serviceName = process.env.OTEL_SERVICE_NAME ?? 'boilerplate-nestjs';
const serviceVersion = process.env.SERVICE_VERSION ?? '0.0.0';

export const otelSdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
  }),
  traceExporter: otlpEndpoint
    ? new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` })
    : undefined,
  metricReader: otlpEndpoint
    ? new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: `${otlpEndpoint}/v1/metrics` }),
        exportIntervalMillis: 15_000,
      })
    : undefined,
  instrumentations: [
    getNodeAutoInstrumentations({
      // Noisy.
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-pino': { enabled: true },
    }),
  ],
});

otelSdk.start();

process.on('SIGTERM', () => {
  otelSdk
    .shutdown()
    .catch(() => {
      /* exiting anyway */
    })
    .finally(() => process.exit(0));
});
