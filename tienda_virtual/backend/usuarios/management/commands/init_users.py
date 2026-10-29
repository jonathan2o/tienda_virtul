from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction
from usuarios.models import PerfilUsuario


class Command(BaseCommand):
    help = 'Inicializa o actualiza los usuarios admin y trabajador con sus roles y credenciales'

    def handle(self, *args, **options):
        with transaction.atomic():
            # Configuración de usuario Administrador
            admin_user, _ = User.objects.get_or_create(username='admin')
            admin_user.set_password('admin123')
            admin_user.is_superuser = True
            admin_user.is_staff = True
            admin_user.is_active = True
            admin_user.save()

            perfil_admin, _ = PerfilUsuario.objects.get_or_create(user=admin_user)
            perfil_admin.rol = PerfilUsuario.ROL_ADMIN
            perfil_admin.save()
            self.stdout.write(self.style.SUCCESS('Usuario "admin" configurado correctamente (rol: admin, password: admin123).'))

            # Configuración de usuario Trabajador
            worker_user, _ = User.objects.get_or_create(username='trabajador')
            worker_user.set_password('worker123')
            worker_user.is_superuser = False
            worker_user.is_staff = False
            worker_user.is_active = True
            worker_user.save()

            perfil_worker, _ = PerfilUsuario.objects.get_or_create(user=worker_user)
            perfil_worker.rol = PerfilUsuario.ROL_WORKER
            perfil_worker.save()
            self.stdout.write(self.style.SUCCESS('Usuario "trabajador" configurado correctamente (rol: worker, password: worker123).'))
