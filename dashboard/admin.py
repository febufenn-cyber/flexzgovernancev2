from django.contrib import admin

from .models import Area, AreaMetric, DataSource, District, DistrictMetric, MetricPoint


class DistrictMetricInline(admin.TabularInline):
    model = DistrictMetric
    extra = 0


class AreaInline(admin.TabularInline):
    model = Area
    extra = 0


@admin.register(District)
class DistrictAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "cx", "cy")
    search_fields = ("name", "code")
    inlines = (DistrictMetricInline, AreaInline)


@admin.register(Area)
class AreaAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "district")
    list_filter = ("district",)
    search_fields = ("name", "code", "district__name")


@admin.register(DistrictMetric)
class DistrictMetricAdmin(admin.ModelAdmin):
    list_display = ("district", "department", "primary_value", "status")
    list_filter = ("department", "status")
    search_fields = ("district__name", "district__code")


@admin.register(AreaMetric)
class AreaMetricAdmin(admin.ModelAdmin):
    list_display = ("area", "department", "primary_value", "status")
    list_filter = ("department", "status", "area__district")
    search_fields = ("area__name", "area__code", "area__district__name")


@admin.register(MetricPoint)
class MetricPointAdmin(admin.ModelAdmin):
    list_display = ("district", "department", "day", "value")
    list_filter = ("department", "day")
    search_fields = ("district__name",)


@admin.register(DataSource)
class DataSourceAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "department",
        "layer",
        "status",
        "records_today",
        "last_sync_seconds",
        "latency_ms",
        "sort_order",
    )
    list_filter = ("department", "layer", "status")
    search_fields = ("name", "code", "description")
    ordering = ("department", "sort_order", "name")
