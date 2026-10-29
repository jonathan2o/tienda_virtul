from django.db import models


class ConfigBot(models.Model):
    activo = models.BooleanField(default=True, verbose_name="Robot activo")
    modo = models.CharField(
        max_length=15,
        choices=[('autonomo', 'Autónomo'), ('revision', 'Revisión')],
        default='autonomo',
        verbose_name="Modo",
    )
    tono = models.TextField(
        blank=True,
        default="Cercano, claro y resolutivo. Responde en español con mensajes cortos.",
        verbose_name="Tono / personalidad",
    )
    reglas_extra = models.TextField(
        blank=True,
        default="",
        verbose_name="Reglas adicionales de negocio",
    )
    hora_inicio = models.TimeField(null=True, blank=True, verbose_name="Inicio de atención")
    hora_fin = models.TimeField(null=True, blank=True, verbose_name="Fin de atención")

    class Meta:
        verbose_name = "Configuración del Chatbot"
        verbose_name_plural = "Configuración del Chatbot"

    def __str__(self):
        return f"ConfigBot (activo={self.activo}, modo={self.modo})"

    @classmethod
    def obtener(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class Conversacion(models.Model):
    ESTADO_BOT = 'bot'
    ESTADO_HUMANO = 'humano'
    ESTADO_PAUSADA = 'pausada'
    ESTADO_CHOICES = [
        (ESTADO_BOT, 'Bot'),
        (ESTADO_HUMANO, 'Humano'),
        (ESTADO_PAUSADA, 'Pausada'),
    ]

    chat_id = models.CharField(max_length=32, unique=True, verbose_name="ID del chat (WhatsApp)")
    nombre_cliente = models.CharField(max_length=150, blank=True, default='')
    telefono_cliente = models.CharField(max_length=32, blank=True, default='')
    estado = models.CharField(max_length=15, choices=ESTADO_CHOICES, default=ESTADO_BOT)
    contexto = models.JSONField(default=dict, blank=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    ultima_actividad = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-ultima_actividad']

    def __str__(self):
        return f"{self.chat_id} ({self.estado})"


class Mensaje(models.Model):
    AUTOR_CLIENTE = 'cliente'
    AUTOR_BOT = 'bot'
    AUTOR_HUMANO = 'humano'
    AUTOR_CHOICES = [
        (AUTOR_CLIENTE, 'Cliente'),
        (AUTOR_BOT, 'Bot'),
        (AUTOR_HUMANO, 'Humano'),
    ]

    conversacion = models.ForeignKey(
        Conversacion,
        on_delete=models.CASCADE,
        related_name='mensajes',
    )
    autor = models.CharField(max_length=15, choices=AUTOR_CHOICES, default=AUTOR_CLIENTE)
    texto = models.TextField()
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['fecha']

    def __str__(self):
        return f"[{self.autor}] {self.texto[:40]}"
