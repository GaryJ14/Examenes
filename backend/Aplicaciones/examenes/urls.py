# ============================================
# Aplicaciones/examenes/urls.py
# (COMPLETO)
# ============================================
from django.urls import path
from .views import (
    DetalleMateriaView,
    ExamenesPorMateriaView,
    MateriasConExamenesView,
    MateriasView,
    ListaExamenesView,
    CrearExamenView,
    DetalleExamenView,
    PreguntasExamenView,
    DetallePreguntaView,
    GenerarExamenIAView,
)

app_name = "examenes"

urlpatterns = [
    # materias
    path("materias/", MateriasView.as_view(), name="materias"),
    path("materias-con-examenes/", MateriasConExamenesView.as_view()),
    path("materia/<int:materia_id>/", ExamenesPorMateriaView.as_view(), name="examenes_por_materia"),
    path("materias/<int:id>/", DetalleMateriaView.as_view(), name="materia_detalle"),


    # examenes
    path("", ListaExamenesView.as_view(), name="lista"),
    path("crear/", CrearExamenView.as_view(), name="crear"),
    path("<int:id>/", DetalleExamenView.as_view(), name="detalle"),

    # preguntas
    path("<int:examen_id>/preguntas/", PreguntasExamenView.as_view(), name="preguntas"),
    path("<int:examen_id>/preguntas/<int:pregunta_id>/", DetallePreguntaView.as_view(), name="pregunta_detalle"),

    # ia
    path("<int:examen_id>/generar-ia/", GenerarExamenIAView.as_view(), name="generar_ia"),
]
