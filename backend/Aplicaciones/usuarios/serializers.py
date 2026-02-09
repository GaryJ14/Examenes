# ============================================
# Aplicaciones/usuarios/serializers.py
# ============================================
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import Usuario, FotoPerfil, SesionUsuario


class FotoPerfilSerializer(serializers.ModelSerializer):
    class Meta:
        model = FotoPerfil
        fields = ['id_foto', 'foto', 'foto_validacion', 'validada', 'fecha_subida', 'fecha_actualizacion']


class FotoValidacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = FotoPerfil
        fields = ["foto_validacion", "validada"]
        extra_kwargs = {
            "foto_validacion": {"required": True},
            "validada": {"required": False},
        }


class UsuarioSerializer(serializers.ModelSerializer):
    foto_perfil = FotoPerfilSerializer(read_only=True)
    nombre_completo = serializers.CharField(read_only=True)

    class Meta:
        model = Usuario
        fields = [
            'id_usuario', 'cedula', 'nombres', 'apellidos', 'nombre_completo',
            'correo_electronico', 'rol', 'is_active', 'foto_perfil'
        ]


class RegistroUsuarioSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirmacion = serializers.CharField(write_only=True)

    class Meta:
        model = Usuario
        fields = ['cedula', 'nombres', 'apellidos', 'correo_electronico', 'password', 'password_confirmacion', 'rol']

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirmacion']:
            raise serializers.ValidationError({"password": "Las contraseñas no coinciden"})
        attrs.pop('password_confirmacion', None)
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        usuario = Usuario.objects.create_user(password=password, **validated_data)
        FotoPerfil.objects.create(usuario=usuario)
        return usuario


class ActualizarUsuarioSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, validators=[validate_password])
    password_confirmacion = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Usuario
        fields = ['nombres', 'apellidos', 'correo_electronico', 'password', 'password_confirmacion', 'rol']

    def validate(self, attrs):
        password = attrs.get('password')
        password_confirmacion = attrs.get('password_confirmacion')

        if password or password_confirmacion:
            if password != password_confirmacion:
                raise serializers.ValidationError({"password": "Las contraseñas no coinciden"})

        attrs.pop('password_confirmacion', None)
        return attrs

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()
        return instance


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class SesionUsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = SesionUsuario
        fields = ['id_sesion', 'ip_address', 'user_agent', 'expira_en', 'creado_en', 'activo']
