from django.contrib.auth.views import LogoutView
from django.urls import path

from . import api, views


urlpatterns = [
    path("", views.status_view, name="status"),
    path("district/<slug:code>/", views.district_view, name="district"),
    path("area/<slug:code>/", views.area_view, name="area"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("api/map/", api.map_api, name="api-map"),
    path("api/lineage/", api.lineage_api, name="api-lineage"),
    path("api/district/<slug:code>/", api.district_api, name="api-district"),
    path("api/area/<slug:code>/", api.area_api, name="api-area"),
]
