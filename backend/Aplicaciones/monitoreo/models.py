# ============================================
# Aplicaciones/monitoreo/models.py
# ============================================
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone


# =====================================================
# REGISTRO DE MONITOREO (EVENTOS)
# =====================================================

class RegistroMonitoreo(models.Model):
    """
    Registra eventos generados durante el monitoreo de un intento de examen.
    (MUCHOS eventos por intento)
    """

    TIPOS_EVENTO = [
        ("INICIO_SESION",          "Inicio de sesión"),
        ("FRAME_PROCESADO",       "Frame procesado"),
        ("ROSTRO_DETECTADO",      "Rostro detectado"),
        ("SIN_ROSTRO",            "Sin rostro detectado"),
        ("FUERA_DE_ENCUADRE",     "Fuera de encuadre"),           # ← NUEVO
        ("MULTIPLES_ROSTROS",     "Múltiples rostros detectados"),
        ("MIRADA_DESVIADA",       "Mirada desviada"),
        ("OJOS_CERRADOS",         "Ojos cerrados"),               # ← NUEVO
        ("CAMBIO_PESTAÑA",        "Cambio de pestaña"),
        ("PANTALLA_COMPLETA_OFF", "Salida de pantalla completa"),
        ("CONEXION_PERDIDA",      "Conexión perdida"),
        ("CONEXION_RECUPERADA",   "Conexión recuperada"),
        ("FIN_SESION",            "Fin de sesión"),
    ]

    id_registro = models.AutoField(primary_key=True)

    intento_id = models.IntegerField(
        db_index=True,
        help_text="ID del intento del examen"
    )

    estudiante_id = models.IntegerField(db_index=True)

    tipo_evento = models.CharField(
        max_length=30,
        choices=TIPOS_EVENTO
    )

    confianza_algoritmo = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Nivel de confianza del algoritmo (0-100)"
    )

    detalles = models.JSONField(
        default=dict,
        blank=True,
        help_text="Detalles técnicos del evento"
    )

    snapshot_url = models.URLField(
        blank=True,
        help_text="URL de evidencia (imagen o video)"
    )

    duracion_evento = models.IntegerField(
        null=True,
        blank=True,
        help_text="Duración del evento en milisegundos"
    )

    timestamp = models.DateTimeField(
        auto_now_add=True,
        db_index=True
    )

    class Meta:
        db_table = "registros_monitoreo"
        verbose_name = "Registro de Monitoreo"
        verbose_name_plural = "Registros de Monitoreo"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["intento_id", "timestamp"]),
            models.Index(fields=["intento_id", "tipo_evento"]),
        ]

    def __str__(self):
        return f"{self.get_tipo_evento_display()} | Intento {self.intento_id}"

    @classmethod
    def obtener_eventos_sospechosos(cls, intento_id, minutos=5):
        limite = timezone.now() - timezone.timedelta(minutes=minutos)
        return cls.objects.filter(
            intento_id=intento_id,
            tipo_evento__in=[
                "SIN_ROSTRO",
                "FUERA_DE_ENCUADRE",        # ← NUEVO
                "MULTIPLES_ROSTROS",
                "MIRADA_DESVIADA",
                "OJOS_CERRADOS",            # ← NUEVO
                "CAMBIO_PESTAÑA",
                "PANTALLA_COMPLETA_OFF",
            ],
            timestamp__gte=limite
        )


# =====================================================
# ADVERTENCIAS
# =====================================================

class Advertencia(models.Model):
    TIPOS = [
        ("AUSENCIA",                "Estudiante no detectado"),
        ("FUERA_DE_ENCUADRE",       "Estudiante fuera de encuadre"),   # ← NUEVO
        ("MULTIPLES_PERSONAS",      "Múltiples personas detectadas"),
        ("MIRADA_DESVIADA",         "Mirada fuera de pantalla"),
        ("OJOS_CERRADOS",           "Ojos cerrados"),                  # ← NUEVO
        ("OBJETO_NO_AUTORIZADO",    "Objeto no autorizado"),
        ("CAMBIO_VENTANA",          "Cambio de ventana"),
        ("PERDIDA_CONEXION",        "Pérdida de conexión"),
        ("CAMARA_BLOQUEADA",        "Cámara bloqueada"),
        ("COMPORTAMIENTO_SOSPECHOSO", "Comportamiento sospechoso"),
    ]

    NIVELES = [
        ("LEVE",     "Leve"),
        ("MODERADO", "Moderado"),
        ("GRAVE",    "Grave"),
    ]

    id_advertencia = models.AutoField(primary_key=True)

    intento_id = models.IntegerField(
        db_index=True,
        help_text="ID del intento del examen"
    )

    estudiante_id = models.IntegerField(db_index=True)
    estudiante_nombre = models.CharField(max_length=200)

    tipo = models.CharField(max_length=30, choices=TIPOS)

    nivel = models.CharField(
        max_length=10,
        choices=NIVELES,
        default="MODERADO"
    )

    descripcion = models.TextField(blank=True)

    confianza = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Nivel de confianza del evento"
    )

    evidencia_url = models.URLField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    resuelta = models.BooleanField(default=False)
    notas_resolucion = models.TextField(blank=True)

    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "advertencias"
        verbose_name = "Advertencia"
        verbose_name_plural = "Advertencias"
        ordering = ["-fecha"]
        indexes = [
            models.Index(fields=["intento_id", "fecha"]),
            models.Index(fields=["intento_id", "tipo"]),
        ]

    def __str__(self):
        return f"[{self.nivel}] {self.get_tipo_display()} - {self.estudiante_nombre}"

    @classmethod
    def contar_advertencias(cls, intento_id):
        return cls.objects.filter(intento_id=intento_id).count()

    @classmethod
    def debe_expulsar(cls, intento_id, max_advertencias=2):
        return cls.contar_advertencias(intento_id) >= max_advertencias


# =====================================================
# EXPULSIONES
# =====================================================

class Expulsion(models.Model):
    MOTIVOS = [
        ("MAX_ADVERTENCIAS", "Máximo de advertencias alcanzado"),
        ("FRAUDE",           "Fraude detectado"),
        ("VIOLACION_NORMAS", "Violación de normas"),
        ("FALLO_TECNICO",    "Fallo técnico"),
        ("MANUAL",           "Expulsión manual"),
    ]

    id_expulsion = models.AutoField(primary_key=True)

    intento_id = models.IntegerField(
        unique=True,
        db_index=True,
        help_text="ID del intento expulsado"
    )

    estudiante_id = models.IntegerField(db_index=True)
    estudiante_nombre = models.CharField(max_length=200)

    examen_id = models.IntegerField()
    examen_titulo = models.CharField(max_length=200)

    motivo = models.CharField(max_length=30, choices=MOTIVOS)
    descripcion = models.TextField()

    advertencias_previas = models.IntegerField(default=0)

    docente_notificado = models.BooleanField(default=False)
    admin_notificado = models.BooleanField(default=False)

    evidencias = models.JSONField(
        default=list,
        help_text="Lista de URLs de evidencia"
    )

    calificacion_asignada = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0
    )

    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "expulsiones"
        verbose_name = "Expulsión"
        verbose_name_plural = "Expulsiones"
        ordering = ["-fecha"]
        indexes = [
            models.Index(fields=["intento_id", "fecha"]),
            models.Index(fields=["examen_id", "fecha"]),
        ]

    def __str__(self):
        return f"Expulsión - {self.estudiante_nombre} ({self.get_motivo_display()})"


# =====================================================
# CONFIGURACIÓN DE MONITOREO
# =====================================================

class ConfiguracionMonitoreo(models.Model):
    id_config = models.AutoField(primary_key=True)

    examen_id = models.IntegerField(
        unique=True,
        help_text="ID del examen"
    )

    max_advertencias = models.IntegerField(
        default=2,
        validators=[MinValueValidator(1), MaxValueValidator(10)]
    )

    umbral_confianza_minimo = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=70,
        validators=[MinValueValidator(0), MaxValueValidator(100)]
    )

    tiempo_sin_rostro_max = models.IntegerField(
        default=10,
        help_text="Segundos máximos sin rostro"
    )

    tiempo_mirada_desviada_max = models.IntegerField(
        default=15,
        help_text="Segundos máximos con mirada desviada"
    )

    permitir_multiples_personas = models.BooleanField(default=False)
    captura_periodica_frames = models.BooleanField(default=True)
    intervalo_captura_segundos = models.IntegerField(default=30)
    requiere_pantalla_completa = models.BooleanField(default=True)

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "configuracion_monitoreo"
        verbose_name = "Configuración de Monitoreo"
        verbose_name_plural = "Configuraciones de Monitoreo"

    def __str__(self):
        return f"Configuración Monitoreo - Examen {self.examen_id}"