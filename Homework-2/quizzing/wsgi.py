"""Punto di ingresso WSGI standard del progetto Django."""

import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quizzing.settings")
application = get_wsgi_application()
