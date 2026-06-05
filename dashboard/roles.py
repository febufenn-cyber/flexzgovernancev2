ROLE_CHOICES = [
    ("chief_minister", "Chief Minister"),
    ("chief_secretary", "Chief Secretary"),
    ("district_collector", "District Collector"),
    ("district_secretary", "District Secretary"),
    ("nodal_officer", "Nodal Officer"),
    ("health_minister", "Health Minister"),
    ("food_civil_supplies_minister", "Food and Civil Supplies Minister"),
]

DEMO_PASSWORD = "Demo12345"
ROLE_LABEL_TO_VALUE = {label.lower(): value for value, label in ROLE_CHOICES}
ROLE_VALUES = {value for value, _label in ROLE_CHOICES}


def normalize_role_username(value):
    """Accept either a role label or its slug username from the login field."""
    raw = (value or "").strip()
    lowered = raw.lower()
    if lowered in ROLE_LABEL_TO_VALUE:
        return ROLE_LABEL_TO_VALUE[lowered]
    if lowered in ROLE_VALUES:
        return lowered
    return raw
