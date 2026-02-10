# ============================================
# config/urls.py
# ============================================
from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

# Configuración de Swagger/OpenAPI
schema_view = get_schema_view(
    openapi.Info(
        title="Sistema de Monitoreo API",
        default_version='v1',
        description="API para el sistema de monitoreo de exámenes",
        contact=openapi.Contact(email="admin@monitoreo.com"),
        license=openapi.License(name="MIT License"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    path("", lambda r: JsonResponse({"ok": True, "docs": ["/swagger/", "/redoc/"]})),
    # Admin
    path('admin/', admin.site.urls),
      # Auth JWT
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # API Documentation
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    
    # API Endpoints
    path('api/usuarios/', include('Aplicaciones.usuarios.urls')),
    path('api/examenes/', include('Aplicaciones.examenes.urls')),
    path('api/monitoreo/', include('Aplicaciones.monitoreo.urls')),
    path('api/reportes/', include('Aplicaciones.reportes.urls')),
    path('api/analisis/', include('Aplicaciones.analisis.urls')),
]



# Static y Media files en desarrollo
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Personalización del admin
admin.site.site_header = "Sistema de Monitoreo - Administración"
admin.site.site_title = "Monitoreo Admin"
admin.site.index_title = "Panel de Administración"
