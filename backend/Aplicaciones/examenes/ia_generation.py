# ============================================
# Aplicaciones/examenes/ia_generation.py
# ============================================
import json
from decimal import Decimal, ROUND_HALF_UP
from rest_framework.exceptions import ValidationError

from .models import Examen, Pregunta, OpcionRespuesta
from .llm_client import LLMClient


SCHEMA_PROMPT = """
Devuelve ÚNICAMENTE un JSON válido (sin markdown, sin explicaciones fuera del JSON).
Reglas:
- No inventes datos personales ni referencias reales inexistentes.
- Las preguntas deben ser claras, sin ambigüedad.
- No repitas preguntas.
- RESPETA EXACTAMENTE el esquema y las restricciones.
- El campo "correctas" debe contener las claves de opciones correctas (por ejemplo ["A"] o ["A","C"]).
- En "VERDADERO_FALSO" las opciones deben ser exactamente: A="Verdadero", B="Falso".
- La suma de ponderaciones debe ser exactamente igual a {puntaje_total}.

Esquema JSON (obligatorio):
{schema_json}

Ahora genera el examen con estos parámetros:
- materia: {materia}
- nivel: {nivel}
- idioma: {idioma}
- numero_preguntas: {numero_preguntas}
- distribucion_tipos: {distribucion_tipos}
- duracion_minutos: {duracion_minutos}
- puntaje_total: {puntaje_total}
- enfoque_tematico: {enfoque_tematico}
- estilo: {estilo}

Restricciones adicionales:
- Para OPCION_MULTIPLE: exactamente 4 opciones y 1 correcta.
- Para SELECCION_MULTIPLE: exactamente 4 opciones y 2 correctas.
- Para VERDADERO_FALSO: opciones A/B como se indicó y 1 correcta.
- Para RESPUESTA_CORTA: "opciones" debe ser [] y la respuesta va en "respuesta_texto".
- No uses preguntas que dependan de imágenes o enlaces.
""".strip()


SCHEMA_JSON = {
    "examen": {
        "titulo": "string",
        "descripcion": "string",
        "materia": "string",
        "nivel": "BASICO|INTERMEDIO|AVANZADO",
        "idioma": "ES|EN|PT",
        "duracion_minutos": "integer",
        "instrucciones": "string",
        "mostrar_respuestas": "boolean",
        "aleatorizar_preguntas": "boolean",
        "aleatorizar_opciones": "boolean",
        "requiere_camara": "boolean",
        "puntaje_total": "number",
        "tags": ["string"],
    },
    "preguntas": [
        {
            "orden": "integer",
            "tipo": "OPCION_MULTIPLE|SELECCION_MULTIPLE|VERDADERO_FALSO|RESPUESTA_CORTA",
            "dificultad": "FACIL|MEDIA|DIFICIL",
            "tema": "string",
            "resultado_aprendizaje": "string",
            "enunciado": "string",
            "ponderacion": "number",
            "opciones": [{"clave": "A", "texto": "string"}],
            "correctas": ["A"],
            "respuesta_texto": "string",
            "explicacion": "string",
        }
    ],
    "control_calidad": {
        "verificaciones": {
            "sin_preguntas_repetidas": "boolean",
            "ponderaciones_suman_puntaje_total": "boolean",
            "todas_las_preguntas_tienen_respuesta": "boolean",
        },
        "observaciones": "string",
    },
}


def build_prompt(examen: Examen, params: dict) -> str:
    materia_nombre = examen.materia.nombre
    params_full = {
        "materia": materia_nombre,
        "nivel": params.get("nivel", examen.nivel),
        "idioma": params.get("idioma", examen.idioma),
        "numero_preguntas": int(params.get("numero_preguntas", 10)),
        "distribucion_tipos": params.get("distribucion_tipos", {"OPCION_MULTIPLE": 10}),
        "duracion_minutos": int(params.get("duracion_minutos", examen.duracion)),
        "puntaje_total": float(params.get("puntaje_total", 10)),
        "enfoque_tematico": params.get("enfoque_tematico", []),
        "estilo": params.get("estilo", "tipo parcial universitario"),
        "schema_json": json.dumps(SCHEMA_JSON, ensure_ascii=False),
    }

    return SCHEMA_PROMPT.format(**params_full)


def _normalize_payload(payload: dict) -> dict:
    if not isinstance(payload, dict):
        return payload

    preguntas = payload.get("preguntas")
    if not isinstance(preguntas, list):
        return payload

    for p in preguntas:
        t = p.get("tipo")

        if t == "VERDADERO_FALSO":
            p["opciones"] = [
                {"clave": "A", "texto": "Verdadero"},
                {"clave": "B", "texto": "Falso"},
            ]
            corr = p.get("correctas", [])
            if not (isinstance(corr, list) and len(corr) == 1 and corr[0] in ("A", "B")):
                p["correctas"] = ["A"]
            p["respuesta_texto"] = ""

        if t == "RESPUESTA_CORTA":
            p["opciones"] = []
            if "correctas" not in p or p["correctas"] is None:
                p["correctas"] = []
            if "respuesta_texto" not in p:
                p["respuesta_texto"] = ""

    return payload


from rest_framework.exceptions import ValidationError

def _validate_payload(payload: dict, params_full: dict):
    if "examen" not in payload or "preguntas" not in payload:
        raise ValidationError("Payload inválido: falta 'examen' o 'preguntas'.")

    preguntas = payload.get("preguntas", [])
    if not isinstance(preguntas, list) or not preguntas:
        raise ValidationError("Payload inválido: 'preguntas' debe ser una lista no vacía.")

    # Validar suma ponderaciones
    puntaje_total = float(params_full.get("puntaje_total", 0))
    suma = sum(float(p.get("ponderacion", 0) or 0) for p in preguntas)
    if round(suma, 2) != round(puntaje_total, 2):
        raise ValidationError(f"La suma de ponderaciones ({suma}) no coincide con puntaje_total ({puntaje_total}).")

    # Validar preguntas repetidas
    enunciados = [str(p.get("enunciado", "")).strip().lower() for p in preguntas]
    if len(set(enunciados)) != len(enunciados):
        raise ValidationError("Hay preguntas repetidas (enunciado duplicado).")

    allowed_keys = {"A", "B", "C", "D"}

    for i, p in enumerate(preguntas, start=1):
        tipo = p.get("tipo")
        opciones = p.get("opciones", [])
        correctas = p.get("correctas", [])
        respuesta_texto = p.get("respuesta_texto", "")

        if tipo in ("OPCION_MULTIPLE", "SELECCION_MULTIPLE"):
            if not isinstance(opciones, list) or len(opciones) != 4:
                raise ValidationError(f"{tipo} requiere exactamente 4 opciones.")
            claves = [o.get("clave") for o in opciones]
            if claves != ["A", "B", "C", "D"]:
                raise ValidationError(f"{tipo} requiere claves exactamente A,B,C,D en orden.")
            if not isinstance(correctas, list):
                raise ValidationError(f"{tipo} requiere 'correctas' como lista.")
            if tipo == "OPCION_MULTIPLE" and len(correctas) != 1:
                raise ValidationError("OPCION_MULTIPLE requiere exactamente 1 correcta.")
            if tipo == "SELECCION_MULTIPLE" and len(correctas) != 2:
                raise ValidationError("SELECCION_MULTIPLE requiere exactamente 2 correctas.")
            if any(c not in allowed_keys for c in correctas):
                raise ValidationError(f"{tipo} tiene claves inválidas en 'correctas'.")

        elif tipo == "VERDADERO_FALSO":
            if not isinstance(opciones, list) or len(opciones) != 2:
                raise ValidationError("VERDADERO_FALSO requiere exactamente 2 opciones (A,B).")
            if opciones[0].get("clave") != "A" or opciones[0].get("texto") != "Verdadero":
                raise ValidationError('VERDADERO_FALSO requiere A="Verdadero".')
            if opciones[1].get("clave") != "B" or opciones[1].get("texto") != "Falso":
                raise ValidationError('VERDADERO_FALSO requiere B="Falso".')
            if not isinstance(correctas, list) or len(correctas) != 1 or correctas[0] not in ("A", "B"):
                raise ValidationError("VERDADERO_FALSO requiere exactamente 1 correcta (A o B).")

        elif tipo == "RESPUESTA_CORTA":
            if opciones not in ([], None):
                raise ValidationError("RESPUESTA_CORTA requiere 'opciones' = [].")
            if not isinstance(respuesta_texto, str) or not respuesta_texto.strip():
                raise ValidationError("RESPUESTA_CORTA requiere 'respuesta_texto' no vacío.")
            # correctas se ignora en este tipo (puede venir [] o no venir)

        else:
            raise ValidationError(f"Tipo de pregunta no soportado: {tipo} (pregunta #{i}).")


def _fix_ponderaciones_exactas(payload: dict, puntaje_total: Decimal) -> dict:
    """
    Ajusta ponderaciones para que sumen exacto, sin cambiar cantidad de preguntas.
    Estrategia: repartir equitativo y ajustar la última.
    """
    preguntas = payload.get("preguntas", [])
    n = len(preguntas)
    if n == 0:
        return payload

    base = (puntaje_total / Decimal(n)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    ponderaciones = [base for _ in range(n)]
    suma = sum(ponderaciones)

    diff = (puntaje_total - suma).quantize(Decimal("0.01"))
    ponderaciones[-1] = (ponderaciones[-1] + diff).quantize(Decimal("0.01"))

    for i, p in enumerate(preguntas):
        p["ponderacion"] = float(ponderaciones[i])

    return payload


def generate_exam_with_llm(examen: Examen, params: dict) -> dict:
    params_full = {
        "materia_id": examen.materia_id,
        "nivel": params.get("nivel", examen.nivel),
        "idioma": params.get("idioma", examen.idioma),
        "numero_preguntas": int(params.get("numero_preguntas", 10)),
        "distribucion_tipos": params.get("distribucion_tipos", {"OPCION_MULTIPLE": 10}),
        "duracion_minutos": int(params.get("duracion_minutos", examen.duracion)),
        "puntaje_total": float(params.get("puntaje_total", 10)),
        "enfoque_tematico": params.get("enfoque_tematico", []),
        "estilo": params.get("estilo", "tipo parcial universitario"),
        "tags": params.get("tags", []),
    }

    prompt = build_prompt(examen, params_full)

    examen.estado = "GENERANDO"
    examen.parametros_generacion = params_full
    examen.origen = "IA"
    examen.save(update_fields=["estado", "parametros_generacion", "origen"])

    client = LLMClient()

    try:
        payload = client.chat_json(prompt, temperature=0.2, max_tokens=2500)
    except Exception as e:
        raise ValidationError(f"Fallo al llamar al LLM o parsear JSON: {e}")

    payload = _normalize_payload(payload)

    # si falla solo por ponderaciones, intentamos ajustar automáticamente
    try:
        _validate_payload(payload, params_full)
    except ValidationError as e:
        msg = str(e.detail[0]) if hasattr(e, "detail") else str(e)
        if "suma de ponderaciones" in msg.lower():
            payload = _fix_ponderaciones_exactas(payload, Decimal(str(params_full["puntaje_total"])).quantize(Decimal("0.01")))
            _validate_payload(payload, params_full)
        else:
            raise

    return payload


def persist_exam_from_payload(examen: Examen, payload: dict, params: dict) -> Examen:
    if not isinstance(payload, dict) or "examen" not in payload or "preguntas" not in payload:
        raise ValidationError("Payload inválido para persistir.")

    ex = payload["examen"]

    examen.titulo = ex.get("titulo", examen.titulo)
    examen.descripcion = ex.get("descripcion", examen.descripcion)
    examen.nivel = ex.get("nivel", examen.nivel)
    examen.idioma = ex.get("idioma", examen.idioma)
    examen.duracion = int(ex.get("duracion_minutos", examen.duracion))
    examen.instrucciones = ex.get("instrucciones", examen.instrucciones)
    examen.mostrar_respuestas = bool(ex.get("mostrar_respuestas", examen.mostrar_respuestas))
    examen.aleatorizar_preguntas = bool(ex.get("aleatorizar_preguntas", examen.aleatorizar_preguntas))
    examen.aleatorizar_opciones = bool(ex.get("aleatorizar_opciones", examen.aleatorizar_opciones))
    examen.requiere_camara = bool(ex.get("requiere_camara", examen.requiere_camara))
    examen.tags = ex.get("tags", examen.tags) or []
    examen.origen = "IA"
    examen.estado = "PUBLICADO"
    examen.ia_metadata = payload.get("control_calidad", {}) or {}
    examen.parametros_generacion = params or {}
    examen.save()

    # borrar preguntas anteriores si existían
    examen.preguntas.all().delete()

    for p in payload.get("preguntas", []):
        pregunta = Pregunta.objects.create(
            examen=examen,
            orden=int(p.get("orden", 0)),
            tipo=p.get("tipo", "OPCION_MULTIPLE"),
            dificultad=p.get("dificultad", "MEDIA"),
            tema=p.get("tema", "") or "",
            resultado_aprendizaje=p.get("resultado_aprendizaje", "") or "",
            enunciado=p.get("enunciado", ""),
            ponderacion=Decimal(str(p.get("ponderacion", 1.0))).quantize(Decimal("0.01")),
            respuesta_texto=p.get("respuesta_texto", "") or "",
            explicacion=p.get("explicacion", "") or "",
            ia_metadata={},
        )

        t = pregunta.tipo
        opciones = p.get("opciones", []) or []
        correctas = set(p.get("correctas", []) or [])

        if t in ("OPCION_MULTIPLE", "SELECCION_MULTIPLE", "VERDADERO_FALSO"):
            for idx, o in enumerate(opciones):
                clave = o.get("clave", "")
                OpcionRespuesta.objects.create(
                    pregunta=pregunta,
                    clave=clave,
                    texto=o.get("texto", ""),
                    es_correcta=(clave in correctas),
                    orden=idx,
                )

    examen.calcular_puntaje_total(save=True)
    return examen


def generate_and_persist_exam(examen: Examen, params: dict) -> Examen:
    """
    Genera un examen con IA y lo persiste en la base de datos
    en una sola llamada.
    """
    payload = generate_exam_with_llm(examen, params)
    persist_exam_from_payload(examen, payload, params)
    examen.refresh_from_db()
    return examen
