# apps/attempts/models.py
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from datetime import timedelta

class IntentoExamen(models.Model):
    ESTADOS = [
        ('INICIADO', 'Iniciado'),
        ('EN_PROGRESO', 'En Progreso'),
        ('COMPLETADO', 'Completado'),
        ('EXPULSADO', 'Expulsado'),
        ('ABANDONADO', 'Abandonado'),
        ('TIEMPO_AGOTADO', 'Tiempo Agotado'),
    ]
    
    id_intento = models.AutoField(primary_key=True)
    estudiante_id = models.IntegerField(
        db_index=True,
        help_text='ID del estudiante desde auth-service'
    )
    estudiante_nombre = models.CharField(
        max_length=200,
        help_text='Nombre del estudiante (desnormalizado)'
    )
    estudiante_cedula = models.CharField(max_length=10)
    examen_id = models.IntegerField(
        db_index=True,
        help_text='ID del examen desde exam-service'
    )
    examen_titulo = models.CharField(
        max_length=200,
        help_text='Título del examen (desnormalizado)'
    )
    horario_id = models.IntegerField(
        null=True,
        blank=True,
        help_text='ID del horario asignado'
    )
    numero_intento = models.IntegerField(
        default=1,
        validators=[MinValueValidator(1)]
    )
    estado = models.CharField(
        max_length=20,
        choices=ESTADOS,
        default='INICIADO'
    )
    fecha_inicio = models.DateTimeField(auto_now_add=True)
    fecha_fin = models.DateTimeField(null=True, blank=True)
    fecha_limite = models.DateTimeField(
        help_text='Fecha y hora límite para completar el examen'
    )
    tiempo_total = models.IntegerField(
        default=0,
        help_text='Tiempo total en segundos'
    )
    calificacion_final = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)]
    )
    puntaje_obtenido = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)]
    )
    puntaje_total = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text='Puntaje total del examen'
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    validacion_facial_completada = models.BooleanField(default=False)
    camara_activada = models.BooleanField(default=False)
    
    # Metadata del intento
    preguntas_totales = models.IntegerField(default=0)
    preguntas_respondidas = models.IntegerField(default=0)
    preguntas_correctas = models.IntegerField(default=0)
    preguntas_incorrectas = models.IntegerField(default=0)
    
    # Campos de auditoría
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'intentos_examen'
        verbose_name = 'Intento de Examen'
        verbose_name_plural = 'Intentos de Examen'
        ordering = ['-fecha_inicio']
        indexes = [
            models.Index(fields=['estudiante_id', 'examen_id']),
            models.Index(fields=['examen_id', 'estado']),
            models.Index(fields=['fecha_inicio', 'estado']),
            models.Index(fields=['estudiante_id', 'estado']),
        ]
        unique_together = [['estudiante_id', 'examen_id', 'numero_intento']]
    
    def __str__(self):
        return f"{self.estudiante_nombre} - {self.examen_titulo} (Intento {self.numero_intento})"
    
    def save(self, *args, **kwargs):
        if not self.fecha_limite and hasattr(self, 'duracion_examen'):
            self.fecha_limite = self.fecha_inicio + timedelta(minutes=self.duracion_examen)
        super().save(*args, **kwargs)
    
    def tiempo_restante(self):
        """Retorna el tiempo restante en segundos"""
        if self.estado in ['COMPLETADO', 'EXPULSADO', 'ABANDONADO', 'TIEMPO_AGOTADO']:
            return 0
        
        ahora = timezone.now()
        if ahora >= self.fecha_limite:
            return 0
        
        return int((self.fecha_limite - ahora).total_seconds())
    
    def esta_expirado(self):
        return timezone.now() > self.fecha_limite
    
    def calcular_calificacion(self):
        """Calcula la calificación final basada en el puntaje obtenido"""
        if self.puntaje_total > 0:
            porcentaje = (self.puntaje_obtenido / self.puntaje_total) * 100
            self.calificacion_final = round(porcentaje, 2)
        else:
            self.calificacion_final = 0
        return self.calificacion_final
    
    def finalizar_intento(self, estado='COMPLETADO'):
        """Finaliza el intento y calcula estadísticas"""
        self.estado = estado
        self.fecha_fin = timezone.now()
        
        if self.fecha_inicio:
            self.tiempo_total = int((self.fecha_fin - self.fecha_inicio).total_seconds())
        
        # Calcular estadísticas
        respuestas = self.respuestas.all()
        self.preguntas_respondidas = respuestas.count()
        self.preguntas_correctas = respuestas.filter(es_correcta=True).count()
        self.preguntas_incorrectas = respuestas.filter(es_correcta=False).count()
        
        # Calcular puntaje total
        self.puntaje_obtenido = sum(
            r.puntaje_obtenido for r in respuestas
        )
        
        # Calcular calificación
        self.calcular_calificacion()
        
        self.save()
        return self
    
    def puede_continuar(self):
        """Verifica si el intento puede continuar"""
        return (
            self.estado in ['INICIADO', 'EN_PROGRESO'] and
            not self.esta_expirado()
        )


class RespuestaEstudiante(models.Model):
    id_respuesta = models.AutoField(primary_key=True)
    intento = models.ForeignKey(
        IntentoExamen,
        on_delete=models.CASCADE,
        related_name='respuestas'
    )
    pregunta_id = models.IntegerField(
        db_index=True,
        help_text='ID de la pregunta desde exam-service'
    )
    pregunta_enunciado = models.TextField(
        help_text='Enunciado de la pregunta (desnormalizado)'
    )
    pregunta_ponderacion = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text='Ponderación de la pregunta'
    )
    opcion_id = models.IntegerField(
        null=True,
        blank=True,
        help_text='ID de la opción seleccionada'
    )
    opciones_ids = models.JSONField(
        default=list,
        blank=True,
        help_text='IDs de opciones seleccionadas (para selección múltiple)'
    )
    opcion_texto = models.TextField(
        blank=True,
        help_text='Texto de la opción seleccionada (desnormalizado)'
    )
    es_correcta = models.BooleanField(default=False)
    puntaje_obtenido = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0
    )
    tiempo_respuesta = models.IntegerField(
        default=0,
        help_text='Tiempo en segundos que tardó en responder'
    )
    numero_orden = models.IntegerField(
        default=0,
        help_text='Orden en que se respondió la pregunta'
    )
    fecha_respuesta = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'respuestas_estudiante'
        verbose_name = 'Respuesta de Estudiante'
        verbose_name_plural = 'Respuestas de Estudiante'
        ordering = ['intento', 'numero_orden']
        indexes = [
            models.Index(fields=['intento', 'pregunta_id']),
            models.Index(fields=['intento', 'es_correcta']),
        ]
        unique_together = [['intento', 'pregunta_id']]
    
    def __str__(self):
        correcta = "✓" if self.es_correcta else "✗"
        return f"{correcta} {self.intento.estudiante_nombre} - Pregunta {self.pregunta_id}"
    
    def evaluar_respuesta(self, opciones_correctas):
        """
        Evalúa la respuesta del estudiante
        opciones_correctas: lista de IDs de opciones correctas
        """
        if self.opciones_ids:
            # Selección múltiple
            respondidas = set(self.opciones_ids)
            correctas = set(opciones_correctas)
            self.es_correcta = respondidas == correctas
        else:
            # Opción única
            self.es_correcta = self.opcion_id in opciones_correctas
        
        # Asignar puntaje
        if self.es_correcta:
            self.puntaje_obtenido = self.pregunta_ponderacion
        else:
            self.puntaje_obtenido = 0
        
        self.save()
        return self.es_correcta
    
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Actualizar estadísticas del intento
        if hasattr(self, 'intento'):
            self.intento.save()