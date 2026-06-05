import hashlib
import random

from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Area, AreaMetric, DataSource, District, DistrictMetric, MetricPoint
from .thresholds import DEPT_CONFIG, DEPT_ORDER, normalize_department


VIEW_BOX = "0 0 1000 1200"

KPI_ITEMS = {
    "police": ["FIRs Filed", "Pending Investigation", "Disposed"],
    "health": ["Bed Occupancy", "Beds", "Occupied/Vacant"],
    "pds": ["Ration Card Holders", "Fair Price Shops", "Complaints"],
}


def rng_for(key):
    seed = int.from_bytes(hashlib.md5(key.encode()).digest()[:6], "big")
    return random.Random(seed)


def indian_number(value):
    if value is None:
        return "-"
    try:
        number = int(value)
    except (TypeError, ValueError):
        return str(value)
    sign = "-" if number < 0 else ""
    digits = str(abs(number))
    if len(digits) <= 3:
        return sign + digits
    last = digits[-3:]
    rest = digits[:-3]
    groups = []
    while rest:
        groups.append(rest[-2:])
        rest = rest[:-2]
    return sign + ",".join(reversed(groups)) + "," + last


def compact_number(value):
    if value >= 10_000_000:
        return f"{value / 10_000_000:.2f} Cr"
    if value >= 100_000:
        return f"{value / 100_000:.1f} L"
    return indian_number(value)


def metric_value(metric):
    unit = DEPT_CONFIG[metric.department]["unit"]
    number = compact_number(metric.primary_value)
    return f"{number}{unit}" if unit == "%" else number


def tile_value(value, unit=""):
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if unit == "%":
        return f"{value}%"
    if isinstance(value, int):
        return compact_number(value)
    return str(value)


def metric_tiles(department, payload):
    if department == "police":
        return [
            {"key": "FIRs Filed", "value": tile_value(payload["fir_filed"])},
            {"key": "FIR Pending", "value": tile_value(payload["fir_pending"])},
            {"key": "Disposed", "value": tile_value(payload["disposed"])},
            {"key": "Pendency", "value": tile_value(payload["pendency_pct"], "%")},
        ]
    if department == "health":
        return [
            {"key": "Bed Occupancy", "value": tile_value(payload["occupancy"], "%")},
            {"key": "Sanctioned Beds", "value": tile_value(payload["beds"])},
            {"key": "Beds Occupied", "value": tile_value(payload["occupied"])},
            {"key": "Beds Vacant", "value": tile_value(payload["vacant"])},
        ]
    if department == "pds":
        return [
            {"key": "Complaints Raised (MTD)", "value": tile_value(payload["complaints"])},
            {"key": "Ration Users", "value": tile_value(payload["ration_users"])},
            {"key": "Ration Shops", "value": tile_value(payload["ration_shops"])},
            {"key": "Complaint Surge", "value": tile_value(payload["complaint_surge"])},
        ]
    return []


def top_district_code(department):
    metric = (
        DistrictMetric.objects.select_related("district")
        .filter(department=department)
        .order_by("-primary_value", "district__name")
        .first()
    )
    return metric.district.code if metric else None


def top_area_code(district, department):
    metric = (
        AreaMetric.objects.select_related("area")
        .filter(area__district=district, department=department)
        .order_by("-primary_value", "area__name")
        .first()
    )
    return metric.area.code if metric else None


def serialize_department_metric(metric):
    config = DEPT_CONFIG[metric.department]
    return {
        "id": metric.department,
        "label": config["label"],
        "metric_label": config["metric_label"],
        "unit": config["unit"],
        "value": metric.primary_value,
        "display_value": metric_value(metric),
        "status": metric.status,
    }


def serialize_data_source(source):
    return {
        "code": source.code,
        "name": source.name,
        "icon": source.icon,
        "description": source.description,
        "status": source.status,
        "records_today": source.records_today,
        "last_sync_seconds": source.last_sync_seconds,
        "latency_ms": source.latency_ms,
    }


def district_summary(department):
    metrics = DistrictMetric.objects.filter(department=department)
    counts = {row["status"]: row["count"] for row in metrics.values("status").annotate(count=Count("id"))}
    counts = {key: counts.get(key, 0) for key in ("green", "amber", "red")}

    if department == "police":
        total_firs = sum(m.payload["fir_filed"] for m in metrics)
        pending = sum(m.payload["fir_pending"] for m in metrics)
        disposed = sum(m.payload["disposed"] for m in metrics)
        cards = [
            {"key": "FIRs Filed", "value": compact_number(total_firs), "unit": "", "tone": None},
            {"key": "Pending FIRs", "value": compact_number(pending), "unit": "", "tone": "amber"},
            {"key": "Disposed", "value": compact_number(disposed), "unit": "", "tone": "green"},
            {"key": "Critical Districts", "value": counts["red"], "unit": "", "tone": "red"},
        ]
    elif department == "health":
        avg_occ = round(sum(m.payload["occupancy"] for m in metrics) / max(metrics.count(), 1))
        beds = sum(m.payload["beds"] for m in metrics)
        occupied = sum(m.payload["occupied"] for m in metrics)
        cards = [
            {"key": "Avg Bed Occupancy", "value": avg_occ, "unit": "%", "tone": "amber" if avg_occ >= 75 else "green"},
            {"key": "Sanctioned Beds", "value": compact_number(beds), "unit": "", "tone": None},
            {"key": "Beds Occupied", "value": compact_number(occupied), "unit": "", "tone": None},
            {"key": "Critical (>=90%)", "value": counts["red"], "unit": "", "tone": "red"},
        ]
    else:
        complaints = sum(m.payload["complaints"] for m in metrics)
        users = sum(m.payload["ration_users"] for m in metrics)
        shops = sum(m.payload["ration_shops"] for m in metrics)
        cards = [
            {"key": "Complaints Raised (MTD)", "value": compact_number(complaints), "unit": "", "tone": "red" if complaints else None},
            {"key": "Ration Users", "value": compact_number(users), "unit": "", "tone": None},
            {"key": "Ration Shops", "value": compact_number(shops), "unit": "", "tone": None},
            {"key": "Critical Districts", "value": counts["red"], "unit": "", "tone": "red"},
        ]
    return {"counts": counts, "cards": cards}


def district_trend(district, department):
    return [
        {"day": point.day, "value": point.value}
        for point in MetricPoint.objects.filter(district=district, department=department).order_by("day")
    ]


def derived_area_trend(area, metric, is_top):
    """Area trends are derived at read time because only district trends are stored."""
    rng = rng_for(f"area-trend:{area.code}:{metric.department}")
    current = max(1, round(metric.primary_value * (0.76 + rng.random() * 0.08)))
    values = []
    for day in range(14):
        drift = rng.uniform(-0.06, 0.08)
        current = max(1, round(current * (1 + drift)))
        values.append(current)
    if metric.status == "red" or is_top:
        boost = 1.25 + rng.random() * 0.35
        values[-3:] = [round(v * boost) for v in values[-3:]]
    values[-1] = metric.primary_value
    return [{"day": day, "value": value} for day, value in enumerate(values)]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def map_api(request):
    department = normalize_department(request.GET.get("department", "police"))
    config = DEPT_CONFIG[department]
    top_code = top_district_code(department)
    metrics = DistrictMetric.objects.select_related("district").filter(department=department)
    districts = [
        {
            "code": metric.district.code,
            "name": metric.district.name,
            "svg_path": metric.district.svg_path,
            "cx": metric.district.cx,
            "cy": metric.district.cy,
            "primary_value": metric.primary_value,
            "display_value": metric_value(metric),
            "status": metric.status,
            "is_top": metric.district.code == top_code,
            "payload": metric.payload,
        }
        for metric in metrics.order_by("district__name")
    ]
    return Response(
        {
            "department": department,
            "metric_label": config["metric_label"],
            "unit": config["unit"],
            "view_box": VIEW_BOX,
            "top_district": top_code,
            "summary": district_summary(department),
            "districts": districts,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def lineage_api(request):
    department = normalize_department(request.GET.get("department", "police"))
    nodes = list(DataSource.objects.filter(department=department).order_by("sort_order", "name"))
    sources = [node for node in nodes if node.layer == "source"]
    ingestion = next((node for node in nodes if node.layer == "ingestion"), None)
    kpi = next((node for node in nodes if node.layer == "kpi"), None)

    edges = []
    if ingestion:
        edges.extend({"from": source.code, "to": ingestion.code} for source in sources)
        if kpi:
            edges.append({"from": ingestion.code, "to": kpi.code})

    kpi_payload = serialize_data_source(kpi) if kpi else None
    if kpi_payload:
        kpi_payload["items"] = KPI_ITEMS[department]

    ingestion_payload = serialize_data_source(ingestion) if ingestion else None
    if ingestion_payload:
        ingestion_payload["records_today"] = sum(source.records_today for source in sources)

    return Response(
        {
            "department": department,
            "label": DEPT_CONFIG[department]["label"],
            "sources": [serialize_data_source(source) for source in sources],
            "ingestion": ingestion_payload,
            "kpi": kpi_payload,
            "edges": edges,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def district_api(request, code):
    department = normalize_department(request.GET.get("department", "police"))
    district = get_object_or_404(District, code=code)
    metrics = {
        metric.department: metric
        for metric in DistrictMetric.objects.filter(district=district).order_by("department")
    }
    active = metrics[department]
    top_district = top_district_code(department)
    should_show_wards = district.code == top_district and active.status == "red"
    top_area = top_area_code(district, department) if should_show_wards else None
    areas = []
    if should_show_wards:
        areas = [
            {
                "code": metric.area.code,
                "name": metric.area.name,
                "value": metric.primary_value,
                "display_value": metric_value(metric),
                "status": metric.status,
                "is_top": metric.area.code == top_area and metric.status == "red",
            }
            for metric in AreaMetric.objects.select_related("area")
            .filter(area__district=district, department=department)
            .order_by("area__name")
        ]
    return Response(
        {
            "code": district.code,
            "name": district.name,
            "department": department,
            "all_departments": [
                serialize_department_metric(metrics[dept])
                for dept in DEPT_ORDER
                if dept in metrics
            ],
            "active": {
                "metric_label": DEPT_CONFIG[department]["metric_label"],
                "unit": DEPT_CONFIG[department]["unit"],
                "value": active.primary_value,
                "display_value": metric_value(active),
                "status": active.status,
                "tiles": metric_tiles(department, active.payload),
            },
            "trend": district_trend(district, department),
            "top_area": top_area,
            "areas": areas,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def area_api(request, code):
    department = normalize_department(request.GET.get("department", "police"))
    area = get_object_or_404(Area.objects.select_related("district"), code=code)
    metrics = {metric.department: metric for metric in AreaMetric.objects.filter(area=area)}
    active = metrics[department]
    district_top_area = top_area_code(area.district, department)
    is_top_area = area.code == district_top_area and active.status == "red"
    return Response(
        {
            "code": area.code,
            "name": area.name,
            "department": department,
            "district": {"code": area.district.code, "name": area.district.name},
            "all_departments": [
                serialize_department_metric(metrics[dept])
                for dept in DEPT_ORDER
                if dept in metrics
            ],
            "active": {
                "metric_label": DEPT_CONFIG[department]["metric_label"],
                "unit": DEPT_CONFIG[department]["unit"],
                "value": active.primary_value,
                "display_value": metric_value(active),
                "status": active.status,
                "tiles": metric_tiles(department, active.payload),
            },
            "trend": derived_area_trend(area, active, is_top_area),
            "is_top_area": is_top_area,
        }
    )
