# Deployment

## Docker
```bash
docker compose up --build
```
- API at http://localhost:8000
- Website at http://localhost:8080

## Local Dev
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Serve the static site:
```bash
cd website && python -m http.server 8080
```
