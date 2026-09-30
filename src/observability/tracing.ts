import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { otelEnvSchema } from '../config/env.schema';

// Must be the first import; parses process.env directly because it runs before ConfigModule.
const {
  OTEL_EXPORTER_OTLP_ENDPOINT: otlpEndpoint,
  OTEL_SERVICE_NAME: serviceName,
  SERVICE_VERSION: serviceVersion,
} = otelEnvSchema.parse(process.env);

export const otelSdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
  }),
  traceExporter: otlpEndpoint ? new OTLPTraceExporter() : undefined,
  metricReader: otlpEndpoint
    ? new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(),
        exportIntervalMillis: 15_000,
      })
    : undefined,
  instrumentations: [getNodeAutoInstrumentations()],
});

// Skipped under vitest: the SDK's resource detectors probe the network and stall app.close().
if (process.env.NODE_ENV !== 'test') {
  otelSdk.start();
}
