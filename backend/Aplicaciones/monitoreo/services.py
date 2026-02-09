# ============================================
# Aplicaciones/monitoreo/services.py
# ============================================
# ✅ Anti-spam en backend (opcional pero recomendado):
# - Si ya existe una Advertencia del MISMO tipo en los últimos X segundos,
#   NO se crea otra.
# - Esto evita expulsiones por repetición rápida aunque el frontend falle.
# ============================================

from django.db import transaction
from django.utils import timezone
from datetime import timedelta

from .models import Advertencia, Expulsion, RegistroMonitoreo, ConfiguracionMonitoreo
from Aplicaciones.analisis.models import IntentoExamen

EVENTO_A_ADVERTENCIA = {
    "SIN_ROSTRO":             ("AUSENCIA",               "MODERADO"),
    "FUERA_DE_ENCUADRE":      ("FUERA_DE_ENCUADRE",      "MODERADO"),
    "MULTIPLES_ROSTROS":      ("MULTIPLES_PERSONAS",     "GRAVE"),
    "MIRADA_DESVIADA":        ("MIRADA_DESVIADA",        "MODERADO"),
    "OJOS_CERRADOS":          ("OJOS_CERRADOS",          "LEVE"),
    "CAMBIO_PESTAÑA":         ("CAMBIO_VENTANA",         "MODERADO"),
    "PANTALLA_COMPLETA_OFF":  ("COMPORTAMIENTO_SOSPECHOSO", "GRAVE"),
    "CONEXION_PERDIDA":       ("PERDIDA_CONEXION",       "LEVE"),
}

DEFAULT_MAX_ADVERTENCIAS = 3

# ✅ Ventana para evitar duplicados del mismo tipo (segundos)
DUPLICATE_WINDOW_SECONDS = 20


def _get_max_advertencias(examen_id: int | None) -> int:
    if not examen_id:
        return DEFAULT_MAX_ADVERTENCIAS
    cfg = ConfiguracionMonitoreo.objects.filter(examen_id=examen_id).first()
    if not cfg:
        return DEFAULT_MAX_ADVERTENCIAS
    return int(cfg.max_advertencias or DEFAULT_MAX_ADVERTENCIAS)


def _set_intento_expulsado(intento: IntentoExamen):
    ahora = timezone.now()
    intento.estado = "EXPULSADO"
    intento.fecha_fin = ahora
    if intento.fecha_inicio:
        intento.tiempo_total = int((ahora - intento.fecha_inicio).total_seconds())
    intento.save(update_fields=["estado", "fecha_fin", "tiempo_total", "fecha_actualizacion"])


@transaction.atomic
def procesar_evento_y_reglas(
    evento: RegistroMonitoreo,
    *,
    estudiante_nombre: str = "",
    examen_id: int | None = None,
    examen_titulo: str = "",
    docente_id: int | None = None
):
    result = {
        "advertencia_creada": None,
        "expulsion_creada":   None,
        "intento_actualizado": False,
        "errors":             [],
    }

    intento = IntentoExamen.objects.filter(id_intento=evento.intento_id).first()

    # Guard: ya existe expulsión o ya está expulsado
    if Expulsion.objects.filter(intento_id=evento.intento_id).exists():
        result["expulsion_creada"] = Expulsion.objects.get(intento_id=evento.intento_id)
        return result

    if intento and intento.estado == "EXPULSADO":
        return result

    # ¿Este evento genera advertencia?
    mapping = EVENTO_A_ADVERTENCIA.get(evento.tipo_evento)
    if not mapping:
        return result

    tipo_adv, nivel_adv = mapping

    est_nombre = estudiante_nombre or (getattr(intento, "estudiante_nombre", "") if intento else "") or ""
    ex_id      = int(examen_id or (getattr(intento, "examen_id", 0) if intento else 0) or 0) or None
    ex_titulo  = examen_titulo or (getattr(intento, "examen_titulo", "") if intento else "") or ""

    # ✅ Anti-duplicados: si ya hubo advertencia igual recientemente, no crear otra
    try:
        recent = Advertencia.objects.filter(
            intento_id=evento.intento_id,
            tipo=tipo_adv,
            fecha__gte=timezone.now() - timedelta(seconds=DUPLICATE_WINDOW_SECONDS),
        ).exists()

        if recent:
            return result
    except Exception as e:
        result["errors"].append({"duplicate_check_error": str(e)})
        # si falla el check, seguimos para no romper flujo

    # 1) Crear Advertencia
    try:
        adv = Advertencia.objects.create(
            intento_id=evento.intento_id,
            estudiante_id=evento.estudiante_id,
            estudiante_nombre=est_nombre,
            tipo=tipo_adv,
            nivel=nivel_adv,
            descripcion=(evento.detalles or {}).get("msg") or f"Evento: {evento.tipo_evento}",
            confianza=(evento.confianza_algoritmo or 0),
            evidencia_url=evento.snapshot_url or "",
            metadata={
                "tipo_evento":  evento.tipo_evento,
                "detalles":     evento.detalles or {},
                "examen_id":    ex_id,
                "examen_titulo": ex_titulo,
                "docente_id":   docente_id,
            },
            resuelta=False,
            notas_resolucion="",
        )
        result["advertencia_creada"] = adv
    except Exception as e:
        result["errors"].append({"advertencia_create_error": str(e)})
        return result

    # 2) Contar advertencias y verificar límite
    total_adv = Advertencia.objects.filter(intento_id=evento.intento_id).count()
    max_adv   = _get_max_advertencias(ex_id)

    if total_adv < max_adv:
        return result

    # 3) Crear Expulsión
    try:
        if intento:
            _set_intento_expulsado(intento)
            result["intento_actualizado"] = True
    except Exception as e:
        result["errors"].append({"intento_expulsado_error": str(e)})

    try:
        last_evidences = list(
            Advertencia.objects.filter(intento_id=evento.intento_id)
            .order_by("-fecha")
            .values_list("evidencia_url", flat=True)[:3]
        )
        last_evidences = [u for u in last_evidences if u]

        exp = Expulsion.objects.create(
            intento_id=evento.intento_id,
            estudiante_id=evento.estudiante_id,
            estudiante_nombre=est_nombre,
            examen_id=int(ex_id or 0),
            examen_titulo=ex_titulo,
            motivo="MAX_ADVERTENCIAS",
            descripcion=f"Expulsión automática: alcanzó {total_adv}/{max_adv} advertencias.",
            advertencias_previas=total_adv,
            evidencias=last_evidences,
            calificacion_asignada=0,
            docente_notificado=False,
            admin_notificado=False,
        )
        result["expulsion_creada"] = exp
    except Exception as e:
        result["errors"].append({"expulsion_create_error": str(e)})

    return result
