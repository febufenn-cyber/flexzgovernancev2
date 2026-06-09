import hashlib
import json
import random
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from dashboard.models import Area, AreaMetric, DataSource, District, DistrictMetric, MetricPoint
from dashboard.roles import DEMO_PASSWORD, ROLE_CHOICES
from dashboard.thresholds import DEPT_CONFIG, DEPT_ORDER, band_info, pds_complaint_rate


MAJOR = {
    "Chennai": 1.0,
    "Coimbatore": 0.86,
    "Madurai": 0.78,
    "Tiruchirappalli": 0.66,
    "Salem": 0.7,
    "Tirunelveli": 0.64,
    "Vellore": 0.62,
    "Kanchipuram": 0.6,
    "Tiruvallur": 0.62,
    "Viluppuram": 0.58,
    "Erode": 0.56,
    "Thanjavur": 0.54,
}

POLICE_OVERRIDES = {
    "Tiruvallur": {
        "fir_filed": 3520,
        "fir_pending": 1971,
        "pendency_pct": 56,
        "crime_spike": False,
    },
}

HEALTH_OVERRIDES = {
    "Erode": {
        "occupancy": 99,
    },
}

LINEAGE_GRAPH = {
    "police": {
        "sources": [
            {
                "icon": "📕",
                "name": "CCTNS",
                "code": "police-cctns",
                "description": "Crime & Criminal Tracking Network & Systems FIR master",
                "status": "live",
            },
            {
                "icon": "📱",
                "name": "Kaval Uthavi / e-FIR Portal",
                "code": "police-efir",
                "description": "Online complaint and FIR registration",
                "status": "live",
            },
            {
                "icon": "☎️",
                "name": "ERSS · Dial 112/100",
                "code": "police-erss",
                "description": "Emergency distress call intake",
                "status": "live",
            },
            {
                "icon": "⚖️",
                "name": "ICJS",
                "code": "police-icjs",
                "description": "Court and prison disposal exchange",
                "status": "delayed",
            },
        ],
        "ingestion": {
            "icon": "🛰️",
            "name": "Home Dept Data Lake",
            "code": "police-home-data-lake",
            "description": "TN State Data Platform ingestion and ETL",
            "status": "live",
        },
        "kpi": {
            "icon": "🛡️",
            "name": "Police KPIs",
            "code": "police-kpis",
            "description": "FIRs Filed, Pending Investigation, Disposed",
            "status": "live",
        },
    },
    "health": {
        "sources": [
            {
                "icon": "🏥",
                "name": "Hospital HMS / e-Hospital",
                "code": "health-hms",
                "description": "IPD, OPD and live bed census from government hospitals",
                "status": "live",
            },
            {
                "icon": "📊",
                "name": "HMIS",
                "code": "health-hmis",
                "description": "Health Management Information System reporting",
                "status": "delayed",
            },
            {
                "icon": "🚑",
                "name": "108 EMRI / 104 Helpline",
                "code": "health-emri",
                "description": "Ambulance dispatch and health helpline events",
                "status": "live",
            },
            {
                "icon": "🦠",
                "name": "IHIP / IDSP",
                "code": "health-ihip-idsp",
                "description": "Integrated disease surveillance feeds",
                "status": "live",
            },
        ],
        "ingestion": {
            "icon": "🛰️",
            "name": "TN Health Data Platform",
            "code": "health-data-platform",
            "description": "HMIS aggregation and validation layer",
            "status": "live",
        },
        "kpi": {
            "icon": "❤️",
            "name": "Health KPIs",
            "code": "health-kpis",
            "description": "Bed Occupancy, Beds, Occupied/Vacant",
            "status": "live",
        },
    },
    "pds": {
        "sources": [
            {
                "icon": "🏪",
                "name": "ePoS Terminals (FPS)",
                "code": "pds-epos",
                "description": "Aadhaar-authenticated Fair Price Shop transactions",
                "status": "live",
            },
            {
                "icon": "💳",
                "name": "TNPDS",
                "code": "pds-tnpds",
                "description": "Smart ration-card beneficiary registry",
                "status": "live",
            },
            {
                "icon": "📦",
                "name": "Depot Online System (DOS)",
                "code": "pds-dos",
                "description": "Supply-chain stock movement",
                "status": "delayed",
            },
            {
                "icon": "📞",
                "name": "1967 Grievance Portal",
                "code": "pds-grievance",
                "description": "PDS complaints helpline",
                "status": "live",
            },
        ],
        "ingestion": {
            "icon": "🛰️",
            "name": "Civil Supplies Data Lake",
            "code": "pds-civil-supplies-lake",
            "description": "TNPDS backend aggregation",
            "status": "live",
        },
        "kpi": {
            "icon": "🛒",
            "name": "PDS KPIs",
            "code": "pds-kpis",
            "description": "Ration Card Holders, Fair Price Shops, Complaints",
            "status": "live",
        },
    },
}


def rng_for(key):
    seed = int.from_bytes(hashlib.md5(key.encode()).digest()[:6], "big")
    return random.Random(seed)


# Declared "size" now DOMINATES count magnitude. Each count = ANCHOR * size *
# narrow jitter (no large size-independent floor to drown it out), so a big
# district is believably bigger than a small one (Chennai >> Perambalur on beds /
# ration_users / FIRs). Non-MAJOR districts get a *capped* fallback size so a lucky
# random draw can never out-rank the metros: max fallback magnitude is
# 0.52 * 1.15 = 0.60 of anchor, below Chennai's floor of 1.0 * 0.85 = 0.85.
# Percentages (pendency_pct, occupancy) stay size-INDEPENDENT.
ANCHOR_FIR = 3600       # Chennai ~3.6-4k FIRs/month; small districts ~700-1100
ANCHOR_BEDS = 4200      # Chennai ~3.5-4k government beds; small districts ~900-1400
ANCHOR_USERS = 1750000  # Chennai ~1.5-1.8M ration users; small districts ~0.4-0.6M
SIZE_JITTER = 0.15      # +/-15% magnitude jitter around the size term


def _fallback_size(r):
    """Capped size for non-MAJOR districts: [0.22, 0.52], always below the
    metros so Chennai/Coimbatore stay the largest by magnitude."""
    return 0.22 + r.random() * 0.30


def make_metrics(name):
    r = rng_for(name)
    size = MAJOR.get(name) or _fallback_size(r)

    def magnitude(anchor):
        """Size-dominated count: anchor * size with a narrow +/-15% jitter."""
        return round(anchor * size * r.uniform(1 - SIZE_JITTER, 1 + SIZE_JITTER))

    fir_filed = magnitude(ANCHOR_FIR)
    # Re-centred near the target (25): uniform[18%, 38%], mean ~28% -> the police
    # spread is mostly green/amber with a red minority (was uniform[20%, 62%]).
    pend_rate = 0.18 + r.random() * 0.20
    fir_pending = round(fir_filed * pend_rate)
    crime_spike = r.random() > 0.74
    police = {
        "fir_filed": fir_filed,
        "fir_pending": fir_pending,
        "disposed": fir_filed - fir_pending,
        "pendency_pct": round(pend_rate * 100),
        "crime_spike": crime_spike,
    }
    if name in POLICE_OVERRIDES:
        police.update(POLICE_OVERRIDES[name])
        police["disposed"] = police["fir_filed"] - police["fir_pending"]

    # Occupancy is the 4th RNG draw (magnitude->pend->crime->occupancy), unchanged
    # from the original, so every district's occupancy value is byte-identical and
    # the health RAG band distribution cannot drift.
    occupancy = round(46 + r.random() * 51)
    beds = magnitude(ANCHOR_BEDS)
    occupied = round(beds * occupancy / 100)
    health = {
        "occupancy": occupancy,
        "beds": beds,
        "occupied": occupied,
        "vacant": beds - occupied,
    }
    if name in HEALTH_OVERRIDES:
        health.update(HEALTH_OVERRIDES[name])
        health["occupied"] = round(health["beds"] * health["occupancy"] / 100)
        health["vacant"] = health["beds"] - health["occupied"]

    users = magnitude(ANCHOR_USERS)
    # Fair-price shops derive from users (~900-1800 users per shop) so the
    # users-per-shop ratio is always believable, instead of an independent draw.
    shops = max(1, round(users / r.uniform(900, 1800)))
    comp_spike = r.random() > 0.8
    # Complaints are generated from a per-100k RATE (scale-invariant), so big
    # districts aren't auto-flagged for size: base ~8-22/100k (target 12), plus a
    # surge bump on spike districts. complaint_rate is then derived from the pair.
    base_rate = 8 + r.random() * 14
    complaints = round(users / 100_000 * base_rate)
    if comp_spike:
        complaints += round(users / 100_000 * (12 + r.random() * 16))
    pds = {
        "complaints": complaints,
        "ration_users": users,
        "ration_shops": shops,
        "complaint_surge": comp_spike,
    }
    pds["complaint_rate"] = pds_complaint_rate(pds)

    return {
        "police": police,
        "health": health,
        "pds": pds,
    }


def _split_counts(district_code, key, total, parts=5):
    """Deterministically PARTITION a district count total across `parts` wards.

    Returns a list that sums to exactly `total` with each ward strictly < total
    (jittered weights), so wards never out-mass their own district. Seeded per
    (district, key) so each count partitions independently but reproducibly.
    """
    wr = rng_for(f"{district_code}:split:{key}")
    weights = [0.6 + wr.random() * 0.8 for _ in range(parts)]
    weight_sum = sum(weights)
    shares = [round(total * w / weight_sum) for w in weights]
    # Absorb rounding drift into the largest ward so the parts sum to `total`
    # exactly while staying below it.
    shares[shares.index(max(shares))] += total - sum(shares)
    return shares


def ward_metrics(district_code, district_payload, index):
    """Build one ward's payload by PARTITIONING the district's count totals and
    deriving everything scale-dependent from the ward's own share.

    COUNT metrics (fir_filed, beds, ration_users) are split so the 5 wards sum to
    ~district (each < district). PERCENTAGES (pendency_pct, occupancy) are drawn
    independently per ward (scale-free -> plausible per-ward variation). Counts
    derived from those (fir_pending/disposed, occupied/vacant) follow. ration_shops
    derives from the ward's users; complaints derive from the ward's users x a
    jittered version of the district complaint_rate (so ward complaint_rate stays
    plausible and sums to ~district, never the runaway-rate bug at ward level).

    `index` is 1..5; uses index-1 to read its slice of each partition.
    """
    r = rng_for(f"{district_code}-ward-{index}:metrics")
    slot = index - 1
    dp = district_payload

    fir_filed = _split_counts(district_code, "fir_filed", dp["police"]["fir_filed"])[slot]
    pend_rate = 0.18 + r.random() * 0.20
    fir_pending = round(fir_filed * pend_rate)
    crime_spike = r.random() > 0.74
    police = {
        "fir_filed": fir_filed,
        "fir_pending": fir_pending,
        "disposed": fir_filed - fir_pending,
        "pendency_pct": round(pend_rate * 100),
        "crime_spike": crime_spike,
    }

    beds = _split_counts(district_code, "beds", dp["health"]["beds"])[slot]
    occupancy = round(46 + r.random() * 51)
    occupied = round(beds * occupancy / 100)
    health = {
        "occupancy": occupancy,
        "beds": beds,
        "occupied": occupied,
        "vacant": beds - occupied,
    }

    users = _split_counts(district_code, "ration_users", dp["pds"]["ration_users"])[slot]
    shops = max(1, round(users / r.uniform(900, 1800)))
    # Tie ward complaints to ward users via a jittered district rate (mean 1.0),
    # so ward complaint_rate ~ district +/-20% and the parts sum to ~district.
    ward_rate = dp["pds"]["complaint_rate"] * r.uniform(0.8, 1.2)
    comp_spike = r.random() > 0.8
    complaints = round(users / 100_000 * ward_rate)
    pds = {
        "complaints": complaints,
        "ration_users": users,
        "ration_shops": shops,
        "complaint_surge": comp_spike,
    }
    pds["complaint_rate"] = pds_complaint_rate(pds)

    return {
        "police": police,
        "health": health,
        "pds": pds,
    }


def trend_points(name, department, primary_value, status, is_top):
    """Create a stable 14-day walk, boosting the last 3 days for red/top districts."""
    r = rng_for(f"{name}:{department}:trend")
    current = max(1, round(primary_value * (0.78 + r.random() * 0.06)))
    values = []
    for day in range(14):
        drift = r.uniform(-0.055, 0.08)
        current = max(1, round(current * (1 + drift)))
        values.append(current)
    if status == "red" or is_top:
        boost = 1.25 + r.random() * 0.35
        values[-3:] = [round(value * boost) for value in values[-3:]]
    values[-1] = primary_value
    return values


class Command(BaseCommand):
    help = "Seed deterministic synthetic data for the Tamil Nadu Governance Grid."

    def handle(self, *args, **options):
        data_path = Path(__file__).resolve().parents[3] / "data" / "tn_districts.json"
        if not data_path.exists():
            raise FileNotFoundError(f"Missing geometry file: {data_path}")

        geometry = json.loads(data_path.read_text())
        rows = geometry.get("districts", geometry if isinstance(geometry, list) else [])
        if not rows:
            raise ValueError("No districts found in tn_districts.json")

        with transaction.atomic():
            MetricPoint.objects.all().delete()
            AreaMetric.objects.all().delete()
            DistrictMetric.objects.all().delete()
            Area.objects.all().delete()
            District.objects.all().delete()
            DataSource.objects.all().delete()

            self._create_districts(rows)
            self._create_areas_and_metrics()
            self._assign_statuses()
            self._create_district_trends()
            self._create_data_sources()
            self._ensure_users()

        self._print_summary()

    def _create_districts(self, rows):
        for row in rows:
            district = District.objects.create(
                code=row["code"],
                name=row["name"],
                svg_path=row["d"],
                cx=row["cx"],
                cy=row["cy"],
            )
            metrics = make_metrics(district.name)
            for department in DEPT_ORDER:
                payload = metrics[department]
                primary_field = DEPT_CONFIG[department]["primary_field"]
                DistrictMetric.objects.create(
                    district=district,
                    department=department,
                    primary_value=payload[primary_field],
                    status="green",  # provisional; set by _assign_statuses (value-rank)
                    payload=payload,
                )

    def _create_areas_and_metrics(self):
        for district in District.objects.order_by("name"):
            # Recompute the district payload (deterministic, == the stored district
            # metrics) so wards PARTITION the real district totals rather than being
            # generated independently and inflating past the district.
            district_payload = make_metrics(district.name)
            for index in range(1, 6):
                area = Area.objects.create(
                    district=district,
                    code=f"{district.code}-ward-{index}",
                    name=f"{district.name} \u2014 Ward {index}",
                )
                area_metrics = ward_metrics(district.code, district_payload, index)
                for department in DEPT_ORDER:
                    payload = area_metrics[department]
                    primary_field = DEPT_CONFIG[department]["primary_field"]
                    AreaMetric.objects.create(
                        area=area,
                        department=department,
                        primary_value=payload[primary_field],
                        status="green",  # provisional; set by _assign_statuses (value-rank)
                        payload=payload,
                    )

    def _assign_statuses(self):
        """Allocate status from real, per-metric RAG bands tied to a target
        (see thresholds.DEPT_THRESHOLDS) — NOT percentile rank. Police is scored
        on FIR pendency %, Health on bed occupancy %, PDS on complaints per 100k
        users; each band is absolute, so a unit's RAG never depends on its
        neighbours and Police 'more FIRs = critical' is no longer the rule."""
        for Model, name_order in (
            (DistrictMetric, "district__name"),
            (AreaMetric, "area__name"),
        ):
            for department in DEPT_ORDER:
                metrics = list(
                    Model.objects.filter(department=department).order_by(name_order)
                )
                for metric in metrics:
                    metric.status = band_info(department, metric.payload)["status"]
                Model.objects.bulk_update(metrics, ["status"])

    def _create_district_trends(self):
        top_ids = {}
        for department in DEPT_ORDER:
            metric = (
                DistrictMetric.objects.filter(department=department)
                .order_by("-primary_value", "district__name")
                .first()
            )
            top_ids[department] = metric.district_id if metric else None

        points = []
        for metric in DistrictMetric.objects.select_related("district").order_by("district__name"):
            values = trend_points(
                metric.district.name,
                metric.department,
                metric.primary_value,
                metric.status,
                metric.district_id == top_ids[metric.department],
            )
            points.extend(
                MetricPoint(
                    district=metric.district,
                    department=metric.department,
                    day=day,
                    value=value,
                )
                for day, value in enumerate(values)
            )
        MetricPoint.objects.bulk_create(points)

    def _telemetry(self, department, node):
        rng = rng_for(f"lineage:{department}:{node['code']}")
        if node["status"] == "delayed":
            last_sync = 300 + rng.randint(0, 3300)
            records = 4_000 + rng.randint(500, 14_000)
            latency = 920 + rng.randint(80, 760)
        else:
            last_sync = 3 + rng.randint(0, 37)
            records = 18_000 + rng.randint(3_000, 96_000)
            latency = 85 + rng.randint(15, 260)
        return records, last_sync, latency

    def _create_data_sources(self):
        rows = []
        for department, graph in LINEAGE_GRAPH.items():
            sort_order = 10
            for source in graph["sources"]:
                records, last_sync, latency = self._telemetry(department, source)
                rows.append(
                    DataSource(
                        department=department,
                        name=source["name"],
                        code=source["code"],
                        layer="source",
                        description=source["description"],
                        status=source["status"],
                        records_today=records,
                        last_sync_seconds=last_sync,
                        latency_ms=latency,
                        sort_order=sort_order,
                        icon=source["icon"],
                    )
                )
                sort_order += 10

            for layer, sort_order in (("ingestion", 60), ("kpi", 80)):
                node = graph[layer]
                records, last_sync, latency = self._telemetry(department, node)
                rows.append(
                    DataSource(
                        department=department,
                        name=node["name"],
                        code=node["code"],
                        layer=layer,
                        description=node["description"],
                        status=node["status"],
                        records_today=records,
                        last_sync_seconds=last_sync,
                        latency_ms=latency,
                        sort_order=sort_order,
                        icon=node["icon"],
                    )
                )
        DataSource.objects.bulk_create(rows)

    def _ensure_users(self):
        User = get_user_model()
        collector, _ = User.objects.get_or_create(
            username="collector",
            defaults={"first_name": "Demo", "last_name": "Collector", "is_staff": False},
        )
        collector.set_password(DEMO_PASSWORD)
        collector.save(update_fields=["password", "first_name", "last_name", "is_staff"])

        for username, label in ROLE_CHOICES:
            first, _, last = label.partition(" ")
            user, _ = User.objects.get_or_create(
                username=username,
                defaults={"first_name": first, "last_name": last, "is_staff": False},
            )
            user.first_name = first
            user.last_name = last
            user.is_staff = False
            user.set_password(DEMO_PASSWORD)
            user.save(update_fields=["password", "first_name", "last_name", "is_staff"])

        admin, _ = User.objects.get_or_create(
            username="admin",
            defaults={"is_staff": True, "is_superuser": True},
        )
        admin.is_staff = True
        admin.is_superuser = True
        admin.set_password("admin12345")
        admin.save(update_fields=["password", "is_staff", "is_superuser"])

    def _print_summary(self):
        self.stdout.write(self.style.SUCCESS("Seeded Tamil Nadu Governance Grid"))
        self.stdout.write(f"Districts: {District.objects.count()}")
        self.stdout.write(f"Areas: {Area.objects.count()}")
        self.stdout.write(f"District metrics: {DistrictMetric.objects.count()}")
        self.stdout.write(f"Area metrics: {AreaMetric.objects.count()}")
        self.stdout.write(f"Trend points: {MetricPoint.objects.count()}")
        self.stdout.write(f"Lineage data sources: {DataSource.objects.count()}")
        for department in DEPT_ORDER:
            counts = {
                status: DistrictMetric.objects.filter(department=department, status=status).count()
                for status in ("green", "amber", "red")
            }
            top = (
                DistrictMetric.objects.select_related("district")
                .filter(department=department)
                .order_by("-primary_value", "district__name")
                .first()
            )
            self.stdout.write(
                f"{department:7} green={counts['green']:2} amber={counts['amber']:2} "
                f"red={counts['red']:2} top={top.district.name} ({top.primary_value})"
            )
