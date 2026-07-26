"""Radice URL del progetto QUIZZING."""

from django.urls import include, path

urlpatterns = [path("", include("quizapp.urls"))]
