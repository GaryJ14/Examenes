# apps/reports/serializers.py
from rest_framework import serializers
from .models import Reporte, PlantillaReporte

class ReporteSerializer(serializers.ModelSerializer):
    porcentaje_aprobacion = serializers.FloatField(read_only=True)
    porcentaje_expulsion = serializers.FloatField(read_only=True)

    class Meta:
        model = Reporte
        fields = [
            'id_reporte', 'tipo', 'formato', 'estado',

            'intento_id', 'estudiante_id', 'estudiante_nombre',
            'examen_id', 'examen_titulo', 'docente_id',

            'total_advertencias', 'advertencias_detalle',
            'calificacion', 'puntaje_obtenido', 'puntaje_total',
            'tiempo_examen', 'preguntas_correctas', 'preguntas_incorrectas', 'preguntas_totales',

            'eventos_monitoreo',
            'anomalias', 'hubo_expulsion', 'motivo_expulsion',

            'promedio_calificaciones', 'mediana_calificaciones', 'desviacion_estandar',
            'total_estudiantes', 'estudiantes_aprobados', 'estudiantes_reprobados', 'estudiantes_expulsados',

            'archivo_url', 'datos_json',

            'solicitado_por_id', 'solicitado_por_nombre', 'solicitado_por_rol',
            'observaciones', 'error_mensaje',

            'fecha_generacion', 'fecha_actualizacion', 'fecha_desde', 'fecha_hasta',

            'porcentaje_aprobacion', 'porcentaje_expulsion',
        ]
        read_only_fields = [
            'id_reporte', 'estado',
            'archivo_url', 'datos_json',
            'error_mensaje',
            'fecha_generacion', 'fecha_actualizacion',
            'porcentaje_aprobacion', 'porcentaje_expulsion',
        ]


class CrearReporteSerializer(serializers.ModelSerializer):
    """
    Serializer para solicitar (crear) un reporte.
    El backend completa solicitado_por_* desde request.user.
    """
    class Meta:
        model = Reporte
        fields = [
            'tipo', 'formato',
            'intento_id', 'estudiante_id', 'examen_id',
            'fecha_desde', 'fecha_hasta',
            'observaciones'
        ]


class PlantillaReporteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlantillaReporte
        fields = '__all__'
        read_only_fields = ['id_plantilla', 'fecha_creacion', 'fecha_actualizacion']
