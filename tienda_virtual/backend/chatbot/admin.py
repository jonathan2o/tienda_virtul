from django.contrib import admin

from .models import ConfigBot, Conversacion, Mensaje


@admin.register(ConfigBot)
class ConfigBotAdmin(admin.ModelAdmin):
    list_display = ('activo', 'modo', 'hora_inicio', 'hora_fin')


@admin.register(Conversacion)
class ConversacionAdmin(admin.ModelAdmin):
    list_display = ('chat_id', 'nombre_cliente', 'estado', 'ultima_actividad')
    search_fields = ('chat_id', 'nombre_cliente')


@admin.register(Mensaje)
class MensajeAdmin(admin.ModelAdmin):
    list_display = ('conversacion', 'autor', 'fecha')
    search_fields = ('texto',)
