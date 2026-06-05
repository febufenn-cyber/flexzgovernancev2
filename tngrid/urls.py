from django.contrib import admin
from django.urls import include, path

from dashboard.views import RoleLoginView


urlpatterns = [
    path("admin/", admin.site.urls),
    path("login/", RoleLoginView.as_view(), name="login"),
    path("", include("dashboard.urls")),
]
