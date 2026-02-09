# apps/reports/models.py
from django.db import models
from django.core.validators import MinValueValidator

class Reporte(models.Model):
    TIPOS = [
        ('INDIVIDUAL', 'Reporte Individual de Estudiante'),
        ('EXAMEN', 'Reporte de Examen Completo'),
        ('ESTADISTICO', 'Reporte Estadístico'),
        ('ANOMALIAS', 'Reporte de Anomalías'),
        ('GENERAL', 'Reporte General'),
    ]
    
    FORMATOS = [
        ('JSON', 'JSON'),
        ('PDF', 'PDF'),
        ('EXCEL', 'Excel'),
        ('CSV', 'CSV'),
    ]
    
    ESTADOS = [
        ('GENERANDO', 'Generando'),
        ('COMPLETADO', 'Completado'),
        ('ERROR', 'Error'),
    ]
    
    id_reporte = models.AutoField(primary_key=True)
    
    reporte_padre_id = models.IntegerField(null=True, blank=True, db_index=True)

    tipo = models.CharField(max_length=20, choices=TIPOS)
    formato = models.CharField(max_length=10, choices=FORMATOS, default='PDF')
    estado = models.CharField(max_length=15, choices=ESTADOS, default='GENERANDO')
    
    # Relaciones con otros servicios
    intento_id = models.IntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text='ID del intento (para reportes individuales)'
    )
    estudiante_id = models.IntegerField(
        null=True,
        blank=True,
        db_index=True
    )
    estudiante_nombre = models.CharField(max_length=200, blank=True)
    examen_id = models.IntegerField(
        null=True,
        blank=True,
        db_index=True
    )
    examen_titulo = models.CharField(max_length=200, blank=True)
    docente_id = models.IntegerField(
        null=True,
        blank=True,
        help_text='ID del docente que solicitó el reporte'
    )
    
    # Datos del reporte
    total_advertencias = models.IntegerField(default=0)
    advertencias_detalle = models.JSONField(
        default=list,
        blank=True,
        help_text='Detalle de advertencias agrupadas por tipo'
    )
    calificacion = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    puntaje_obtenido = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    puntaje_total = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    tiempo_examen = models.IntegerField(
        null=True,
        blank=True,
        help_text='Tiempo total del examen en segundos'
    )
    preguntas_correctas = models.IntegerField(default=0)
    preguntas_incorrectas = models.IntegerField(default=0)
    preguntas_totales = models.IntegerField(default=0)
    
    # Estadísticas de monitoreo
    eventos_monitoreo = models.JSONField(
        default=dict,
        blank=True,
        help_text='Estadísticas de eventos de monitoreo'
    )
    
    # Anomalías detectadas
    anomalias = models.JSONField(
        default=list,
        blank=True,
        help_text='Lista de anomalías detectadas durante el examen'
    )
    hubo_expulsion = models.BooleanField(default=False)
    motivo_expulsion = models.CharField(max_length=100, blank=True)
    
    # Estadísticas comparativas (para reportes de examen completo)
    promedio_calificaciones = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    mediana_calificaciones = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    desviacion_estandar = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    total_estudiantes = models.IntegerField(default=0)
    estudiantes_aprobados = models.IntegerField(default=0)
    estudiantes_reprobados = models.IntegerField(default=0)
    estudiantes_expulsados = models.IntegerField(default=0)
    
    # Archivos generados
    archivo_url = models.URLField(
        blank=True,
        help_text='URL del archivo generado (PDF, Excel, etc.)'
    )
    datos_json = models.JSONField(
        default=dict,
        blank=True,
        help_text='Datos del reporte en formato JSON'
    )
    
    # Metadata
    solicitado_por_id = models.IntegerField(
        help_text='ID del usuario que solicitó el reporte'
    )
    solicitado_por_nombre = models.CharField(max_length=200)
    solicitado_por_rol = models.CharField(max_length=20)
    observaciones = models.TextField(blank=True)
    error_mensaje = models.TextField(blank=True)
    
    # Fechas
    fecha_generacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    fecha_desde = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Fecha inicial para reportes de rango'
    )
    fecha_hasta = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Fecha final para reportes de rango'
    )
    
    class Meta:
        db_table = 'reportes'
        verbose_name = 'Reporte'
        verbose_name_plural = 'Reportes'
        ordering = ['-fecha_generacion']
        indexes = [
            models.Index(fields=['intento_id']),
            models.Index(fields=['estudiante_id', 'examen_id']),
            models.Index(fields=['examen_id', 'tipo']),
            models.Index(fields=['tipo', 'estado']),
            models.Index(fields=['fecha_generacion']),
        ]
    
    def __str__(self):
        return f"{self.get_tipo_display()} - {self.estudiante_nombre or self.examen_titulo} ({self.fecha_generacion})"
    
    @property
    def porcentaje_aprobacion(self):
        """Calcula el porcentaje de aprobación"""
        if self.total_estudiantes > 0:
            return round((self.estudiantes_aprobados / self.total_estudiantes) * 100, 2)
        return 0
    
    @property
    def porcentaje_expulsion(self):
        """Calcula el porcentaje de expulsión"""
        if self.total_estudiantes > 0:
            return round((self.estudiantes_expulsados / self.total_estudiantes) * 100, 2)
        return 0
    
    def marcar_completado(self, archivo_url=None):
        """Marca el reporte como completado"""
        self.estado = 'COMPLETADO'
        if archivo_url:
            self.archivo_url = archivo_url
        self.save()
    
    def marcar_error(self, mensaje):
        """Marca el reporte con error"""
        self.estado = 'ERROR'
        self.error_mensaje = mensaje
        self.save()


# apps/reports/models.py (continuación)
class PlantillaReporte(models.Model):
    """Plantillas personalizables para reportes"""
    id_plantilla = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100, unique=True)
    tipo_reporte = models.CharField(
        max_length=20,
        choices=Reporte.TIPOS
    )
    descripcion = models.TextField(blank=True)
    plantilla_html = models.TextField(
        help_text='Plantilla HTML para generación de PDF'
    )
    estilos_css = models.TextField(
        blank=True,
        help_text='Estilos CSS personalizados'
    )
    incluir_logo = models.BooleanField(default=True)
    incluir_firma = models.BooleanField(default=True)
    incluir_graficos = models.BooleanField(default=True)
    campos_personalizados = models.JSONField(
        default=dict,
        blank=True,
        help_text='Campos adicionales a incluir en el reporte'
    )
    activa = models.BooleanField(default=True)
    creada_por_id = models.IntegerField()
    creada_por_nombre = models.CharField(max_length=200)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'plantillas_reporte'
        verbose_name = 'Plantilla de Reporte'
        verbose_name_plural = 'Plantillas de Reporte'
        ordering = ['nombre']
    
    def __str__(self):
        return f"{self.nombre} ({self.get_tipo_reporte_display()})"


# apps/analytics/models.py
class EstadisticaExamen(models.Model):
    """Modelo para almacenar estadísticas agregadas de exámenes"""
    id_estadistica = models.AutoField(primary_key=True)
    examen_id = models.IntegerField(unique=True, db_index=True)
    examen_titulo = models.CharField(max_length=200)
    docente_id = models.IntegerField()
    docente_nombre = models.CharField(max_length=200)
    
    # Estadísticas generales
    total_intentos = models.IntegerField(default=0)
    intentos_completados = models.IntegerField(default=0)
    intentos_expulsados = models.IntegerField(default=0)
    intentos_abandonados = models.IntegerField(default=0)
    
    # Calificaciones
    calificacion_promedio = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0
    )
    calificacion_maxima = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0
    )
    calificacion_minima = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0
    )
    mediana = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0
    )
    desviacion_estandar = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0
    )
    
    # Distribución de calificaciones
    distribucion_calificaciones = models.JSONField(
        default=dict,
        help_text='Distribución por rangos de calificación'
    )
    
    # Tiempo promedio
    tiempo_promedio_segundos = models.IntegerField(default=0)
    tiempo_maximo_segundos = models.IntegerField(default=0)
    tiempo_minimo_segundos = models.IntegerField(default=0)
    
    # Preguntas
    preguntas_mas_dificiles = models.JSONField(
        default=list,
        help_text='IDs y estadísticas de preguntas con menor tasa de acierto'
    )
    preguntas_mas_faciles = models.JSONField(
        default=list,
        help_text='IDs y estadísticas de preguntas con mayor tasa de acierto'
    )
    
    # Monitoreo
    total_advertencias = models.IntegerField(default=0)
    advertencias_por_tipo = models.JSONField(
        default=dict,
        help_text='Conteo de advertencias agrupadas por tipo'
    )
    tasa_expulsion = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text='Porcentaje de estudiantes expulsados'
    )
    
    # Fechas
    fecha_calculo = models.DateTimeField(auto_now=True)
    ultima_actualizacion = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'estadisticas_examen'
        verbose_name = 'Estadística de Examen'
        verbose_name_plural = 'Estadísticas de Examen'
        ordering = ['-fecha_calculo']
    
    def __str__(self):
        return f"Estadísticas: {self.examen_titulo}"
    
    @classmethod
    def recalcular_estadisticas(cls, examen_id):
        """Recalcula todas las estadísticas para un examen"""
        # Este método llamaría a los servicios correspondientes
        # para obtener los datos y calcular las estadísticas
        pass