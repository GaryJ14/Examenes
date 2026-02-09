# ============================================
# Aplicaciones/examenes/models.py
# ============================================
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone


class Materia(models.Model):
    id_materia = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=200, unique=True)
    descripcion = models.TextField(blank=True)
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "materias"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Examen(models.Model):
    ESTADOS = [
        ("BORRADOR", "Borrador"),
        ("GENERANDO", "Generando (IA)"),
        ("PUBLICADO", "Publicado"),
        ("ACTIVO", "Activo"),
        ("FINALIZADO", "Finalizado"),
        ("ARCHIVADO", "Archivado"),
        ("ERROR_GENERACION", "Error generación (IA)"),
    ]

    NIVEL = [("BASICO", "Básico"), ("INTERMEDIO", "Intermedio"), ("AVANZADO", "Avanzado")]
    IDIOMA = [("ES", "Español"), ("EN", "English"), ("PT", "Português")]
    ORIGEN = [("MANUAL", "Manual"), ("IA", "IA"), ("MIXTO", "Mixto")]

    id_examen = models.AutoField(primary_key=True)
    materia = models.ForeignKey(Materia, on_delete=models.PROTECT, related_name="examenes", null=True, blank=True)


    titulo = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)

    docente_id = models.IntegerField(db_index=True)
    docente_nombre = models.CharField(max_length=200)

    estado = models.CharField(max_length=30, choices=ESTADOS, default="BORRADOR")

    nivel = models.CharField(max_length=20, choices=NIVEL, default="INTERMEDIO")
    idioma = models.CharField(max_length=5, choices=IDIOMA, default="ES")
    tags = models.JSONField(default=list, blank=True)
    origen = models.CharField(max_length=10, choices=ORIGEN, default="MANUAL")

    fecha_inicio = models.DateTimeField(null=True, blank=True)
    fecha_fin = models.DateTimeField(null=True, blank=True)
    duracion = models.IntegerField(validators=[MinValueValidator(1)], default=30)  # minutos

    instrucciones = models.TextField(blank=True)
    intentos_permitidos = models.IntegerField(
        default=1, validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    mostrar_respuestas = models.BooleanField(default=False)
    aleatorizar_preguntas = models.BooleanField(default=False)
    aleatorizar_opciones = models.BooleanField(default=True)
    requiere_camara = models.BooleanField(default=True)

    puntaje_total = models.DecimalField(max_digits=7, decimal_places=2, default=0)

    parametros_generacion = models.JSONField(default=dict, blank=True)
    ia_metadata = models.JSONField(default=dict, blank=True)

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "examenes"
        ordering = ["-fecha_creacion"]

    def __str__(self):
        return f"{self.materia.nombre} - {self.titulo}"

    def esta_activo(self):
        now = timezone.now()
        if self.estado != "ACTIVO":
            return False
        if self.fecha_inicio and now < self.fecha_inicio:
            return False
        if self.fecha_fin and now > self.fecha_fin:
            return False
        return True

    def calcular_puntaje_total(self, save=True):
        total = self.preguntas.aggregate(total=models.Sum("ponderacion"))["total"] or 0
        self.puntaje_total = total
        if save:
            self.save(update_fields=["puntaje_total"])
        return total


class Pregunta(models.Model):
    TIPOS = [
        ("OPCION_MULTIPLE", "Opción Múltiple"),
        ("VERDADERO_FALSO", "Verdadero/Falso"),
        ("SELECCION_MULTIPLE", "Selección Múltiple"),
        ("RESPUESTA_CORTA", "Respuesta corta"),
    ]

    DIFICULTAD = [("FACIL", "Fácil"), ("MEDIA", "Media"), ("DIFICIL", "Difícil")]

    id_pregunta = models.AutoField(primary_key=True)
    examen = models.ForeignKey(Examen, on_delete=models.CASCADE, related_name="preguntas")

    enunciado = models.TextField()
    tipo = models.CharField(max_length=30, choices=TIPOS, default="OPCION_MULTIPLE")
    dificultad = models.CharField(max_length=10, choices=DIFICULTAD, default="MEDIA")

    tema = models.CharField(max_length=200, blank=True)
    resultado_aprendizaje = models.CharField(max_length=250, blank=True)

    ponderacion = models.DecimalField(
        max_digits=6, decimal_places=2, default=1.0, validators=[MinValueValidator(0.01)]
    )
    orden = models.IntegerField(default=0)

    explicacion = models.TextField(blank=True)
    respuesta_texto = models.TextField(blank=True)  # para RESPUESTA_CORTA

    ia_metadata = models.JSONField(default=dict, blank=True)

    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "preguntas"
        ordering = ["examen", "orden"]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.examen_id:
            self.examen.calcular_puntaje_total(save=True)


class OpcionRespuesta(models.Model):
    id_opcion = models.AutoField(primary_key=True)
    pregunta = models.ForeignKey(Pregunta, on_delete=models.CASCADE, related_name="opciones")
    clave = models.CharField(max_length=1, blank=True)  # "A","B","C","D"
    texto = models.TextField()
    es_correcta = models.BooleanField(default=False)
    orden = models.IntegerField(default=0)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "opciones_respuesta"
        ordering = ["pregunta", "orden"]


class Horario(models.Model):
    id_horario = models.AutoField(primary_key=True)
    examen = models.ForeignKey(Examen, on_delete=models.CASCADE, related_name="horarios")
    grupo = models.CharField(max_length=100, blank=True)
    fecha = models.DateField()
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()
    aula = models.CharField(max_length=50, blank=True)
    cupos_maximos = models.IntegerField(null=True, blank=True)
    estudiantes_ids = models.JSONField(default=list, blank=True)
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "horarios"
        ordering = ["fecha", "hora_inicio"]
