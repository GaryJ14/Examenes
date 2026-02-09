# ============================================
# Aplicaciones/analisis/views.py
# ============================================
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status, permissions
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

from .models import IntentoExamen
from .serializers import (
    IntentoExamenSerializer,
    CrearIntentoExamenSerializer,
    GuardarRespuestaSerializer,
    RespuestaEstudianteSerializer,
    FinalizarIntentoSerializer,
)
from .services import guardar_y_evaluar_respuesta, finalizar_intento


def _get_user_id(request):
    """
    ✅ Ajusta aquí si tu auth usa otro campo.
    """
    return getattr(request.user, "id_usuario", None) or getattr(request.user, "id", None)


class ListaCrearIntentosView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = IntentoExamen.objects.all()

        estudiante_id = request.query_params.get("estudiante_id")
        examen_id = request.query_params.get("examen_id")
        estado = request.query_params.get("estado")

        if estudiante_id:
            qs = qs.filter(estudiante_id=estudiante_id)
        if examen_id:
            qs = qs.filter(examen_id=examen_id)
        if estado:
            qs = qs.filter(estado=estado)

        return Response({
            "total": qs.count(),
            "intentos": IntentoExamenSerializer(qs, many=True).data
        })

    def post(self, request):
        serializer = CrearIntentoExamenSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        intento = serializer.save(estado="INICIADO")
        return Response(IntentoExamenSerializer(intento).data, status=status.HTTP_201_CREATED)


class DetalleIntentoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        intento = get_object_or_404(IntentoExamen, id_intento=id)

        user_id = _get_user_id(request)

        # ✅ si no manejas roles, restringe por dueño del intento
        if user_id is not None and int(intento.estudiante_id) != int(user_id):
            raise PermissionDenied("No tienes permiso para ver este intento.")

        return Response(IntentoExamenSerializer(intento).data, status=status.HTTP_200_OK)


class GuardarRespuestaView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        intento = get_object_or_404(IntentoExamen, id_intento=id)

        user_id = _get_user_id(request)

        # ✅ seguridad: solo el dueño puede guardar
        if user_id is not None and int(intento.estudiante_id) != int(user_id):
            raise PermissionDenied("No tienes permiso para guardar respuestas en este intento.")

        # ✅ no permitir guardar si el intento ya finalizó
        if intento.estado in ["COMPLETADO", "EXPULSADO", "ABANDONADO", "TIEMPO_AGOTADO"]:
            return Response(
                {"detail": f"No se puede guardar respuestas. Intento en estado {intento.estado}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        ser = GuardarRespuestaSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            resp = guardar_y_evaluar_respuesta(intento, ser.validated_data)
            return Response(
                {
                    "mensaje": "Respuesta guardada y evaluada",
                    "respuesta": RespuestaEstudianteSerializer(resp).data,
                },
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"detail": "Error guardando respuesta", "error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class FinalizarIntentoView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, id):
        intento = get_object_or_404(IntentoExamen, id_intento=id)

        user_id = _get_user_id(request)

        # ✅ seguridad: solo el dueño puede finalizar
        if user_id is not None and int(intento.estudiante_id) != int(user_id):
            raise PermissionDenied("No tienes permiso para finalizar este intento.")

        ser = FinalizarIntentoSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            intento = finalizar_intento(intento, estado=ser.validated_data.get("estado", "COMPLETADO"))
            return Response(
                {
                    "mensaje": "Intento finalizado",
                    "intento": IntentoExamenSerializer(intento).data
                },
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"detail": "Error finalizando intento", "error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
