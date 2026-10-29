from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('stock', '0012_auditoriacambio'),
    ]

    operations = [
        migrations.DeleteModel(
            name='AuditoriaCambio',
        ),
        migrations.DeleteModel(
            name='AjusteComision',
        ),
        migrations.DeleteModel(
            name='Liquidacion',
        ),
        migrations.DeleteModel(
            name='CierreQuincenal',
        ),
    ]
