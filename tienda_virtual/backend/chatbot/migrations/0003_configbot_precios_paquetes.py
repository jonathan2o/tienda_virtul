from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('chatbot', '0002_alter_configbot_activo_alter_configbot_modo'),
    ]

    operations = [
        migrations.AddField(
            model_name='configbot',
            name='precios_paquetes',
            field=models.JSONField(
                blank=True,
                default=dict,
                verbose_name='Parrilla de precios por paquete (envío incluido)',
            ),
        ),
    ]
