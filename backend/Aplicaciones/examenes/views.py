# ============================================
# Aplicaciones/examenes/views.py
# (COMPLETO y listo para usar)
# ============================================
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.shortcuts import get_object_or_404

from .models import Materia, Examen, Pregunta
from .serializers import MateriaSerializer, ExamenSerializer, PreguntaSerializer

from .ia_generation import generate_and_persist_exam


def is_admin(user):
    return getattr(user, "rol", None) == "ADMIN"


def is_docente(user):
    return getattr(user, "rol", None) == "DOCENTE"


def is_estudiante(user):
    return getattr(user, "rol", None) == "ESTUDIANTE"


def _user_id(user):
    # soporta distintos modelos de usuario
    return getattr(user, "id_usuario", None) or getattr(user, "id", None)


def can_manage_exam(user, examen: Examen):
    """
    Admin: siempre
    Docente: solo si es el creador
    Estudiante: nunca
    """
    if is_admin(user):
        return True
    if is_docente(user) and _user_id(user) == examen.docente_id:
        return True
    return False


def _parse_int(param_name: str, value: str):
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValidationError({param_name: "Debe ser un entero."})


# =========================================================
# MATERIAS
# =========================================================
class MateriasView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Materia.objects.all().order_by("nombre")
        serializer = MateriaSerializer(qs, many=True)
        return Response({"total": qs.count(), "materias": serializer.data})

    def post(self, request):
        if not (is_admin(request.user) or is_docente(request.user)):
            raise PermissionDenied("No tienes permiso para crear materias.")

        serializer = MateriaSerializer(data=request.data)
        if serializer.is_valid():
            materia = serializer.save()
            return Response(MateriaSerializer(materia).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MateriasConExamenesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        materias = Materia.objects.filter(activo=True).order_by("nombre")

        resultado = []
        for materia in materias:
            examenes = (
                Examen.objects.select_related("materia")
                .filter(materia=materia)
                .order_by("-id_examen")
            )

            # IMPORTANTE: estudiante solo ve ACTIVO
            if is_estudiante(request.user):
                examenes = examenes.filter(estado="ACTIVO")

            resultado.append(
                {
                    "id_materia": materia.id_materia,
                    "nombre": materia.nombre,
                    "examenes": ExamenSerializer(examenes, many=True).data,
                }
            )

        return Response(resultado)

class ExamenesPorMateriaView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, materia_id):
        # valida que exista la materia (si no, 404)
        materia = get_object_or_404(Materia, id_materia=materia_id)

        examenes = (
            Examen.objects.select_related("materia")
            .filter(materia_id=materia.id_materia)
            .order_by("-id_examen")
        )

        # estudiante solo ve ACTIVO (esto oculta PUBLICADO)
        if is_estudiante(request.user):
            examenes = examenes.filter(estado="ACTIVO")

        # opcional: filtrar por estado en query param
        estado = request.query_params.get("estado")
        if estado:
            if is_estudiante(request.user) and estado != "ACTIVO":
                raise PermissionDenied("No tienes permiso para ver exámenes no habilitados.")
            examenes = examenes.filter(estado=estado)

        serializer = ExamenSerializer(examenes, many=True)
        return Response(
            {
                "materia": MateriaSerializer(materia).data,
                "total": examenes.count(),
                "examenes": serializer.data,
            }
        )
class DetalleMateriaView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, id):
        materia = get_object_or_404(Materia, id_materia=id)

        # solo ADMIN o DOCENTE
        if not (is_admin(request.user) or is_docente(request.user)):
            raise PermissionDenied("No tienes permiso para modificar materias.")

        serializer = MateriaSerializer(materia, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# =========================================================
# EXÁMENES
# =========================================================
class ListaExamenesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        examenes = Examen.objects.select_related("materia").all()

        # filtrar por materia
        materia_id = request.query_params.get("materia_id")
        if materia_id:
            materia_id = _parse_int("materia_id", materia_id)
            examenes = examenes.filter(materia_id=materia_id)

        # estudiante solo ve ACTIVO (esto puede ocultar tu examen 26 si no está ACTIVO)
        if is_estudiante(request.user):
            examenes = examenes.filter(estado="ACTIVO")

        # filtrar por estado
        estado = request.query_params.get("estado")
        if estado:
            # estudiante no puede pedir estados distintos a ACTIVO
            if is_estudiante(request.user) and estado != "ACTIVO":
                raise PermissionDenied("No tienes permiso para ver exámenes no habilitados.")
            examenes = examenes.filter(estado=estado)

        examenes = examenes.order_by("-id_examen")

        serializer = ExamenSerializer(examenes, many=True)
        return Response({"total": examenes.count(), "examenes": serializer.data})


class CrearExamenView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not (is_admin(request.user) or is_docente(request.user)):
            raise PermissionDenied("No tienes permiso para crear exámenes.")

        data = request.data.copy()
        data["docente_id"] = _user_id(request.user)
        data["docente_nombre"] = getattr(request.user, "nombre_completo", "Docente")

        serializer = ExamenSerializer(data=data)
        if serializer.is_valid():
            examen = serializer.save()
            return Response(ExamenSerializer(examen).data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DetalleExamenView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        examen = get_object_or_404(Examen, id_examen=id)

        # estudiante no ve exámenes no activos
        if is_estudiante(request.user) and examen.estado != "ACTIVO":
            raise PermissionDenied("Este examen aún no está habilitado.")

        serializer = ExamenSerializer(examen)
        return Response(serializer.data)

    def put(self, request, id):
        examen = get_object_or_404(Examen, id_examen=id)

        if not can_manage_exam(request.user, examen):
            raise PermissionDenied("No tienes permiso para editar este examen.")

        serializer = ExamenSerializer(examen, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, id):
        examen = get_object_or_404(Examen, id_examen=id)

        if not can_manage_exam(request.user, examen):
            raise PermissionDenied("No tienes permiso para eliminar este examen.")

        examen.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# =========================================================
# PREGUNTAS
# =========================================================
class PreguntasExamenView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, examen_id):
        examen = get_object_or_404(Examen, id_examen=examen_id)

        if is_estudiante(request.user) and examen.estado != "ACTIVO":
            raise PermissionDenied("Este examen aún no está habilitado.")

        preguntas = Pregunta.objects.filter(examen=examen).order_by("orden")
        serializer = PreguntaSerializer(preguntas, many=True)
        return Response({"total": preguntas.count(), "preguntas": serializer.data})

    def post(self, request, examen_id):
        examen = get_object_or_404(Examen, id_examen=examen_id)

        if not can_manage_exam(request.user, examen):
            raise PermissionDenied("No tienes permiso para agregar preguntas a este examen.")

        serializer = PreguntaSerializer(data=request.data)
        if serializer.is_valid():
            pregunta = serializer.save(examen=examen)
            return Response(PreguntaSerializer(pregunta).data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DetallePreguntaView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, examen_id, pregunta_id):
        examen = get_object_or_404(Examen, id_examen=examen_id)

        if not can_manage_exam(request.user, examen):
            raise PermissionDenied("No tienes permiso para editar preguntas de este examen.")

        pregunta = get_object_or_404(Pregunta, id_pregunta=pregunta_id, examen=examen)

        serializer = PreguntaSerializer(pregunta, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            pregunta.refresh_from_db()
            return Response(PreguntaSerializer(pregunta).data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, examen_id, pregunta_id):
        examen = get_object_or_404(Examen, id_examen=examen_id)

        if not can_manage_exam(request.user, examen):
            raise PermissionDenied("No tienes permiso para eliminar preguntas de este examen.")

        pregunta = get_object_or_404(Pregunta, id_pregunta=pregunta_id, examen=examen)
        pregunta.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# =========================================================
# GENERACIÓN IA
# =========================================================
class GenerarExamenIAView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, examen_id):
        examen = get_object_or_404(Examen, id_examen=examen_id)

        if not can_manage_exam(request.user, examen):
            raise PermissionDenied("No tienes permiso para generar este examen con IA.")

        params = request.data or {}

        try:
            examen = generate_and_persist_exam(examen, params)
            return Response(ExamenSerializer(examen).data, status=status.HTTP_201_CREATED)

        except ValidationError as e:
            examen.estado = "ERROR_GENERACION"
            examen.save(update_fields=["estado"])
            raise e
