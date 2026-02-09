from django.contrib import admin
from .models import Examen, Pregunta, OpcionRespuesta, Horario
# Register your models here.
admin.site.register(Examen)
admin.site.register(Pregunta)
admin.site.register(OpcionRespuesta)
admin.site.register(Horario)