# ============================================
# Aplicaciones/usuarios/models.py
# ============================================
import os
import hashlib
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.validators import RegexValidator
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin


def ruta_foto_usuario(instance, filename):
    ext = filename.split('.')[-1]
    filename = f"{instance.usuario.cedula}_{instance.usuario.id_usuario}.{ext}"
    return os.path.join('fotos_perfil', filename)


class UserManager(BaseUserManager):
    def create_user(self, correo_electronico, cedula, password=None, **extra_fields):
        if not correo_electronico:
            raise ValueError('El correo electrónico es obligatorio')
        if not cedula:
            raise ValueError('La cédula es obligatoria')

        correo_electronico = self.normalize_email(correo_electronico)
        user = self.model(correo_electronico=correo_electronico, cedula=cedula, **extra_fields)

        if password:
            user.set_password(password)
        else:
            raise ValueError("La contraseña es obligatoria")

        user.save(using=self._db)
        return user

    def create_superuser(self, correo_electronico, cedula, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('rol', 'ADMIN')
        return self.create_user(correo_electronico, cedula, password, **extra_fields)


class Usuario(AbstractBaseUser, PermissionsMixin):
    ROLES = (
        ('ADMIN', 'Administrador'),
        ('DOCENTE', 'Docente'),
        ('ESTUDIANTE', 'Estudiante'),
    )

    cedula_validator = RegexValidator(regex=r'^\d{10}$', message='La cédula debe tener 10 dígitos')

    id_usuario = models.AutoField(primary_key=True)
    cedula = models.CharField(max_length=10, unique=True, validators=[cedula_validator], db_index=True)
    nombres = models.CharField(max_length=100)
    apellidos = models.CharField(max_length=100)
    correo_electronico = models.EmailField(unique=True, db_index=True)
    rol = models.CharField(max_length=20, choices=ROLES, default='ESTUDIANTE')

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'correo_electronico'
    REQUIRED_FIELDS = ['cedula', 'nombres', 'apellidos']

    class Meta:
        db_table = 'usuarios'
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'
        ordering = ['-fecha_creacion']

    def __str__(self):
        return f"{self.nombres} {self.apellidos}"

    @property
    def id(self):
        return self.id_usuario

    @property
    def nombre_completo(self):
        return f"{self.nombres} {self.apellidos}"


class SesionUsuario(models.Model):
    """
    Sesiones activas del usuario.
    Guardamos hash del refresh token (NUNCA el token en claro).
    """
    id_sesion = models.AutoField(primary_key=True)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sesiones')

    token_hash = models.CharField(max_length=64, unique=True, db_index=True)  # SHA-256 hex = 64 chars
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)

    expira_en = models.DateTimeField()
    creado_en = models.DateTimeField(auto_now_add=True)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'sesiones_usuario'
        ordering = ['-creado_en']

    def is_expired(self):
        return timezone.now() > self.expira_en

    @staticmethod
    def hash_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()


class FotoPerfil(models.Model):
    id_foto = models.AutoField(primary_key=True)
    usuario = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='foto_perfil')

    foto = models.ImageField(upload_to=ruta_foto_usuario)
    foto_validacion = models.ImageField(upload_to='fotos_validacion/', null=True, blank=True)

    embeddings = models.JSONField(null=True, blank=True)
    validada = models.BooleanField(default=False)

    fecha_subida = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'fotos_perfil'
