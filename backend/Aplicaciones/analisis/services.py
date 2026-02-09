# ============================================
# Aplicaciones/analisis/services.py
# ============================================
from decimal import Decimal
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .models import IntentoExamen, RespuestaEstudiante
from Aplicaciones.examenes.models import Pregunta, OpcionRespuesta, Examen


def _get_pregunta_info(pregunta_id: int):
    """
    Obtiene info real de la pregunta desde Examenes.
    """
    p = Pregunta.objects.select_related("examen").get(id_pregunta=pregunta_id)
    return {
        "pregunta": p,
        "enunciado": p.enunciado,
        "ponderacion": p.ponderacion,
        "tipo": p.tipo,
        "examen_id": p.examen_id,
        "examen_titulo": p.examen.titulo,
        "puntaje_total_examen": p.examen.puntaje_total,
    }


def _opcion_pk_value(o: OpcionRespuesta) -> int:
    """
    Devuelve el id real de la opción.
    Soporta modelos que usen id_opcion o id.
    """
    val = getattr(o, "id_opcion", None)
    if val is None:
        val = getattr(o, "id", None)
    return int(val)


def _get_opciones_correctas_ids(pregunta_id: int):
    """
    Devuelve [id_opcion, ...] correctas.
    Hace fallback por si tu modelo usa pk 'id' y no 'id_opcion'.
    También soporta FK pregunta con distintas rutas.
    """
    qs = None

    # Caso común: FK 'pregunta' => columna pregunta_id
    try:
        qs = OpcionRespuesta.objects.filter(pregunta_id=pregunta_id, es_correcta=True)
        list(qs[:1])  # fuerza evaluación temprana
    except Exception:
        qs = None

    # Fallback
    if qs is None:
        qs = OpcionRespuesta.objects.filter(pregunta__id_pregunta=pregunta_id, es_correcta=True)

    return [_opcion_pk_value(o) for o in qs]


def _get_opcion_texto(pregunta_id: int, opcion_id: int) -> str:
    """
    Intenta traer el texto real de la opción (soporta texto / opcion_texto).
    """
    if not opcion_id:
        return ""

    op = None
    try:
        op = OpcionRespuesta.objects.filter(pregunta_id=pregunta_id).filter(
            **({"id_opcion": opcion_id} if hasattr(OpcionRespuesta, "id_opcion") else {"id": opcion_id})
        ).first()
    except Exception:
        op = None

    if not op:
        return ""

    return getattr(op, "texto", None) or getattr(op, "opcion_texto", None) or ""


@transaction.atomic
def guardar_y_evaluar_respuesta(intento: IntentoExamen, payload: dict) -> RespuestaEstudiante:
    """
    Crea/actualiza la respuesta del estudiante y la evalúa.
    """
    pregunta_id = int(payload["pregunta_id"])

    opcion_id = payload.get("opcion_id", None)
    if opcion_id in ("", "null", "None", 0, "0"):
        opcion_id = None
    if opcion_id is not None:
        opcion_id = int(opcion_id)

    opciones_ids = payload.get("opciones_ids", []) or []
    opciones_ids = [int(x) for x in opciones_ids if str(x).strip() not in ("", "null", "None")]

    tiempo_respuesta = int(payload.get("tiempo_respuesta", 0) or 0)
    numero_orden = int(payload.get("numero_orden", 0) or 0)

    info = _get_pregunta_info(pregunta_id)

    # ✅ seguridad: el intento debe corresponder al examen de esa pregunta
    if int(intento.examen_id) != int(info["examen_id"]):
        raise ValueError("La pregunta no pertenece al examen de este intento.")

    # Si es single, asegúrate de que opciones_ids sea []
    if opcion_id is not None:
        opciones_ids = []

    opcion_texto = _get_opcion_texto(pregunta_id, opcion_id) if opcion_id else ""

    # Upsert: una respuesta por intento + pregunta
    respuesta, _created = RespuestaEstudiante.objects.update_or_create(
        intento=intento,
        pregunta_id=pregunta_id,
        defaults={
            "pregunta_enunciado": info["enunciado"],
            "pregunta_ponderacion": info["ponderacion"],
            "opcion_id": opcion_id,
            "opciones_ids": opciones_ids,
            "opcion_texto": opcion_texto,
            "tiempo_respuesta": tiempo_respuesta,
            "numero_orden": numero_orden,
        },
    )

    # ✅ Evaluar con ids correctos
    correctas_ids = _get_opciones_correctas_ids(pregunta_id)
    respuesta.evaluar_respuesta(correctas_ids)  # setea es_correcta y puntaje_obtenido

    # Actualiza metadata del intento (sin finalizar)
    intento.estado = "EN_PROGRESO"
    intento.preguntas_totales = int(Pregunta.objects.filter(examen_id=intento.examen_id).count())
    intento.preguntas_respondidas = intento.respuestas.count()
    intento.save(update_fields=["estado", "preguntas_totales", "preguntas_respondidas", "fecha_actualizacion"])

    return respuesta


@transaction.atomic
def finalizar_intento(intento: IntentoExamen, estado: str = "COMPLETADO") -> IntentoExamen:
    """
    Finaliza el intento, recalcula puntajes y calificación.
    ✅ calificacion_final = PUNTAJE FINAL (en puntos), NO porcentaje.
    """
    intento.estado = estado
    intento.fecha_fin = timezone.now()

    if intento.fecha_inicio:
        intento.tiempo_total = int((intento.fecha_fin - intento.fecha_inicio).total_seconds())

    respuestas = intento.respuestas.all()

    intento.preguntas_totales = int(Pregunta.objects.filter(examen_id=intento.examen_id).count())
    intento.preguntas_respondidas = respuestas.count()
    intento.preguntas_correctas = respuestas.filter(es_correcta=True).count()
    intento.preguntas_incorrectas = respuestas.filter(es_correcta=False).count()

    total_obtenido = respuestas.aggregate(total=Sum("puntaje_obtenido"))["total"] or Decimal("0.00")
    intento.puntaje_obtenido = total_obtenido

    ex = Examen.objects.filter(id_examen=intento.examen_id).first()
    if ex:
        if ex.puntaje_total is None or ex.puntaje_total == 0:
            ex.calcular_puntaje_total()
        intento.puntaje_total = ex.puntaje_total
    else:
        if intento.puntaje_total is None:
            intento.puntaje_total = Decimal("0.00")

    # ✅ CAMBIO CLAVE:
    # En vez de guardar porcentaje, guarda el PUNTAJE FINAL (en puntos).
    # Ej: si obtuvo 2/3 => calificacion_final = 2.00
    intento.calificacion_final = Decimal(intento.puntaje_obtenido or 0)

    # Normaliza decimales
    intento.calificacion_final = Decimal(intento.calificacion_final).quantize(Decimal("0.01"))
    intento.puntaje_obtenido = Decimal(intento.puntaje_obtenido).quantize(Decimal("0.01"))
    intento.puntaje_total = Decimal(intento.puntaje_total or 0).quantize(Decimal("0.01"))

    intento.save(update_fields=[
        "estado", "fecha_fin", "tiempo_total",
        "preguntas_totales", "preguntas_respondidas",
        "preguntas_correctas", "preguntas_incorrectas",
        "puntaje_obtenido", "puntaje_total", "calificacion_final",
        "fecha_actualizacion"
    ])

    return intento
