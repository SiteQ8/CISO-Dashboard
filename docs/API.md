# API

## `GET /health`
Health probe.

## `GET /kpis`
Executive KPIs:
```json
{
  "overall_risk": 0.32,
  "open_findings": 124,
  "critical_open": 7,
  "patch_sla_compliance": 0.91,
  "mean_time_to_detect_hours": 4.8,
  "mean_time_to_respond_hours": 7.2
}
```

## `GET /incidents`
30-day incident counts by day.

## `GET /controls`
Example controls coverage for CIS and NIST CSF.
