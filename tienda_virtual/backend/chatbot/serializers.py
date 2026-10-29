from rest_framework import serializers

from stock.models import Stock

from .models import ConfigBot, Conversacion, Mensaje


class ConfigBotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfigBot
        fields = ['id', 'activo', 'modo', 'tono', 'reglas_extra', 'hora_inicio', 'hora_fin']


class MensajeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mensaje
        fields = ['id', 'conversacion', 'autor', 'texto', 'fecha']
        read_only_fields = ['id', 'fecha']


class ConversacionSerializer(serializers.ModelSerializer):
    mensajes = MensajeSerializer(many=True, read_only=True)

    class Meta:
        model = Conversacion
        fields = ['id', 'chat_id', 'nombre_cliente', 'telefono_cliente', 'estado', 'fecha_creacion', 'ultima_actividad', 'mensajes']
        read_only_fields = ['id', 'fecha_creacion', 'ultima_actividad']


class SimuladorInputSerializer(serializers.Serializer):
    chat_id = serializers.CharField(max_length=32, default='simulador')
    nombre_cliente = serializers.CharField(max_length=150, required=False, default='Cliente de prueba')
    mensaje = serializers.CharField()


class ResponderInputSerializer(serializers.Serializer):
    texto = serializers.CharField()
