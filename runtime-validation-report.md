# Runtime Validation Report

**Generated:** 2026-10-25  
**Target:** AgriSense dashboard and personalized crop recommendation flow

## Summary

| Step | Status | Exit code | Details |
|---|---|---:|---|
| Startup | PASS | 0 | Playwright started the FastAPI application and Vite frontend; both readiness URLs responded. |
| Python syntax | PASS | 0 | `py_compile` passed for the crop advisor, API, and Kafka client. |
| Frontend production build | PASS | 0 | `npm run build` completed. Vite printed its advisory about the >500 kB JavaScript bundle. |
| Crop advisor checks | PASS | 0 | Ranking order, condition-dependent scoring, explanations, caveats, and invalid input checks passed. |
| Browser E2E | PASS | 0 | 3 Playwright tests passed: dashboard rendering/region filter, crop advice and invalid-region response, saved assessment persistence/comparison. |
| Screenshot | PASS | 0 | Captured the running dashboard at `docs/images/agrisense-dashboard.png` (1280x720). |
| Full Kafka/HDFS integration | UNVERIFIED | N/A | Kafka and HDFS were not started; no project compose/deployment configuration is present in the workspace. |

## Environment and scope

- Node.js: available (v22.17.0).
- Docker: available.
- Browser: Playwright's managed Chromium install was attempted but its installer reported that Chromium is unsupported on this macOS 12 host. Playwright was then configured to use the installed Google Chrome system channel; the browser E2E suite ran successfully.
- API test helper: the system Python is 3.9 and does not have pandas installed. The E2E-only launcher supplies a pandas import stub because the tested crop recommendation route does not call pandas-based HDFS analytics. The normal backend setup should install project dependencies; pandas-dependent analytics endpoints were not validated in this environment.
- Kafka/HDFS: not exercised. The verified browser/API journey does not depend on those services; live stream delivery, HDFS persistence, and historical analytics remain unverified.

## Test evidence

- `frontend/e2e/dashboard.spec.js`
- `frontend/e2e/crop-recommendations.spec.js`
- `frontend/e2e/recommendation-history.spec.js`
- Screenshot: [`docs/images/agrisense-dashboard.png`](docs/images/agrisense-dashboard.png)

## Verdict

**overall: NEEDS_SIGNOFF** — PASS for the dashboard and crop-advisor browser/API journeys. Full-system streaming and batch-storage behavior requires a separate run with Kafka and HDFS services configured and available.
