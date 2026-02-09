# ============================================
# Aplicaciones/analisis/serializers.py
# ============================================
from rest_framework import serializers
from .models import IntentoExamen, RespuestaEstudiante


class IntentoExamenSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntentoExamen
        fields = "__all__"
        read_only_fields = [
            "id_intento",
            "fecha_inicio",
            "fecha_fin",
            "tiempo_total",
            "preguntas_respondidas",
            "preguntas_correctas",
            "preguntas_incorrectas",
            "calificacion_final",
            "fecha_creacion",
            "fecha_actualizacion",
        ]


class CrearIntentoExamenSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntentoExamen
        fields = [
            "estudiante_id",
            "estudiante_nombre",
            "estudiante_cedula",
            "examen_id",
            "examen_titulo",
            "horario_id",
            "numero_intento",
            "fecha_limite",
            "puntaje_total",
            "ip_address",
            "user_agent",
            "camara_activada",
            "validacion_facial_completada",
            "preguntas_totales",
        ]


class RespuestaEstudianteSerializer(serializers.ModelSerializer):
    class Meta:
        model = RespuestaEstudiante
        fields = [
            "id_respuesta",
            "intento",
            "pregunta_id",
            "pregunta_enunciado",
            "pregunta_ponderacion",
            "opcion_id",
            "opciones_ids",
            "opcion_texto",
            "es_correcta",
            "puntaje_obtenido",
            "tiempo_respuesta",
            "numero_orden",
            "fecha_respuesta",
            "fecha_actualizacion",
        ]
        read_only_fields = [
            "id_respuesta",
            "es_correcta",
            "puntaje_obtenido",
            "fecha_respuesta",
            "fecha_actualizacion",
        ]


class GuardarRespuestaSerializer(serializers.Serializer):
    """
    ✅ Valida que venga una respuesta real:
      - SINGLE: opcion_id
      - MULTI: opciones_ids (lista no vacía)

    Evita registros vacíos (opcion_id=None y opciones_ids=[]).
    """
    pregunta_id = serializers.IntegerField()

    # SINGLE
    opcion_id = serializers.IntegerField(required=False, allow_null=True)

    # MULTI
    opciones_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False
    )

    tiempo_respuesta = serializers.IntegerField(required=False, default=0)
    numero_orden = serializers.IntegerField(required=False, default=0)

    def validate(self, attrs):
        opcion_id = attrs.get("opcion_id", None)
        opciones_ids = attrs.get("opciones_ids", None)

        # normaliza
        if opciones_ids is None:
            opciones_ids = []
        attrs["opciones_ids"] = opciones_ids

        # ✅ Debe venir una respuesta
        if opcion_id is None and len(opciones_ids) == 0:
            raise serializers.ValidationError(
                "Debes enviar 'opcion_id' (single) o 'opciones_ids' (multi)."
            )

        # ✅ No permitir ambas con datos
        if opcion_id is not None and len(opciones_ids) > 0:
            raise serializers.ValidationError(
                "Envía SOLO 'opcion_id' o SOLO 'opciones_ids', no ambos."
            )

        return attrs


class FinalizarIntentoSerializer(serializers.Serializer):
    estado = serializers.ChoiceField(
        choices=[x[0] for x in IntentoExamen.ESTADOS],
        required=False,
        default="COMPLETADO",
    )
