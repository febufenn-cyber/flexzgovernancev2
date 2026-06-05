import hashlib
import json
import random
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from dashboard.models import Area, AreaMetric, DataSource, District, DistrictMetric, MetricPoint
from dashboard.roles import DEMO_PASSWORD, ROLE_CHOICES
from dashboard.thresholds import DEPT_CONFIG, DEPT_ORDER, status_for


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


def make_metrics(name, scale=1.0):
    r = rng_for(name)
    size = MAJOR.get(name, 0.34 + r.random() * 0.62) * scale

    fir_filed = round((620 + r.random() * 1750) * (0.55 + size))
    pend_rate = 0.20 + r.random() * 0.42
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

    occupancy = round(46 + r.random() * 51)
    beds = round((360 + r.random() * 3200) * (0.5 + size))
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

    shops = round((300 + r.random() * 1500) * (0.5 + size))
    users = round((190000 + r.random() * 1450000) * (0.45 + size))
    comp_spike = r.random() > 0.8
    complaints = round((22 + r.random() * 215) * (0.5 + size))
    if comp_spike:
        complaints += round(150 + r.random() * 200)
    pds = {
        "complaints": complaints,
        "ration_users": users,
        "ration_shops": shops,
        "complaint_surge": comp_spike,
    }

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
                    status=status_for(department, payload),
                    payload=payload,
                )

    def _create_areas_and_metrics(self):
        for district in District.objects.order_by("name"):
            for index in range(1, 6):
                area = Area.objects.create(
                    district=district,
                    code=f"{district.code}-ward-{index}",
                    name=f"{district.name} \u2014 Ward {index}",
                )
                scale_rng = rng_for(f"{area.code}:scale")
                area_metrics = make_metrics(area.name, scale=0.12 + scale_rng.random() * 0.28)
                for department in DEPT_ORDER:
                    payload = area_metrics[department]
                    primary_field = DEPT_CONFIG[department]["primary_field"]
                    AreaMetric.objects.create(
                        area=area,
                        department=department,
                        primary_value=payload[primary_field],
                        status=status_for(department, payload),
                        payload=payload,
                    )

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
