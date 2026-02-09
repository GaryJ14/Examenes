from django.contrib import admin
from .models import RegistroMonitoreo, Advertencia, Expulsion
# Register your models here.
admin.site.register(RegistroMonitoreo)
admin.site.register(Advertencia)
admin.site.register(Expulsion)
