from django.urls import path
from .views import (
    ListaCrearReportesView,
    DetalleReporteView,
    GenerarReporteView,
    ListaCrearPlantillasView,
    DetallePlantillaView,
)

app_name = 'reports'

urlpatterns = [
    path('reportes/', ListaCrearReportesView.as_view(), name='lista_crear_reportes'),
    path('reportes/<int:id>/', DetalleReporteView.as_view(), name='detalle_reporte'),
    path('reportes/<int:id>/generar/', GenerarReporteView.as_view(), name='generar_reporte'),

    path('plantillas/', ListaCrearPlantillasView.as_view(), name='lista_crear_plantillas'),
    path('plantillas/<int:id>/', DetallePlantillaView.as_view(), name='detalle_plantilla'),
]
