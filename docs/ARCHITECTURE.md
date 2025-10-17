# Architecture

**Goal:** Executive-friendly security insights with simple, modular components.

- **backend/**: FastAPI providing `/health`, `/metrics`, `/kpis`, `/incidents`, `/controls`
- **website/**: Static site (HTML/CSS/JS) that can query the API (optional)
- **data/**: Sample CSVs for incidents and assets
- **CI**: Smoke import test for API

### Data Flow (Sample)
CSV → `backend/sample_metrics.py` → API → Static site (JS fetch) → Charts/Badges

### Security-by-Design
- Principle of least privilege
- No secrets in repo
- Synthetic data samples
