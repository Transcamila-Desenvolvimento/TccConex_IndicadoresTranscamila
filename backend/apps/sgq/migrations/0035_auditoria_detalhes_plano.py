from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0034_auditoria_planejamento'),
    ]

    operations = [
        migrations.AddField(
            model_name='auditoriasgq',
            name='criterios',
            field=models.TextField(blank=True, default='', verbose_name='Critérios'),
        ),
        migrations.AddField(
            model_name='auditoriasgq',
            name='processos_areas',
            field=models.TextField(blank=True, default='', verbose_name='Processos e áreas a serem auditados'),
        ),
        migrations.AddField(
            model_name='auditoriasgq',
            name='responsaveis_processos',
            field=models.TextField(blank=True, default='', verbose_name='Responsáveis pelo processo'),
        ),
        migrations.AddField(
            model_name='auditoriasgq',
            name='metodologia',
            field=models.TextField(blank=True, default='', verbose_name='Metodologia'),
        ),
    ]
