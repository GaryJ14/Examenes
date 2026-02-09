# ============================================
# Aplicaciones/usuarios/permissions.py
# ============================================
from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    message = 'Solo los administradores pueden realizar esta acción'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.rol == 'ADMIN')


class IsDocente(permissions.BasePermission):
    message = 'Solo los docentes pueden realizar esta acción'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.rol == 'DOCENTE')


class IsEstudiante(permissions.BasePermission):
    message = 'Solo los estudiantes pueden realizar esta acción'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.rol == 'ESTUDIANTE')


class IsAdminOrDocente(permissions.BasePermission):
    message = 'Solo administradores y docentes pueden realizar esta acción'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.rol in ['ADMIN', 'DOCENTE'])


class IsOwnerOrAdmin(permissions.BasePermission):
    message = 'Solo el propietario o un administrador pueden realizar esta acción'

    def has_object_permission(self, request, view, obj):
        if request.user.rol == 'ADMIN':
            return True

        if hasattr(obj, 'usuario'):
            return obj.usuario == request.user
        if hasattr(obj, 'id'):
            return obj.id == request.user.id

        return False
