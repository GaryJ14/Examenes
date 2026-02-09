# ============================================
# Aplicaciones/usuarios/views.py
# ============================================
from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.contrib.auth import authenticate

from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .models import Usuario, FotoPerfil, SesionUsuario
from .serializers import (
    UsuarioSerializer,
    RegistroUsuarioSerializer,
    ActualizarUsuarioSerializer,
    FotoValidacionSerializer,
    LogoutSerializer,
    SesionUsuarioSerializer,
)
from .permissions import IsAdmin, IsAdminOrDocente


class RegistroUsuarioView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegistroUsuarioSerializer(data=request.data)
        if serializer.is_valid():
            usuario = serializer.save()
            return Response(
                {'mensaje': 'Usuario registrado exitosamente', 'usuario': UsuarioSerializer(usuario).data},
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginUsuarioView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        correo_electronico = request.data.get('correo_electronico')
        password = request.data.get('password')

        usuario = authenticate(request, username=correo_electronico, password=password)
        if not usuario:
            return Response({'error': 'Credenciales incorrectas'}, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(usuario)
        access = refresh.access_token

        # Registrar sesión activa con hash del refresh token
        ip = request.META.get("REMOTE_ADDR")
        ua = request.META.get("HTTP_USER_AGENT", "")

        # Expiración alineada a SIMPLE_JWT['REFRESH_TOKEN_LIFETIME']
        expira_en = timezone.now() + timedelta(days=7)

        SesionUsuario.objects.create(
            usuario=usuario,
            token_hash=SesionUsuario.hash_token(str(refresh)),
            ip_address=ip,
            user_agent=ua,
            expira_en=expira_en,
            activo=True,
        )

        return Response({
            'access': str(access),
            'refresh': str(refresh),
            'usuario': UsuarioSerializer(usuario).data
        }, status=status.HTTP_200_OK)


class LogoutUsuarioView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Logout seguro:
        - Recibe refresh token
        - Lo blacklistea
        - Desactiva sesión interna por token_hash
        """
        serializer = LogoutSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        refresh_token = serializer.validated_data["refresh"]
        token_hash = SesionUsuario.hash_token(refresh_token)

        try:
            rt = RefreshToken(refresh_token)
            rt.blacklist()  
        except TokenError:
            # Si el token ya está inválido/blacklisted, igual desactivamos sesión interna si existe
            pass

        SesionUsuario.objects.filter(usuario=request.user, token_hash=token_hash, activo=True).update(activo=False)

        return Response({'mensaje': 'Sesión cerrada exitosamente'}, status=status.HTTP_200_OK)


class ListaUsuariosView(APIView):
    # Cambia aquí si quieres que SOLO admin liste usuarios
    permission_classes = [IsAuthenticated, IsAdminOrDocente]

    def get(self, request):
        rol = request.query_params.get('rol')
        usuarios = Usuario.objects.all().order_by('id_usuario')
        if rol:
            usuarios = usuarios.filter(rol=rol)
        serializer = UsuarioSerializer(usuarios, many=True)
        return Response({'total': usuarios.count(), 'usuarios': serializer.data}, status=status.HTTP_200_OK)


class PerfilUsuarioView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UsuarioSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ObtenerUsuarioView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrDocente]

    def get(self, request, id):
        usuario = get_object_or_404(Usuario, id_usuario=id)
        serializer = UsuarioSerializer(usuario)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ActualizarUsuarioView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def put(self, request, id):
        usuario = get_object_or_404(Usuario, id_usuario=id)

        serializer = ActualizarUsuarioSerializer(usuario, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"mensaje": "Usuario actualizado correctamente", "usuario": serializer.data}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class EliminarUsuarioView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def delete(self, request, id):
        usuario = get_object_or_404(Usuario, id_usuario=id)

        if not usuario.is_active:
            return Response({"detail": "El usuario ya está desactivado"}, status=status.HTTP_400_BAD_REQUEST)

        usuario.is_active = False
        usuario.save(update_fields=["is_active"])
        return Response({"mensaje": "Usuario desactivado correctamente"}, status=status.HTTP_200_OK)


class ActivarUsuarioView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, id):
        usuario = get_object_or_404(Usuario, id_usuario=id)

        if usuario.is_active:
            return Response({"detail": "El usuario ya está activo"}, status=status.HTTP_400_BAD_REQUEST)

        usuario.is_active = True
        usuario.save(update_fields=["is_active"])
        return Response({"mensaje": "Usuario activado correctamente"}, status=status.HTTP_200_OK)


class SubirFotoValidacionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Subida de foto de validación:
        - Para tu flujo actual: con solo subir la foto ya se habilita el intento.
        - Por eso marcamos validada=True al guardar la foto_validacion.
        """
        foto_perfil, _ = FotoPerfil.objects.get_or_create(usuario=request.user)

        serializer = FotoValidacionSerializer(
            foto_perfil, data=request.data, partial=True
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        obj = serializer.save()

        # ✅ REGLA NUEVA: si existe foto_validacion, entonces "validada" = True
        if obj.foto_validacion and not obj.validada:
            obj.validada = True
            obj.save(update_fields=["validada"])

        return Response(
            {
                "mensaje": "Foto de validación subida correctamente",
                "validada": obj.validada,
                "foto_validacion": obj.foto_validacion.url if obj.foto_validacion else None,
            },
            status=status.HTTP_200_OK,
        )


class MisSesionesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sesiones = SesionUsuario.objects.filter(usuario=request.user).order_by("-creado_en")
        return Response(SesionUsuarioSerializer(sesiones, many=True).data, status=status.HTTP_200_OK)


class CerrarTodasMisSesionesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Desactiva sesiones internas.
        Nota: Para blacklist total necesitarías los refresh tokens en claro (no recomendado).
        Este endpoint sirve como 'control de sesiones activas' 
        """
        SesionUsuario.objects.filter(usuario=request.user, activo=True).update(activo=False)
        return Response({"mensaje": "Todas las sesiones han sido cerradas"}, status=status.HTTP_200_OK)
