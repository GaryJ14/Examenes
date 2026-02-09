# ============================================
# Aplicaciones/usuarios/urls.py
# ============================================
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegistroUsuarioView,
    LoginUsuarioView,
    LogoutUsuarioView,
    ListaUsuariosView,
    ObtenerUsuarioView,
    ActualizarUsuarioView,
    EliminarUsuarioView,
    ActivarUsuarioView,
    PerfilUsuarioView,
    SubirFotoValidacionView,
    MisSesionesView,
    CerrarTodasMisSesionesView,
)

app_name = 'usuarios'

urlpatterns = [
    path('auth/registro/', RegistroUsuarioView.as_view(), name='registro'),
    path('auth/login/', LoginUsuarioView.as_view(), name='login'),
    path('auth/logout/', LogoutUsuarioView.as_view(), name='logout'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    path('usuarios/', ListaUsuariosView.as_view(), name='lista'),
    path('usuarios/<int:id>/', ObtenerUsuarioView.as_view(), name='obtener'),
    path('usuarios/<int:id>/actualizar/', ActualizarUsuarioView.as_view(), name='actualizar'),
    path('usuarios/<int:id>/eliminar/', EliminarUsuarioView.as_view(), name='eliminar'),
    path('usuarios/<int:id>/activar/', ActivarUsuarioView.as_view(), name='activar_usuario'),

    path('perfil/', PerfilUsuarioView.as_view(), name='perfil'),

    path('foto-perfil/validacion/', SubirFotoValidacionView.as_view(), name='foto_validacion'),

    # Control de sesiones activas
    path('sesiones/mis/', MisSesionesView.as_view(), name='mis_sesiones'),
    path('sesiones/cerrar-todas/', CerrarTodasMisSesionesView.as_view(), name='cerrar_todas_sesiones'),
]
