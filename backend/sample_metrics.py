from datetime import datetime, timedelta
from random import randint, seed

seed(42)

def executive_kpis():
    return {
        "overall_risk": 0.32,
        "open_findings": 124,
        "critical_open": 7,
        "patch_sla_compliance": 0.91,
        "mean_time_to_detect_hours": 4.8,
        "mean_time_to_respond_hours": 7.2,
        "last_updated": datetime.utcnow().isoformat() + "Z",
    }

def incident_trend(days: int = 30):
    today = datetime.utcnow().date()
    return [
        {"date": (today - timedelta(days=i)).isoformat(), "incidents": randint(0, 9)}
        for i in range(days - 1, -1, -1)
    ]

def controls_coverage():
    # Synthetic example mapping for demo
    return {
        "CIS Controls v8.1": {"Implemented": 12, "In Progress": 4, "Not Started": 2},
        "NIST CSF 2.0": {"Identify": 0.7, "Protect": 0.62, "Detect": 0.55, "Respond": 0.6, "Recover": 0.58},
    }
