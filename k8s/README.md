# Kubernetes manifests

Reference manifests for deploying this service.

## Files

| File                | Purpose                                                |
| ------------------- | ------------------------------------------------------ |
| `deployment.yaml`   | Pod spec, probes, resources, lifecycle, anti-affinity  |
| `worker-deployment.yaml` | BullMQ worker (same image, `dist/worker.js`), no HTTP |
| `migrate-job.yaml` | One-shot Job running runtime migrations        |
| `service.yaml`      | ClusterIP service in front of the pods                 |
| `hpa.yaml`          | HorizontalPodAutoscaler on CPU                         |
| `configmap.yaml`    | Non-sensitive env (`NODE_ENV`, `LOG_LEVEL`, etc.)      |
| `secret.example.yaml` | Template for the sensitive Secret (do **not** commit real values) |

## Deploy

These are templates — adjust the namespace, image tag, and replica
count to match your cluster.

Order: configmap/secret, then the migrate job, then the deployments.

```bash
# Replace ${IMAGE} with the registry path + commit SHA (never :latest).
kubectl apply -f configmap.yaml
# Create the Secret out-of-band (External Secrets Operator, sealed
# secrets, or a CD-managed pipeline). secret.example.yaml is just the
# shape.
sed "s|REPLACE_ME_IMAGE|${IMAGE}|g" migrate-job.yaml | kubectl apply -f -
kubectl wait --for=condition=complete job/boilerplate-nestjs-migrate --timeout=300s
sed "s|REPLACE_ME_IMAGE|${IMAGE}|g" deployment.yaml | kubectl apply -f -
sed "s|REPLACE_ME_IMAGE|${IMAGE}|g" worker-deployment.yaml | kubectl apply -f -
kubectl apply -f service.yaml
kubectl apply -f hpa.yaml
```

The Job name is fixed and Job specs are immutable: delete the previous Job
(or suffix the name with the SHA) before re-applying.

The worker has no HTTP probes. Liveness is left to the operator (or KEDA
scaling on queue depth).

## Probe rationale

- **Liveness `/healthz`** is intentionally cheap and dependency-free.
  K8s kills the pod when this fails — a slow database must NOT take all
  replicas down at once.
- **Readiness `/readyz`** pings Postgres. Failure removes the pod from
  the Service endpoints (stops routing traffic) but leaves the pod
  running so it can recover.
- **Startup probe** allows up to 150 s for the process to come online
  (slow cold start, container image pull on a fresh node).

## Graceful shutdown

`terminationGracePeriodSeconds` is generous (60 s) so in-flight HTTP
requests and worker jobs have time to finish. The app handles SIGTERM via
NestJS `enableShutdownHooks()`, which closes the Postgres pool cleanly.
The API has a 5 s `preStop` (a `node` one-liner, since distroless has no
shell) so endpoints are removed before SIGTERM arrives.

## What is NOT here

- Ingress / Gateway — depends on your stack (ALB, Istio, NGINX, …)
- NetworkPolicy — depends on cluster CNI defaults
- ServiceMonitor / PodMonitor — once Prometheus / OTel is wired
- PodDisruptionBudget — once replica count is stable
- Helm chart — separate repository when the boilerplate forks become
  multiple services
