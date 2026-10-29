from rest_framework.permissions import BasePermission, SAFE_METHODS

from usuarios.models import PerfilUsuario


def _es_admin(user):
    if not (user and user.is_authenticated):
        return False
    if user.is_superuser:
        return True
    try:
        return user.perfil.rol == PerfilUsuario.ROL_ADMIN
    except PerfilUsuario.DoesNotExist:
        return False


class IsAdminRole(BasePermission):
    message = 'Solo administradores pueden realizar esta acción.'

    def has_permission(self, request, view):
        return _es_admin(request.user)


class IsAdminOrReadOnly(BasePermission):
    message = 'Solo administradores pueden modificar este recurso.'

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return _es_admin(request.user)
