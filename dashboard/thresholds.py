DEPT_CONFIG = {
    "police": {
        "label": "Police",
        "sub": "Law & Order",
        "metric_label": "FIRs Filed (MTD)",
        "unit": "",
        "primary_field": "fir_filed",
    },
    "health": {
        "label": "Health",
        "sub": "Hospital Occupancy",
        "metric_label": "Hospital Occupancy",
        "unit": "%",
        "primary_field": "occupancy",
    },
    "pds": {
        "label": "PDS",
        "sub": "Public Distribution",
        "metric_label": "Complaints Raised (MTD)",
        "unit": "",
        "primary_field": "complaints",
    },
}

DEPT_ORDER = ("police", "health", "pds")
STATUS_ORDER = ("green", "amber", "red")


def status_for(department, payload):
    if department == "police":
        pendency = payload["pendency_pct"]
        if payload.get("crime_spike"):
            return "red"
        return "red" if pendency > 50 else "amber" if pendency > 35 else "green"
    if department == "health":
        occupancy = payload["occupancy"]
        return "red" if occupancy >= 90 else "amber" if occupancy >= 75 else "green"
    if department == "pds":
        complaints = payload["complaints"]
        return "red" if complaints > 260 else "amber" if complaints > 120 else "green"
    raise ValueError(f"Unknown department: {department}")


def normalize_department(value):
    return value if value in DEPT_CONFIG else "police"
