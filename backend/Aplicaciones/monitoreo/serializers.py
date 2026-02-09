# ============================================
# Aplicaciones/monitoreo/serializers.py
# ============================================
from rest_framework import serializers
from .models import RegistroMonitoreo, Advertencia, Expulsion, ConfiguracionMonitoreo


class RegistroMonitoreoSerializer(serializers.ModelSerializer):
    class Meta:
        model = RegistroMonitoreo
        fields = [
            "id_registro",
            "intento_id",
            "estudiante_id",
            "tipo_evento",
            "confianza_algoritmo",
            "detalles",
            "snapshot_url",
            "duracion_evento",
            "timestamp",
        ]
        read_only_fields = ["id_registro", "timestamp"]


class AdvertenciaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Advertencia
        fields = [
            "id_advertencia",
            "intento_id",
            "estudiante_id",
            "estudiante_nombre",
            "tipo",
            "nivel",
            "descripcion",
            "confianza",
            "evidencia_url",
            "metadata",
            "resuelta",
            "notas_resolucion",
            "fecha",
        ]
        read_only_fields = ["id_advertencia", "fecha"]


class ConfiguracionMonitoreoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracionMonitoreo
        fields = "__all__"
        read_only_fields = ["id_config", "fecha_creacion", "fecha_actualizacion"]


class ExpulsionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expulsion
        fields = "__all__"
        read_only_fields = ["id_expulsion", "fecha"]
