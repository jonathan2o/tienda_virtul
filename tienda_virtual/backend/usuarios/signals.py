from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import PerfilUsuario


@receiver(post_save, sender=User)
def crear_perfil(sender, instance, created, **kwargs):
    if created:
        PerfilUsuario.objects.get_or_create(user=instance)


@receiver(post_save, sender=User)
def guardar_perfil(sender, instance, **kwargs):
    if hasattr(instance, 'perfil'):
        instance.perfil.save()
