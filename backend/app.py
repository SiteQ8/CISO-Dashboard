from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sample_metrics import executive_kpis, incident_trend, controls_coverage

app = FastAPI(title="CISO Dashboard API", version="0.1.0")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/metrics")
def metrics():
    return {
        "kpis": executive_kpis(),
        "incidents": incident_trend(),
        "controls": controls_coverage(),
    }

@app.get("/kpis")
def kpis():
    return executive_kpis()

@app.get("/incidents")
def incidents():
    return incident_trend()

@app.get("/controls")
def controls():
    return controls_coverage()

@app.exception_handler(Exception)
def all_errors(request, exc):
    return JSONResponse(status_code=500, content={"error": str(exc)})
