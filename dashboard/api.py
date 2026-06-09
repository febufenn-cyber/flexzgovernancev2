import hashlib
import random

from django.db.models import Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Area, AreaMetric, DataSource, District, DistrictMetric, MetricPoint
from .roles import allowed_departments, clamp_department
from .thresholds import DEPT_CONFIG, DEPT_ORDER, DEPT_THRESHOLDS, band_info, normalize_department


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


def metric_band(metric, as_of):
    """Target/RAG telemetry for one metric, derived from the same band_info()
    that seed_data used to set .status — so they can never disagree."""
    info = band_info(metric.department, metric.payload)
    return {
        "target": info["target"],
        "status_value": info["status_value"],
        "delta_vs_target": info["delta_vs_target"],
        "direction": info["direction"],
        "status_unit": info["status_unit"],
        "as_of": as_of,
    }


def _band_tile(department, payload, key, value, unit=""):
    """A tile that carries target/delta when its key is the dept's status metric."""
    tile = {"key": key, "value": tile_value(value, unit)}
    spec = DEPT_THRESHOLDS[department]
    if key == spec["tile_key"]:
        info = band_info(department, payload)
        tile["target"] = info["target"]
        tile["delta_vs_target"] = info["delta_vs_target"]
        tile["direction"] = info["direction"]
        tile["status_unit"] = info["status_unit"]
        tile["status"] = info["status"]
    return tile


def metric_tiles(department, payload):
    if department == "police":
        return [
            {"key": "FIRs Filed", "value": tile_value(payload["fir_filed"])},
            {"key": "FIR Pending", "value": tile_value(payload["fir_pending"])},
            {"key": "Disposed", "value": tile_value(payload["disposed"])},
            _band_tile(department, payload, "Pendency", payload["pendency_pct"], "%"),
        ]
    if department == "health":
        return [
            _band_tile(department, payload, "Bed Occupancy", payload["occupancy"], "%"),
            {"key": "Sanctioned Beds", "value": tile_value(payload["beds"])},
            {"key": "Beds Occupied", "value": tile_value(payload["occupied"])},
            {"key": "Beds Vacant", "value": tile_value(payload["vacant"])},
        ]
    if department == "pds":
        rate = payload.get("complaint_rate", 0)
        return [
            {"key": "Complaints Raised (MTD)", "value": tile_value(payload["complaints"])},
            _band_tile(department, payload, "Complaints / 100k Users", rate),
            {"key": "Ration Users", "value": tile_value(payload["ration_users"])},
            {"key": "Ration Shops", "value": tile_value(payload["ration_shops"])},
            {"key": "Complaint Surge", "value": tile_value(payload["complaint_surge"])},
        ]
    return []


# Priority / "top" is the WORST unit by governance severity (status red>amber>green,
# then furthest past target) — NOT the highest raw count. Ranking by raw
# primary_value would headline the district with the most FIRs filed as the top
# concern, i.e. the backwards "more filings = worse" logic we deliberately removed.
SEVERITY_RANK = {"red": 0, "amber": 1, "green": 2}


def _severity_sort_key(metric, name):
    info = band_info(metric.department, metric.payload)
    delta = info["delta_vs_target"]
    # higher_worse: larger positive delta = worse; higher_better: smaller = worse.
    worse_first = -delta if info["direction"] == "higher_worse" else delta
    return (SEVERITY_RANK.get(info["status"], 3), worse_first, name)


def top_district_code(department):
    metrics = list(
        DistrictMetric.objects.select_related("district").filter(department=department)
    )
    if not metrics:
        return None
    metrics.sort(key=lambda m: _severity_sort_key(m, m.district.name))
    return metrics[0].district.code


def top_area_code(district, department):
    metrics = list(
        AreaMetric.objects.select_related("area").filter(
            area__district=district, department=department
        )
    )
    if not metrics:
        return None
    metrics.sort(key=lambda m: _severity_sort_key(m, m.area.name))
    return metrics[0].area.code


def serialize_department_metric(metric, as_of):
    config = DEPT_CONFIG[metric.department]
    payload = {
        "id": metric.department,
        "label": config["label"],
        "metric_label": config["metric_label"],
        "unit": config["unit"],
        "value": metric.primary_value,
        "display_value": metric_value(metric),
        "status": metric.status,
    }
    payload.update(metric_band(metric, as_of))
    return payload


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
        h = DEPT_THRESHOLDS["health"]
        cards = [
            {"key": "Avg Bed Occupancy", "value": avg_occ, "unit": "%",
             "tone": "amber" if avg_occ >= h["target"] else "green"},
            {"key": "Sanctioned Beds", "value": compact_number(beds), "unit": "", "tone": None},
            {"key": "Beds Occupied", "value": compact_number(occupied), "unit": "", "tone": None},
            {"key": f"Critical (>={h['red']}%)", "value": counts["red"], "unit": "", "tone": "red"},
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
    department = clamp_department(request, request.GET.get("department"))  # authorization layer
    if department is None:  # role has no department access -> fail closed (never fall open)
        return Response({"detail": "Your role has no department access."}, status=403)
    config = DEPT_CONFIG[department]
    top_code = top_district_code(department)
    metrics = DistrictMetric.objects.select_related("district").filter(department=department)
    districts = []
    for metric in metrics.order_by("district__name"):
        band = band_info(metric.department, metric.payload)
        districts.append(
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
                # Governance metric the RAG is scored on (pendency % / occupancy %
                # / complaints per 100k) — so the priority panel headlines the real
                # signal, not the raw headline count.
                "status_value": band["status_value"],
                "status_unit": band["status_unit"],
                "payload": metric.payload,
            }
        )
    return Response(
        {
            "department": department,
            "metric_label": config["metric_label"],
            "unit": config["unit"],
            "view_box": VIEW_BOX,
            "top_district": top_code,
            "status_metric_label": DEPT_THRESHOLDS[department]["tile_key"],
            "summary": district_summary(department),
            "districts": districts,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def lineage_api(request):
    department = clamp_department(request, request.GET.get("department"))  # authorization layer
    if department is None:  # role has no department access -> fail closed (never fall open)
        return Response({"detail": "Your role has no department access."}, status=403)
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
    department = clamp_department(request, request.GET.get("department"))  # authorization layer
    if department is None:  # role has no department access -> fail closed (never fall open)
        return Response({"detail": "Your role has no department access."}, status=403)
    allowed = allowed_departments(request)  # authorization layer: scope departments
    as_of = timezone.now().isoformat()
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
                serialize_department_metric(metrics[dept], as_of)
                for dept in DEPT_ORDER
                if dept in metrics and dept in allowed
            ],
            "active": {
                "metric_label": DEPT_CONFIG[department]["metric_label"],
                "unit": DEPT_CONFIG[department]["unit"],
                "value": active.primary_value,
                "display_value": metric_value(active),
                "status": active.status,
                **metric_band(active, as_of),
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
    department = clamp_department(request, request.GET.get("department"))  # authorization layer
    if department is None:  # role has no department access -> fail closed (never fall open)
        return Response({"detail": "Your role has no department access."}, status=403)
    allowed = allowed_departments(request)  # authorization layer: scope departments
    as_of = timezone.now().isoformat()
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
                serialize_department_metric(metrics[dept], as_of)
                for dept in DEPT_ORDER
                if dept in metrics and dept in allowed
            ],
            "active": {
                "metric_label": DEPT_CONFIG[department]["metric_label"],
                "unit": DEPT_CONFIG[department]["unit"],
                "value": active.primary_value,
                "display_value": metric_value(active),
                "status": active.status,
                **metric_band(active, as_of),
                "tiles": metric_tiles(department, active.payload),
            },
            "trend": derived_area_trend(area, active, is_top_area),
            "is_top_area": is_top_area,
        }
    )
