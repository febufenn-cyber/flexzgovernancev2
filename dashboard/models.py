from django.db import models


DEPARTMENTS = [
    ("police", "Police"),
    ("health", "Health"),
    ("pds", "PDS"),
]

STATUS = [
    ("green", "Normal"),
    ("amber", "Watch"),
    ("red", "Critical"),
]

DATA_SOURCE_LAYERS = [
    ("source", "Source"),
    ("ingestion", "Ingestion"),
    ("kpi", "KPI"),
]

DATA_SOURCE_STATUS = [
    ("live", "Live"),
    ("delayed", "Delayed"),
    ("offline", "Offline"),
]


class District(models.Model):
    code = models.SlugField(unique=True)
    name = models.CharField(max_length=80)
    svg_path = models.TextField()
    cx = models.FloatField()
    cy = models.FloatField()

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Area(models.Model):
    district = models.ForeignKey(District, related_name="areas", on_delete=models.CASCADE)
    code = models.SlugField(unique=True)
    name = models.CharField(max_length=120)

    class Meta:
        ordering = ["district__name", "name"]

    def __str__(self):
        return self.name


class DistrictMetric(models.Model):
    district = models.ForeignKey(District, related_name="metrics", on_delete=models.CASCADE)
    department = models.CharField(max_length=12, choices=DEPARTMENTS)
    primary_value = models.IntegerField()
    status = models.CharField(max_length=6, choices=STATUS)
    payload = models.JSONField(default=dict)

    class Meta:
        unique_together = ("district", "department")
        indexes = [
            models.Index(fields=["department", "-primary_value"]),
            models.Index(fields=["department", "status"]),
        ]

    def __str__(self):
        return f"{self.district} - {self.department}: {self.primary_value}"


class AreaMetric(models.Model):
    area = models.ForeignKey(Area, related_name="metrics", on_delete=models.CASCADE)
    department = models.CharField(max_length=12, choices=DEPARTMENTS)
    primary_value = models.IntegerField()
    status = models.CharField(max_length=6, choices=STATUS)
    payload = models.JSONField(default=dict)

    class Meta:
        unique_together = ("area", "department")
        indexes = [
            models.Index(fields=["department", "-primary_value"]),
            models.Index(fields=["department", "status"]),
        ]

    def __str__(self):
        return f"{self.area} - {self.department}: {self.primary_value}"


class MetricPoint(models.Model):
    """14-day trend per district per department, day 0 oldest and 13 today."""

    district = models.ForeignKey(District, related_name="points", on_delete=models.CASCADE)
    department = models.CharField(max_length=12, choices=DEPARTMENTS)
    day = models.IntegerField()
    value = models.IntegerField()

    class Meta:
        unique_together = ("district", "department", "day")
        ordering = ["district__name", "department", "day"]

    def __str__(self):
        return f"{self.district} - {self.department} day {self.day}: {self.value}"


class DataSource(models.Model):
    department = models.CharField(max_length=12, choices=DEPARTMENTS)
    name = models.CharField(max_length=120)
    code = models.SlugField(unique=True)
    layer = models.CharField(max_length=12, choices=DATA_SOURCE_LAYERS)
    description = models.CharField(max_length=220)
    status = models.CharField(max_length=8, choices=DATA_SOURCE_STATUS)
    records_today = models.IntegerField()
    last_sync_seconds = models.IntegerField()
    latency_ms = models.IntegerField()
    sort_order = models.IntegerField()
    icon = models.CharField(max_length=8)

    class Meta:
        ordering = ["department", "sort_order", "name"]
        indexes = [
            models.Index(fields=["department", "layer", "sort_order"]),
            models.Index(fields=["department", "status"]),
        ]

    def __str__(self):
        return f"{self.get_department_display()} - {self.name}"
