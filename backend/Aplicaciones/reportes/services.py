import os
import json
from django.conf import settings
from django.utils import timezone
from django.db.models import Count, Avg

from Aplicaciones.analisis.models import IntentoExamen
from Aplicaciones.monitoreo.models import RegistroMonitoreo, Advertencia, Expulsion

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Preformatted
)
from reportlab.lib.units import cm


def _ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)


def _media_url_from_abs(abs_path: str) -> str:
    rel = os.path.relpath(abs_path, settings.MEDIA_ROOT).replace("\\", "/")
    return f"{settings.MEDIA_URL}{rel}"


def _safe_expulsion(intento_id: int):
    try:
        return Expulsion.objects.filter(intento_id=intento_id).first()
    except Exception:
        pass
    try:
        return Expulsion.objects.filter(intento__intento_id=intento_id).first()
    except Exception:
        return None


def _kv_table(data_rows):
    t = Table(data_rows, colWidths=[5.2 * cm, 11.8 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f2f2f2")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fbfbfb")]),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def _simple_table(header, rows, col_widths=None):
    data = [header] + rows
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0b5ed7")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fbfbfb")]),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def generar_pdf_desde_reporte(reporte) -> str:
    out_dir = os.path.join(settings.MEDIA_ROOT, "reportes")
    _ensure_dir(out_dir)

    filename = f"reporte_{reporte.id_reporte}_{reporte.tipo.lower()}.pdf"
    out_path = os.path.join(out_dir, filename)

    doc = SimpleDocTemplate(
        out_path,
        pagesize=A4,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        topMargin=1.6 * cm,
        bottomMargin=1.6 * cm,
        title=f"Reporte {reporte.id_reporte}",
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="H1", fontSize=15, leading=18, spaceAfter=10, fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle(name="H2", fontSize=11, leading=14, spaceBefore=8, spaceAfter=6, fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle(name="SmallMono", fontSize=8.2, leading=10, fontName="Courier"))

    story = []
    story.append(Paragraph(f"Reporte #{reporte.id_reporte} - {reporte.tipo}", styles["H1"]))
    story.append(Paragraph(f"<b>Estado:</b> {reporte.estado} &nbsp;&nbsp; <b>Formato:</b> {reporte.formato}", styles["Normal"]))
    story.append(Paragraph(f"<b>Generado:</b> {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}", styles["Normal"]))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Resumen", styles["H2"]))
    resumen_rows = [
        ["Campo", "Valor"],
        ["Examen", f"{reporte.examen_titulo or '—'} (ID {reporte.examen_id or '—'})"],
        ["Estudiante", f"{reporte.estudiante_nombre or '—'} (ID {reporte.estudiante_id or '—'})"],
        ["Intento ID", str(reporte.intento_id or "—")],
        ["Solicitado por", f"{reporte.solicitado_por_nombre} ({reporte.solicitado_por_rol})"],
        ["Observaciones", reporte.observaciones or "—"],
    ]
    story.append(_kv_table(resumen_rows))
    story.append(Spacer(1, 10))

    if reporte.tipo == "EXAMEN":
        story.append(Paragraph("Resumen del Examen (Grupal)", styles["H2"]))
        grp_rows = [
            ["Campo", "Valor"],
            ["Total estudiantes", str(reporte.total_estudiantes)],
            ["Aprobados", str(reporte.estudiantes_aprobados)],
            ["Reprobados", str(reporte.estudiantes_reprobados)],
            ["Expulsados", str(reporte.estudiantes_expulsados)],
            ["Promedio calificaciones", str(reporte.promedio_calificaciones or "—")],
            ["Total advertencias", str(reporte.total_advertencias)],
        ]
        story.append(_kv_table(grp_rows))
        story.append(Spacer(1, 10))

        lista = (reporte.datos_json or {}).get("estudiantes", [])
        story.append(Paragraph("Detalle por estudiante", styles["H2"]))

        if not lista:
            story.append(Paragraph("No hay estudiantes/intententos para este examen.", styles["Normal"]))
        else:
            header = ["Estudiante", "Intento", "Nota", "Advertencias", "Expulsión"]
            rows = []
            for e in lista:
                rows.append([
                    e.get("estudiante_nombre", "—"),
                    str(e.get("intento_id", "—")),
                    str(e.get("calificacion_final", "—")),
                    str(e.get("total_advertencias", 0)),
                    "Sí" if e.get("hubo_expulsion") else "No",
                ])
            story.append(_simple_table(header, rows, col_widths=[6.5*cm, 2.2*cm, 2.2*cm, 3.0*cm, 2.2*cm]))

    else:
        story.append(Paragraph("Resultados", styles["H2"]))
        resultados_rows = [
            ["Campo", "Valor"],
            ["Calificación", str(reporte.calificacion or "—")],
            ["Puntaje", f"{reporte.puntaje_obtenido or '—'} / {reporte.puntaje_total or '—'}"],
            ["Tiempo (segundos)", str(reporte.tiempo_examen or "—")],
            ["Correctas", str(reporte.preguntas_correctas)],
            ["Incorrectas", str(reporte.preguntas_incorrectas)],
            ["Totales", str(reporte.preguntas_totales)],
        ]
        story.append(_kv_table(resultados_rows))
        story.append(Spacer(1, 10))

        story.append(Paragraph("Monitoreo y Advertencias", styles["H2"]))
        mon_rows = [
            ["Campo", "Valor"],
            ["Total advertencias", str(reporte.total_advertencias)],
            ["Hubo expulsión", "Sí" if reporte.hubo_expulsion else "No"],
            ["Motivo expulsión", reporte.motivo_expulsion or "—"],
        ]
        story.append(_kv_table(mon_rows))
        story.append(Spacer(1, 8))

        story.append(Paragraph("Detalle de Advertencias", styles["H2"]))
        det = reporte.advertencias_detalle or []
        if not det:
            story.append(Paragraph("No se registraron advertencias.", styles["Normal"]))
        else:
            rows = [[a.get("tipo", "—"), str(a.get("cantidad", 0))] for a in det]
            story.append(_simple_table(["Tipo", "Cantidad"], rows, col_widths=[12.5*cm, 4.5*cm]))
        story.append(Spacer(1, 10))

        story.append(Paragraph("Eventos de Monitoreo", styles["H2"]))
        ev = reporte.eventos_monitoreo or {}
        if not ev:
            story.append(Paragraph("No se registraron eventos de monitoreo.", styles["Normal"]))
        else:
            rows = [[k, str(v)] for k, v in ev.items()]
            story.append(_simple_table(["Evento", "Cantidad"], rows, col_widths=[12.5*cm, 4.5*cm]))

    story.append(PageBreak())
    story.append(Paragraph("Datos JSON (resumen)", styles["H2"]))
    json_str = json.dumps(reporte.datos_json or {}, ensure_ascii=False, indent=2)
    story.append(Preformatted(json_str, styles["SmallMono"]))

    doc.build(story)
    return _media_url_from_abs(out_path)


def generar_reporte_individual_internal(reporte):
    if not reporte.intento_id:
        raise ValueError("Reporte INDIVIDUAL requiere intento_id")

    intento = IntentoExamen.objects.get(id_intento=reporte.intento_id)

    eventos = RegistroMonitoreo.objects.filter(intento_id=reporte.intento_id)
    advertencias = Advertencia.objects.filter(intento_id=reporte.intento_id)
    expulsion = _safe_expulsion(reporte.intento_id)

    advertencias_detalle = list(
        advertencias.values("tipo")
        .annotate(cantidad=Count("id_advertencia"))
        .order_by("-cantidad")
    )

    eventos_monitoreo = {
        x["tipo_evento"]: x["cantidad"]
        for x in eventos.values("tipo_evento").annotate(cantidad=Count("id_registro"))
    }

    datos = {
        "modo": "internal",
        "generado_en": timezone.now().isoformat(),
        "intento": {
            "id_intento": intento.id_intento,
            "estudiante_id": intento.estudiante_id,
            "estudiante_nombre": intento.estudiante_nombre,
            "examen_id": intento.examen_id,
            "examen_titulo": intento.examen_titulo,
            "estado": intento.estado,
            "tiempo_total": intento.tiempo_total,
            "puntaje_obtenido": float(intento.puntaje_obtenido),
            "puntaje_total": float(intento.puntaje_total),
            "calificacion_final": float(intento.calificacion_final) if intento.calificacion_final is not None else None,
            "preguntas_correctas": intento.preguntas_correctas,
            "preguntas_incorrectas": intento.preguntas_incorrectas,
            "preguntas_totales": intento.preguntas_totales,
        },
        "monitoreo": {
            "total_eventos": eventos.count(),
            "total_advertencias": advertencias.count(),
            "advertencias_detalle": advertencias_detalle,
            "eventos_monitoreo": eventos_monitoreo,
            "hubo_expulsion": bool(expulsion),
            "motivo_expulsion": getattr(expulsion, "motivo", "") if expulsion else "",
        }
    }

    reporte.estudiante_id = intento.estudiante_id
    reporte.estudiante_nombre = intento.estudiante_nombre
    reporte.examen_id = intento.examen_id
    reporte.examen_titulo = intento.examen_titulo

    reporte.calificacion = intento.calificacion_final
    reporte.puntaje_obtenido = intento.puntaje_obtenido
    reporte.puntaje_total = intento.puntaje_total
    reporte.tiempo_examen = intento.tiempo_total

    reporte.preguntas_correctas = intento.preguntas_correctas
    reporte.preguntas_incorrectas = intento.preguntas_incorrectas
    reporte.preguntas_totales = intento.preguntas_totales

    reporte.total_advertencias = advertencias.count()
    reporte.advertencias_detalle = advertencias_detalle
    reporte.eventos_monitoreo = eventos_monitoreo
    reporte.hubo_expulsion = bool(expulsion)
    reporte.motivo_expulsion = getattr(expulsion, "motivo", "") if expulsion else ""

    reporte.anomalias = []
    reporte.datos_json = datos

    reporte.estado = "COMPLETADO"
    reporte.save()

    # ✅ robusto
    if (reporte.formato or "").upper() == "PDF":
        reporte.archivo_url = generar_pdf_desde_reporte(reporte)
        reporte.save(update_fields=["archivo_url"])

    return reporte


def generar_reporte_examen_internal(reporte):
    if not reporte.examen_id:
        raise ValueError("Reporte EXAMEN requiere examen_id")

    intentos = IntentoExamen.objects.filter(examen_id=reporte.examen_id)

    reporte.examen_titulo = intentos.first().examen_titulo if intentos.exists() else (reporte.examen_titulo or "")

    total_estudiantes = intentos.values("estudiante_id").distinct().count()
    total_intentos = intentos.count()

    aprobados = intentos.filter(calificacion_final__gte=7).count()
    reprobados = intentos.filter(calificacion_final__lt=7).count()

    intentos_ids = list(intentos.values_list("id_intento", flat=True))
    advertencias_qs = Advertencia.objects.filter(intento_id__in=intentos_ids)
    total_advertencias = advertencias_qs.count()

    expulsados = 0
    exp_map = {}
    for iid in intentos_ids:
        exp = _safe_expulsion(iid)
        if exp:
            expulsados += 1
            exp_map[iid] = getattr(exp, "motivo", "") or "EXPULSION"

    promedio = intentos.aggregate(avg=Avg("calificacion_final"))["avg"]

    estudiantes_detalle = []
    for it in intentos:
        adv_count = Advertencia.objects.filter(intento_id=it.id_intento).count()
        estudiantes_detalle.append({
            "intento_id": it.id_intento,
            "estudiante_id": it.estudiante_id,
            "estudiante_nombre": it.estudiante_nombre,
            "calificacion_final": float(it.calificacion_final) if it.calificacion_final is not None else None,
            "puntaje_obtenido": float(it.puntaje_obtenido) if it.puntaje_obtenido is not None else None,
            "puntaje_total": float(it.puntaje_total) if it.puntaje_total is not None else None,
            "tiempo_total": it.tiempo_total,
            "total_advertencias": adv_count,
            "hubo_expulsion": it.id_intento in exp_map,
            "motivo_expulsion": exp_map.get(it.id_intento, ""),
        })

    datos = {
        "modo": "internal",
        "generado_en": timezone.now().isoformat(),
        "examen": {
            "examen_id": reporte.examen_id,
            "examen_titulo": reporte.examen_titulo,
            "total_estudiantes": total_estudiantes,
            "total_intentos": total_intentos,
            "promedio_calificaciones": float(promedio) if promedio is not None else None,
            "total_advertencias": total_advertencias,
            "estudiantes_expulsados": expulsados,
            "aprobados": aprobados,
            "reprobados": reprobados,
        },
        "estudiantes": estudiantes_detalle,
    }

    reporte.total_estudiantes = total_estudiantes
    reporte.estudiantes_aprobados = aprobados
    reporte.estudiantes_reprobados = reprobados
    reporte.estudiantes_expulsados = expulsados

    reporte.promedio_calificaciones = promedio
    reporte.total_advertencias = total_advertencias

    reporte.intento_id = None
    reporte.estudiante_id = None
    reporte.estudiante_nombre = ""

    reporte.datos_json = datos
    reporte.estado = "COMPLETADO"
    reporte.save()

    # ✅ robusto
    if (reporte.formato or "").upper() == "PDF":
        reporte.archivo_url = generar_pdf_desde_reporte(reporte)
        reporte.save(update_fields=["archivo_url"])

    return reporte


def generar_reporte_dummy(reporte):
    datos = {
        "modo": "dummy",
        "reporte_id": reporte.id_reporte,
        "tipo": reporte.tipo,
        "formato": reporte.formato,
        "generado_en": timezone.now().isoformat(),
    }
    reporte.datos_json = datos
    reporte.estado = "COMPLETADO"
    reporte.save(update_fields=["datos_json", "estado"])

    # ✅ SI pidieron PDF, generarlo aunque sea dummy
    if str(reporte.formato).upper() == "PDF":
        reporte.archivo_url = generar_pdf_desde_reporte(reporte)
        reporte.save(update_fields=["archivo_url"])

    return reporte


def generar_reporte_internal(reporte):
    if reporte.tipo == "INDIVIDUAL":
        return generar_reporte_individual_internal(reporte)

    if reporte.tipo == "EXAMEN":
        return generar_reporte_examen_internal(reporte)

    raise ValueError(f"Tipo {reporte.tipo} no implementado en modo internal todavía.")


def generar_reporte(reporte, request=None):
    mode = getattr(settings, "REPORTS_MODE", "dummy")

    if mode == "internal":
        return generar_reporte_internal(reporte)

    if mode == "dummy":
        return generar_reporte_dummy(reporte)

    raise ValueError("REPORTS_MODE='micro' requiere microservicios en otros puertos.")
