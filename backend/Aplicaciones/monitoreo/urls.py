# ============================================
# Aplicaciones/monitoreo/urls.py
# ============================================
from django.urls import path
from .views import (
    CrearListarEventosView,
    CrearListarAdvertenciasView,
    ResumenIntentoMonitoreoView,
    ConfiguracionMonitoreoView,
    DetalleConfiguracionMonitoreoView,
    analizar_frame,          # ← NUEVO
    detection_health,        # ← NUEVO
)

app_name = "monitoreo"

urlpatterns = [
    # ── Existentes ──
    path("eventos/",CrearListarEventosView.as_view(),            name="eventos"),
    path("advertencias/",                               CrearListarAdvertenciasView.as_view(),       name="advertencias"),
    path("intentos/<int:intento_id>/resumen/",          ResumenIntentoMonitoreoView.as_view(),       name="resumen_intento"),
    path("config/",                                     ConfiguracionMonitoreoView.as_view(),        name="config_list_create"),
    path("config/<int:id>/",                            DetalleConfiguracionMonitoreoView.as_view(), name="config_detail"),

    # ── Nuevos: detección facial ──
    path("analizar-frame/",                             analizar_frame,                              name="analizar-frame"),
    path("detection-health/",                           detection_health,                            name="detection-health"),
]