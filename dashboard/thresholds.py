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

# Status is allocated purely by the magnitude of each unit's primary metric,
# ranked within its department. The highest-value districts/wards are Critical,
# the lowest are Normal — one identical, monotonic rule for Police, Health and PDS.
# Higher count -> higher severity, every time, in every segment.
STATUS_RED_PCT = 0.30    # top 30% by value  -> Critical
STATUS_AMBER_PCT = 0.57  # next 27% by value -> Watch; the remainder -> Normal


def rank_status(rank_index, total):
    """Map a value-rank to a status. rank_index 0 == highest value in the department."""
    if total <= 0:
        return "green"
    frac = (rank_index + 1) / total
    if frac <= STATUS_RED_PCT:
        return "red"
    if frac <= STATUS_AMBER_PCT:
        return "amber"
    return "green"


def normalize_department(value):
    return value if value in DEPT_CONFIG else "police"
