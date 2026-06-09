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


# --- Authorization layer -----------------------------------------------------
# Server-side role-based scoping. The authorization role is DERIVED FROM THE
# AUTHENTICATED IDENTITY (role_for_user) — never from a client-submitted form
# field — and scoping FAILS CLOSED: an unknown/missing role is granted NO
# departments, so the layer cannot fail open. Every API endpoint clamps the
# requested department to the role's allowed set (and 403s when the set is empty),
# so a scoped minister can never read another department's data.

from .thresholds import DEPT_ORDER, normalize_department

# Department(s) each scoped role may read.
ROLE_DEPARTMENTS = {
    "health_minister": ("health",),
    "food_civil_supplies_minister": ("pds",),
}

# Roles granted statewide, all-department oversight. Enumerated explicitly so a
# role added to ROLE_CHOICES but forgotten here gets NOTHING (fail closed), not
# everything.
STATEWIDE_ROLES = {
    "chief_minister",
    "chief_secretary",
    "district_collector",
    "district_secretary",
    "nodal_officer",
}

# Deterministic "home district" highlighted for the district-level roles.
# Codes match the seeded geometry in data/tn_districts.json.
ROLE_HOME_DISTRICT = {
    "district_collector": "chennai",
    "district_secretary": "coimbatore",
}


def role_for_user(user):
    """Derive the authorization role from the *authenticated identity*, never from
    client-submitted form input (which a client could forge to self-promote).

    Demo accounts are seeded with username == role slug; superusers get statewide
    oversight; anything else gets no role (deny). This is the security boundary.
    """
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    username = (user.get_username() or "").strip().lower()
    if username in ROLE_VALUES:
        return username
    if getattr(user, "is_superuser", False):
        return "chief_secretary"
    return None


def session_role(request):
    return request.session.get("role")


def allowed_departments(request):
    """Departments the session role may read, in DEPT_ORDER.

    FAILS CLOSED: an unknown or missing role returns an EMPTY tuple, and callers
    must treat that as 'no access' (403) — scoping never falls open to all.
    """
    role = session_role(request)
    if role in ROLE_DEPARTMENTS:
        return tuple(dept for dept in DEPT_ORDER if dept in ROLE_DEPARTMENTS[role])
    if role in STATEWIDE_ROLES:
        return tuple(DEPT_ORDER)
    return ()


def role_default_department(request):
    """The department a role lands on (its first allowed department), or None."""
    allowed = allowed_departments(request)
    return allowed[0] if allowed else None


def clamp_department(request, value):
    """Resolve ?department= within the role's allowed set.

    Returns None when the role may read nothing (the caller MUST 403) — it never
    falls open to a default department.
    """
    allowed = allowed_departments(request)
    if not allowed:
        return None
    dept = normalize_department(value)
    return dept if dept in allowed else allowed[0]


def role_home_district(request):
    """Deterministic home-district code for district-level roles, else None."""
    return ROLE_HOME_DISTRICT.get(session_role(request))
