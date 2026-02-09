# ============================================
# Aplicaciones/monitoreo/views.py
# ============================================
import time
import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser
from django.shortcuts import get_object_or_404
from django.db.models import Count

from .models import RegistroMonitoreo, Advertencia, Expulsion, ConfiguracionMonitoreo
from .serializers import (
    RegistroMonitoreoSerializer,
    AdvertenciaSerializer,
    ExpulsionSerializer,
    ConfiguracionMonitoreoSerializer,
)
from .services import procesar_evento_y_reglas
from . import detection_service as ds  # ✅ usar ds para health y estado global
from Aplicaciones.analisis.models import IntentoExamen

logger = logging.getLogger("django")


# ============================================================
# EVENTOS
# ============================================================

class CrearListarEventosView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = RegistroMonitoreoSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        # 1) Guardar el evento recibido (INICIO_SESION, MIRADA_DESVIADA, etc.)
        evento = ser.save()

        detalles      = request.data.get("detalles") or {}
        est_nombre    = detalles.get("estudiante_nombre", "")
        examen_id     = detalles.get("examen_id")
        examen_titulo = detalles.get("examen_titulo", "")

        # 2) Procesar reglas (crear advertencia / expulsión)
        resultado = procesar_evento_y_reglas(
            evento,
            estudiante_nombre=est_nombre,
            examen_id=examen_id,
            examen_titulo=examen_titulo,
        )

        # ---------------------------------------------------------
        # ✅ Si se expulsó, registrar un evento EXPULSION REAL
        # (para que el reporte por "eventos" lo muestre)
        # ---------------------------------------------------------
        expulsion_obj = resultado.get("expulsion_creada")
        intento_expulsado = bool(resultado.get("intento_actualizado")) or bool(expulsion_obj)

        expulsion_evento = None
        if intento_expulsado:
            # Evitar duplicar EXPULSION si llegan más eventos luego
            existe = RegistroMonitoreo.objects.filter(
                intento_id=evento.intento_id,
                estudiante_id=evento.estudiante_id,
                tipo_evento="EXPULSION",
            ).exists()

            if not existe:
                # Intentar obtener max_advertencias real (si existe config)
                max_adv = 3
                try:
                    if examen_id:
                        cfg = ConfiguracionMonitoreo.objects.filter(examen_id=examen_id).first()
                        if cfg and cfg.max_advertencias:
                            max_adv = int(cfg.max_advertencias)
                except Exception:
                    pass

                expulsion_evento = RegistroMonitoreo.objects.create(
                    intento_id=evento.intento_id,
                    estudiante_id=evento.estudiante_id,
                    tipo_evento="EXPULSION",
                    confianza_algoritmo=100,
                    detalles={
                        "msg": "Examen expulsado por alcanzar el máximo de advertencias.",
                        "causa": evento.tipo_evento,
                        "max_advertencias": max_adv,
                        "estudiante_nombre": est_nombre,
                        "examen_id": examen_id,
                        "examen_titulo": examen_titulo,
                    },
                    snapshot_url=evento.snapshot_url or "",
                    duracion_evento=0,
                )

        payload = {
            "evento": RegistroMonitoreoSerializer(evento).data,
            "advertencia_creada": (
                AdvertenciaSerializer(resultado["advertencia_creada"]).data
                if resultado.get("advertencia_creada") else None
            ),
            "expulsion_creada": (
                ExpulsionSerializer(resultado["expulsion_creada"]).data
                if resultado.get("expulsion_creada") else None
            ),
            # ✅ importante: esto ahora refleja expulsión por "expulsion_creada" o "intento_actualizado"
            "intento_expulsado": intento_expulsado,
            # ✅ extra: si se creó el evento EXPULSION, lo devolvemos
            "expulsion_evento": (
                RegistroMonitoreoSerializer(expulsion_evento).data if expulsion_evento else None
            ),
            "errors": resultado.get("errors", []),
        }
        return Response(payload, status=status.HTTP_201_CREATED)


# ============================================================
# ADVERTENCIAS
# ============================================================

class CrearListarAdvertenciasView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Advertencia.objects.all()

        intento_id    = request.query_params.get("intento_id")
        estudiante_id = request.query_params.get("estudiante_id")
        resuelta      = request.query_params.get("resuelta")

        if intento_id:
            qs = qs.filter(intento_id=intento_id)
        if estudiante_id:
            qs = qs.filter(estudiante_id=estudiante_id)
        if resuelta in ("true", "false"):
            qs = qs.filter(resuelta=(resuelta == "true"))

        ser = AdvertenciaSerializer(qs, many=True)
        return Response({"total": qs.count(), "advertencias": ser.data})


# ============================================================
# RESUMEN DE INTENTO
# ============================================================

class ResumenIntentoMonitoreoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, intento_id):
        eventos      = RegistroMonitoreo.objects.filter(intento_id=intento_id)
        advertencias = Advertencia.objects.filter(intento_id=intento_id)

        adv_tipo = list(
            advertencias.values("tipo")
            .annotate(cantidad=Count("id_advertencia"))
            .order_by("-cantidad")
        )

        ev_tipo = list(
            eventos.values("tipo_evento")
            .annotate(cantidad=Count("id_registro"))
            .order_by("-cantidad")
        )

        expulsion = Expulsion.objects.filter(intento_id=intento_id).first()
        intento   = IntentoExamen.objects.filter(id_intento=intento_id).first()

        hubo_expulsion = bool(expulsion) or (bool(intento) and intento.estado == "EXPULSADO")

        payload = {
            "intento_id":            int(intento_id),
            "total_eventos":         eventos.count(),
            "total_advertencias":    advertencias.count(),
            "advertencias_detalle":  adv_tipo,
            "eventos_monitoreo":     {x["tipo_evento"]: x["cantidad"] for x in ev_tipo},
            "hubo_expulsion":        hubo_expulsion,
            "motivo_expulsion":      expulsion.motivo if expulsion else "",
            "anomalias":             [],
        }
        return Response(payload)


# ============================================================
# CONFIGURACIÓN DE MONITOREO
# ============================================================

class ConfiguracionMonitoreoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = ConfiguracionMonitoreo.objects.all()
        examen_id = request.query_params.get("examen_id")
        if examen_id:
            qs = qs.filter(examen_id=examen_id)
        ser = ConfiguracionMonitoreoSerializer(qs, many=True)
        return Response({"total": qs.count(), "configuraciones": ser.data})

    def post(self, request):
        ser = ConfiguracionMonitoreoSerializer(data=request.data)
        if ser.is_valid():
            cfg = ser.save()
            return Response(
                ConfiguracionMonitoreoSerializer(cfg).data,
                status=status.HTTP_201_CREATED
            )
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)


class DetalleConfiguracionMonitoreoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        cfg = get_object_or_404(ConfiguracionMonitoreo, id_config=id)
        return Response(ConfiguracionMonitoreoSerializer(cfg).data)

    def put(self, request, id):
        cfg = get_object_or_404(ConfiguracionMonitoreo, id_config=id)
        ser = ConfiguracionMonitoreoSerializer(cfg, data=request.data, partial=True)
        if ser.is_valid():
            ser.save()
            return Response(ser.data)
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, id):
        cfg = get_object_or_404(ConfiguracionMonitoreo, id_config=id)
        cfg.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ============================================================
# DETECCIÓN FACIAL
# ============================================================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser])
def analizar_frame(request):
    """
    POST /api/monitoreo/analizar-frame/
    Recibe un frame (campo 'file') y retorna el análisis.
    """
    if "file" not in request.FILES:
        return Response({"error": "Se requiere el campo 'file'"}, status=400)

    uploaded = request.FILES["file"]

    if uploaded.content_type not in ("image/jpeg", "image/jpg", "image/png"):
        return Response({"error": "Solo JPEG o PNG"}, status=400)

    if uploaded.size > 2 * 1024 * 1024:
        return Response({"error": "Imagen demasiado grande (máx 2 MB)"}, status=400)

    try:
        jpeg_bytes = uploaded.read()
        t0 = time.perf_counter()

        # ✅ usar ds.analyze_frame (una sola fuente)
        result = ds.analyze_frame(jpeg_bytes)

        ms = round((time.perf_counter() - t0) * 1000, 1)
        result["processing_ms"] = ms

        logger.info(
            "[analizar-frame] user=%s faces=%d events=%s latency=%sms",
            getattr(request.user, "id_usuario", request.user.id),
            result.get("num_faces", 0),
            result.get("events", []),
            ms,
        )
        return Response(result, status=200)

    except Exception as e:
        logger.error("[analizar-frame] %s", str(e), exc_info=True)
        return Response({"error": f"Error de detección: {str(e)}"}, status=500)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def detection_health(request):
    """
    GET /api/monitoreo/detection-health/
    Verifica que el modelo esté cargado.
    """
    modelo = None
    if ds._initialized:
        if ds.USE_TASKS and ds._landmarker:
            modelo = "FaceLandmarker (Tasks API)"
        elif ds._face_mesh:
            modelo = "FaceMesh (Solutions)"

    return Response({
        "status": "ok" if modelo else "modelo no cargado",
        "modelo": modelo,
        "initialized": ds._initialized,
    })
