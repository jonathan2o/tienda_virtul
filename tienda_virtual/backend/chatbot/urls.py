from django.urls import path

from .views import (
    catalogo_bot,
    config_bot,
    estado_bot,
    conversaciones_lista,
    conversacion_mensajes,
    tomar_chat,
    responder_manual,
    simulador,
    consultar_gemini,
)

urlpatterns = [
    path('chatbot/catalogo/', catalogo_bot, name='chatbot-catalogo'),
    path('chatbot/config/', config_bot, name='chatbot-config'),
    path('chatbot/estado/', estado_bot, name='chatbot-estado'),
    path('chatbot/conversaciones/', conversaciones_lista, name='chatbot-conversaciones'),
    path('chatbot/conversaciones/<int:pk>/mensajes/', conversacion_mensajes, name='chatbot-mensajes'),
    path('chatbot/conversaciones/<int:pk>/tomar-chat/', tomar_chat, name='chatbot-tomar-chat'),
    path('chatbot/conversaciones/<int:pk>/responder/', responder_manual, name='chatbot-responder'),
    path('chatbot/simulador/', simulador, name='chatbot-simulador'),
    path('chatbot/gemini/', consultar_gemini, name='chatbot-gemini'),
]
