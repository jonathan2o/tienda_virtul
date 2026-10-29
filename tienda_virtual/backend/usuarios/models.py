from django.contrib.auth.models import User
from django.db import models


class PerfilUsuario(models.Model):
    ROL_ADMIN = 'admin'
    ROL_WORKER = 'worker'
    ROL_CHOICES = [
        (ROL_ADMIN, 'Administrador'),
        (ROL_WORKER, 'Trabajador'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='perfil')
    rol = models.CharField(max_length=10, choices=ROL_CHOICES, default=ROL_WORKER)

    def __str__(self):
        return f"{self.user.username} ({self.get_rol_display()})"
