---
name: observability
description: Production observability patterns — structured logging, distributed tracing, metrics, health checks, alerting, and error budgets. Build systems you can understand when they break. Powered by Kodelyth.
origin: Kodelyth
---

# Observability — See Everything in Production

The three pillars of observability — Logs, Metrics, and Traces — plus health checks, alerting, and error budgets. Powered by Kodelyth.

## When to Use

- Setting up logging for a new service
- Adding tracing to an API or background job
- Designing a metrics + alerting strategy
- Debugging a production issue you can't reproduce locally
- Setting up health check endpoints
- Building SLOs and error budgets

---

## The Three Pillars

```
Logs    → What happened (events, errors, audit trail)
Metrics → How much / how often (counts, rates, durations)
Traces  → Why it was slow (request flow across services)
```

You need all three. Metrics tell you *something is wrong*. Traces tell you *where*. Logs tell you *why*.

---

## Structured Logging

### Never use console.log in production

```typescript
// BAD: Unstructured — impossible to query, filter, or alert on
console.log("User logged in: " + userId)
console.log("Error: " + error.message)

// GOOD: Structured — every field is queryable
logger.info("user.login", {
  userId,
  email: user.email,
  ip: request.ip,
  userAgent: request.headers["user-agent"],
  durationMs: Date.now() - startTime,
})

logger.error("payment.charge.failed", {
  userId,
  orderId,
  amount,
  currency,
  errorCode: error.code,
  errorMessage: error.message,
  stripeErrorType: error.type,
})
```

### Log Levels — Use the Right Level

```typescript
logger.debug("cache.hit", { key, ttlRemaining })   // Dev only, verbose
logger.info("order.created", { orderId, amount })  // Normal business events
logger.warn("rate.limit.approaching", { userId, count, limit }) // Potential problem
logger.error("db.query.failed", { query, error })  // Needs attention
logger.fatal("service.crashed", { reason })        // Immediate action required
```

**Rule:** INFO is for things you'd want to search in production. DEBUG is noise you turn on temporarily.

### TypeScript Logging Setup (Pino — fastest Node.js logger)

```typescript
// lib/logger.ts
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: 'api',
    version: process.env.npm_package_version,
    env: process.env.NODE_ENV,
  },
  // Pretty print in dev, JSON in production
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
})

// Child logger with request context
export function requestLogger(requestId: string, userId?: string) {
  return logger.child({ requestId, userId })
}
```

### Python Logging Setup (structlog)

```python
# lib/logging.py
import structlog
import logging

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
)

log = structlog.get_logger()

# Usage:
log.info("order.created", order_id=order_id, amount=amount, user_id=user_id)
log.error("payment.failed", error=str(e), order_id=order_id)
```

---

## Metrics

### Naming Convention

```
# Format: namespace_subsystem_name_unit
http_requests_total              # counter
http_request_duration_seconds    # histogram
db_connections_active            # gauge
cache_hits_total                 # counter
cache_misses_total               # counter
queue_depth_messages             # gauge
payment_amount_dollars           # histogram
```

### Three Metric Types

```typescript
// Counter — only goes up (requests, errors, events)
const requestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
})
requestsTotal.inc({ method: 'POST', route: '/api/orders', status_code: '201' })

// Gauge — goes up and down (active connections, queue depth, memory)
const activeConnections = new Gauge({
  name: 'db_connections_active',
  help: 'Active database connections',
})
activeConnections.set(pool.totalCount)

// Histogram — distribution of values (latency, request size)
const requestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
})
const end = requestDuration.startTimer({ method, route })
// ... handle request ...
end()  // records duration automatically
```

### The Four Golden Signals (Google SRE)

```
1. Latency    → How long do requests take? (p50, p95, p99)
2. Traffic    → How many requests/sec?
3. Errors     → What % of requests fail?
4. Saturation → How full is the system? (CPU, memory, queue depth)
```

Alert on these four before anything else.

---

## Distributed Tracing (OpenTelemetry)

```typescript
// setup/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { Resource } from '@opentelemetry/resources'
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions'

const sdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: 'payment-service',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
})

sdk.start()  // call before importing anything else

// Usage — spans are created automatically for HTTP requests
// Add custom spans for important operations:
import { trace } from '@opentelemetry/api'

const tracer = trace.getTracer('payment-service')

async function processPayment(orderId: string) {
  const span = tracer.startSpan('payment.process')
  span.setAttributes({ 'order.id': orderId })

  try {
    const result = await chargeCard(orderId)
    span.setStatus({ code: SpanStatusCode.OK })
    return result
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
    span.recordException(error)
    throw error
  } finally {
    span.end()
  }
}
```

---

## Health Check Endpoints

### Basic Structure

```typescript
// Every service must expose /health and /ready
// /health  → is the process alive? (used by load balancer)
// /ready   → is the process ready to serve traffic? (used by k8s)

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

app.get('/ready', async (req, res) => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkExternalApi(),
  ])

  const results = {
    database: checks[0].status === 'fulfilled' ? 'ok' : 'error',
    redis:    checks[1].status === 'fulfilled' ? 'ok' : 'error',
    external: checks[2].status === 'fulfilled' ? 'ok' : 'error',
  }

  const allHealthy = Object.values(results).every(v => v === 'ok')

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'degraded',
    checks: results,
    timestamp: new Date().toISOString(),
  })
})
```

---

## Alerting — What to Alert On

### Alert Design Rules

```
1. Alert on SYMPTOMS, not causes
   BAD:  Alert when CPU > 80%
   GOOD: Alert when p99 latency > 2s (the symptom users feel)

2. Every alert must be actionable
   BAD:  "High error rate" with no runbook
   GOOD: "Error rate > 1% — check Datadog dashboard, likely DB issue"

3. Alert on SLOs, not arbitrary thresholds
   BAD:  Alert when error rate > 5% (where does 5% come from?)
   GOOD: Alert when error budget burn rate > 2x (based on SLO math)

4. Avoid alert fatigue
   BAD:  50 alerts, most noise
   GOOD: 5 alerts, all critical, all actionable
```

### The Four Alerts Every Service Needs

```yaml
# 1. High error rate
alert: HighErrorRate
expr: rate(http_requests_total{status_code=~"5.."}[5m]) /
      rate(http_requests_total[5m]) > 0.01
for: 2m
annotations:
  summary: "Error rate above 1% for 2 minutes"
  runbook: "https://runbooks.example.com/high-error-rate"

# 2. High latency
alert: HighLatency
expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 2
for: 5m
annotations:
  summary: "p99 latency above 2s for 5 minutes"

# 3. Service down
alert: ServiceDown
expr: up{job="my-service"} == 0
for: 1m
annotations:
  summary: "Service has been down for 1 minute"

# 4. High queue depth
alert: QueueBacklog
expr: queue_depth_messages > 10000
for: 10m
annotations:
  summary: "Queue depth above 10k for 10 minutes — consumers may be stuck"
```

---

## Error Budgets & SLOs

```
SLO: Service Level Objective — the target you're trying to hit
SLA: Service Level Agreement — the contract with consequences
SLI: Service Level Indicator — the measurement

Example:
  SLO: 99.9% of requests succeed within 500ms over 30 days
  SLI: (successful_requests_under_500ms / total_requests) over 30 days
  Error budget: 0.1% of requests can fail = ~43 minutes of downtime/month
```

```typescript
// Error budget calculation
const sloTarget = 0.999           // 99.9%
const errorBudget = 1 - sloTarget // 0.001 = 0.1%
const minutesPerMonth = 30 * 24 * 60  // 43,200 minutes
const allowedDowntime = errorBudget * minutesPerMonth  // 43.2 minutes

// Burn rate alert: if you're consuming budget 2x faster than allowed
const burnRateThreshold = 2
// Alert if current_error_rate > burn_rate * (1 - slo_target)
```

---

## Correlation IDs — Connect Logs Across Services

```typescript
// Middleware: generate or propagate request ID
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] as string
    ?? crypto.randomUUID()

  // Set on response so clients can reference it in support tickets
  res.setHeader('x-request-id', requestId)

  // Make available for the duration of the request
  req.requestId = requestId
  req.log = logger.child({ requestId })

  next()
})

// Pass downstream to every service call
async function callPaymentService(orderId: string, requestId: string) {
  return fetch('https://payment-service/charge', {
    headers: {
      'x-request-id': requestId,  // ← propagate to child services
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ orderId }),
  })
}
```

---

> Powered by Kodelyth — you can't fix what you can't see.
