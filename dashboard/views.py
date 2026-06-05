from django import forms
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.views import LoginView
from django.contrib.auth.decorators import login_required
from django.shortcuts import render

from .roles import ROLE_CHOICES, normalize_role_username
from .thresholds import normalize_department


class RoleAuthenticationForm(AuthenticationForm):
    role = forms.ChoiceField(choices=ROLE_CHOICES)

    def __init__(self, request=None, *args, **kwargs):
        super().__init__(request, *args, **kwargs)
        self.fields["username"].widget.attrs.update(
            {
                "placeholder": "Enter username",
                "autocomplete": "off",
                "aria-autocomplete": "list",
                "aria-controls": "username-role-options",
            }
        )
        self.fields["password"].widget.attrs.update(
            {"placeholder": "Enter password", "autocomplete": "current-password"}
        )

    def clean_username(self):
        return normalize_role_username(self.cleaned_data.get("username"))


class RoleLoginView(LoginView):
    template_name = "dashboard/login.html"
    authentication_form = RoleAuthenticationForm

    def form_valid(self, form):
        response = super().form_valid(form)
        self.request.session["role"] = form.cleaned_data["role"]
        self.request.session["play_intro"] = True  # grid-acquisition intro, once per login
        return response


def active_department(request):
    if request.GET.get("dept"):
        return normalize_department(request.GET.get("dept"))
    return "police"


def role_label(request):
    role = request.session.get("role", "state")
    return dict(ROLE_CHOICES).get(role, "State Control Room")


def dashboard_context(request, **extra):
    context = {
        "active_dept": active_department(request),
        "role_label": role_label(request),
    }
    context.update(extra)
    return context


@login_required
def status_view(request):
    show_intro = request.session.pop("play_intro", False)  # consume: plays once after login
    return render(
        request,
        "dashboard/status_view.html",
        dashboard_context(request, show_intro=show_intro),
    )


@login_required
def district_view(request, code):
    return render(
        request,
        "dashboard/district_view.html",
        dashboard_context(request, object_code=code),
    )


@login_required
def area_view(request, code):
    return render(
        request,
        "dashboard/area_view.html",
        dashboard_context(request, object_code=code),
    )
