# ============================================
# Aplicaciones/examenes/serializers.py
# ============================================
from rest_framework import serializers
from .models import Materia, Examen, Pregunta, OpcionRespuesta


class MateriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Materia
        fields = ["id_materia", "nombre", "descripcion", "activo"]


class OpcionRespuestaSerializer(serializers.ModelSerializer):
    class Meta:
        model = OpcionRespuesta
        fields = ["id_opcion", "clave", "texto", "es_correcta", "orden"]


class PreguntaSerializer(serializers.ModelSerializer):
    opciones = OpcionRespuestaSerializer(many=True, required=False)

    class Meta:
        model = Pregunta
        fields = [
            "id_pregunta",
            "examen",
            "orden",
            "tipo",
            "dificultad",
            "tema",
            "resultado_aprendizaje",
            "enunciado",
            "ponderacion",
            "opciones",
            "respuesta_texto",
            "explicacion",
        ]
        read_only_fields = ["examen"]

    def create(self, validated_data):
        opciones_data = validated_data.pop("opciones", [])
        pregunta = Pregunta.objects.create(**validated_data)

        for idx, o in enumerate(opciones_data):
            OpcionRespuesta.objects.create(
                pregunta=pregunta,
                clave=o.get("clave", ""),
                texto=o.get("texto", ""),
                es_correcta=bool(o.get("es_correcta", False)),
                orden=int(o.get("orden", idx)),
            )
        return pregunta

    def update(self, instance, validated_data):
        opciones_data = validated_data.pop("opciones", None)

        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()

        if opciones_data is not None:
            instance.opciones.all().delete()
            for idx, o in enumerate(opciones_data):
                OpcionRespuesta.objects.create(
                    pregunta=instance,
                    clave=o.get("clave", ""),
                    texto=o.get("texto", ""),
                    es_correcta=bool(o.get("es_correcta", False)),
                    orden=int(o.get("orden", idx)),
                )
        return instance


class ExamenSerializer(serializers.ModelSerializer):
    materia = serializers.PrimaryKeyRelatedField(queryset=Materia.objects.all())
    preguntas = PreguntaSerializer(many=True, read_only=True)

    class Meta:
        model = Examen
        fields = [
            "id_examen",
            "materia",
            "titulo",
            "descripcion",
            "docente_id",
            "docente_nombre",
            "estado",
            "nivel",
            "idioma",
            "tags",
            "origen",
            "fecha_inicio",
            "fecha_fin",
            "duracion",
            "instrucciones",
            "intentos_permitidos",
            "mostrar_respuestas",
            "aleatorizar_preguntas",
            "aleatorizar_opciones",
            "requiere_camara",
            "puntaje_total",
            "parametros_generacion",
            "ia_metadata",
            "preguntas",
        ]
