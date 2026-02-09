from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from .models import Reporte, PlantillaReporte
from .serializers import (
    ReporteSerializer,
    CrearReporteSerializer,
    PlantillaReporteSerializer
)
from .services import generar_reporte


class ListaCrearReportesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Reporte.objects.all()

        tipo = request.query_params.get('tipo')
        estado = request.query_params.get('estado')
        examen_id = request.query_params.get('examen_id')
        estudiante_id = request.query_params.get('estudiante_id')
        intento_id = request.query_params.get('intento_id')
        formato = request.query_params.get('formato')

        if tipo:
            qs = qs.filter(tipo=tipo)
        if estado:
            qs = qs.filter(estado=estado)
        if formato:
            qs = qs.filter(formato=formato)
        if examen_id:
            qs = qs.filter(examen_id=examen_id)
        if estudiante_id:
            qs = qs.filter(estudiante_id=estudiante_id)
        if intento_id:
            qs = qs.filter(intento_id=intento_id)

        serializer = ReporteSerializer(qs, many=True)
        return Response({"total": qs.count(), "reportes": serializer.data})

    def post(self, request):
        serializer = CrearReporteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        reporte = serializer.save(
            estado='GENERANDO',
            solicitado_por_id=getattr(request.user, 'id_usuario', getattr(request.user, "id", None)),
            solicitado_por_nombre=getattr(request.user, 'nombre_completo', str(request.user)),
            solicitado_por_rol=getattr(request.user, 'rol', 'UNKNOWN'),
        )
        return Response(ReporteSerializer(reporte).data, status=status.HTTP_201_CREATED)


class DetalleReporteView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        reporte = get_object_or_404(Reporte, id_reporte=id)
        return Response(ReporteSerializer(reporte).data)


class GenerarReporteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, id):
        reporte = get_object_or_404(Reporte, id_reporte=id)

        try:
            reporte = generar_reporte(reporte, request)

            # ✅ asegurar que devolvemos lo persistido
            reporte.refresh_from_db()

            return Response(ReporteSerializer(reporte).data, status=status.HTTP_200_OK)
        except Exception as e:
            # si tienes marcar_error en modelo, úsalo; si no, set manual:
            try:
                reporte.marcar_error(str(e))
            except Exception:
                reporte.estado = "ERROR"
                reporte.error_mensaje = str(e)
                reporte.save(update_fields=["estado", "error_mensaje"])

            return Response(
                {"detail": "Error generando reporte", "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# -------------------------
# Plantillas
# -------------------------
class ListaCrearPlantillasView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = PlantillaReporte.objects.all()
        tipo = request.query_params.get('tipo_reporte')
        if tipo:
            qs = qs.filter(tipo_reporte=tipo)
        serializer = PlantillaReporteSerializer(qs, many=True)
        return Response({"total": qs.count(), "plantillas": serializer.data})

    def post(self, request):
        serializer = PlantillaReporteSerializer(data=request.data)
        if serializer.is_valid():
            plantilla = serializer.save()
            return Response(PlantillaReporteSerializer(plantilla).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DetallePlantillaView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        plantilla = get_object_or_404(PlantillaReporte, id_plantilla=id)
        return Response(PlantillaReporteSerializer(plantilla).data)

    def put(self, request, id):
        plantilla = get_object_or_404(PlantillaReporte, id_plantilla=id)
        serializer = PlantillaReporteSerializer(plantilla, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, id):
        plantilla = get_object_or_404(PlantillaReporte, id_plantilla=id)
        plantilla.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
