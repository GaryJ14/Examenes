# ============================================
# Aplicaciones/analisis/urls.py
# ============================================
from django.urls import path
from .views import ListaCrearIntentosView, DetalleIntentoView, GuardarRespuestaView, FinalizarIntentoView

app_name = "analisis"

urlpatterns = [
    path("intentos/", ListaCrearIntentosView.as_view(), name="intentos_list_create"),
    path("intentos/<int:id>/", DetalleIntentoView.as_view(), name="intento_detail"),
    path("intentos/<int:id>/respuestas/", GuardarRespuestaView.as_view(), name="guardar_respuesta"),
    path("intentos/<int:id>/finalizar/", FinalizarIntentoView.as_view(), name="intento_finalizar"),
]
