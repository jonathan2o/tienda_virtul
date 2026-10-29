from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.models import User

from .models import PerfilUsuario
from .permissions import IsAdminRole


class UsuariosListaView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        rol = request.query_params.get('rol')
        usuarios = User.objects.select_related('perfil').all().order_by('username')
        if rol in ('admin', 'worker'):
            usuarios = [u for u in usuarios if getattr(getattr(u, 'perfil', None), 'rol', None) == rol]
        return Response([{
            'id': u.id,
            'username': u.username,
            'rol': u.perfil.rol if hasattr(u, 'perfil') else None,
        } for u in usuarios])


class LoginView(APIView):
    permission_classes = []

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        if not username or not password:
            return Response(
                {'error': 'username y password son requeridos.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = authenticate(username=username, password=password)
        if user is None:
            return Response(
                {'error': 'Credenciales inválidas.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        try:
            rol = user.perfil.rol
        except PerfilUsuario.DoesNotExist:
            rol = PerfilUsuario.ROL_WORKER

        if user.is_superuser:
            rol = PerfilUsuario.ROL_ADMIN

        refresh = RefreshToken.for_user(user)

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'username': user.username,
            'rol': rol,
        })
