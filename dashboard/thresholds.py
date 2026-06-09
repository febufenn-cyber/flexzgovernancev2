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


# ---------------------------------------------------------------------------
# Real KPI thresholds & targets (replaces percentile-rank status).
#
# Each department is scored on a *governance* metric — NOT necessarily the
# headline number shown on the card. For Police the headline is "FIRs Filed"
# (more filings = better citizen access, NOT a problem), so status is driven by
# FIR PENDENCY % instead: a backlog of un-disposed cases is the real red flag.
#
# Every band is ABSOLUTE and tied to a published-style target, so a district's
# RAG never depends on how its neighbours performed.
#
#   status_field : key into metric.payload that the bands score (may differ
#                  from DEPT_CONFIG[*]["primary_field"]).
#   direction    : "higher_worse" | "higher_better".
#   target       : the governance goal for that metric.
#   red / amber  : band edges, expressed in the metric's own units.
#
# higher_worse:  value >= red  -> red ;  value >= amber -> amber ; else green
# higher_better: value <= red  -> red ;  value <= amber -> amber ; else green
# ---------------------------------------------------------------------------
DEPT_THRESHOLDS = {
    # FIR pendency %: backlog of un-disposed cases. Target ~25%.
    "police": {
        "status_field": "pendency_pct",
        "unit": "%",
        "direction": "higher_worse",
        "target": 25,
        "red": 45,    # >=45% pending -> Critical
        "amber": 30,  # 30-44% pending -> Watch
        "tile_key": "Pendency",
    },
    # Bed occupancy %. Target ~75%; >=90% means no surge capacity.
    "health": {
        "status_field": "occupancy",
        "unit": "%",
        "direction": "higher_worse",
        "target": 75,
        "red": 90,    # >=90% occupied -> Critical
        "amber": 80,  # 80-89% occupied -> Watch
        "tile_key": "Bed Occupancy",
    },
    # PDS grievances per 100k ration users (scale-invariant, so big districts
    # aren't punished for size and wards still show a real spread). Target ~12.
    "pds": {
        "status_field": "complaint_rate",
        "unit": " /100k",
        "direction": "higher_worse",
        "target": 12,
        "red": 30,    # >=30 complaints / 100k users -> Critical
        "amber": 18,  # 18-29 / 100k -> Watch
        "tile_key": "Complaints / 100k Users",
    },
}


def normalize_department(value):
    return value if value in DEPT_CONFIG else "police"


def pds_complaint_rate(payload):
    """PDS grievances per 100,000 ration users (rounded to 1 dp).

    Scale-invariant: numerator and denominator both grow with district/ward
    size, so the rate measures grievance *intensity*, not raw population.
    """
    users = payload.get("ration_users") or 0
    complaints = payload.get("complaints") or 0
    if users <= 0:
        return 0.0
    return round(complaints / users * 100_000, 1)


def status_value(department, payload):
    """The value the RAG bands score for this department (may be derived)."""
    if department == "pds":
        return pds_complaint_rate(payload)
    field = DEPT_THRESHOLDS[department]["status_field"]
    return payload.get(field, 0)


def classify_status(department, value):
    spec = DEPT_THRESHOLDS[department]
    if spec["direction"] == "higher_worse":
        if value >= spec["red"]:
            return "red"
        if value >= spec["amber"]:
            return "amber"
        return "green"
    # higher_better
    if value <= spec["red"]:
        return "red"
    if value <= spec["amber"]:
        return "amber"
    return "green"


def band_info(department, payload):
    """Single source of truth for status + target telemetry.

    Used by seed_data (to persist .status) AND api.py (to emit target/delta),
    so the two can never drift apart.
    """
    spec = DEPT_THRESHOLDS[department]
    value = status_value(department, payload)
    target = spec["target"]
    return {
        "status": classify_status(department, value),
        "status_value": value,
        "target": target,
        "delta_vs_target": round(value - target, 1),
        "direction": spec["direction"],
        "status_unit": spec["unit"],
        "tile_key": spec["tile_key"],
    }
