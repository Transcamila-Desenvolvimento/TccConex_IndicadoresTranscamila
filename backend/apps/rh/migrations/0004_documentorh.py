from django.conf import settings
from django.db import migrations, models
import apps.rh.models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('rh', '0003_pj_historico_motivo_alteracao_salario'),
    ]

    operations = [
        migrations.CreateModel(
            name='DocumentoRH',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('titulo', models.CharField(max_length=160, verbose_name='Título')),
                ('arquivo', models.FileField(upload_to=apps.rh.models.documento_upload_path, verbose_name='Arquivo')),
                ('nome_original', models.CharField(max_length=180, verbose_name='Nome do arquivo')),
                ('tamanho', models.PositiveIntegerField(default=0, verbose_name='Tamanho em bytes')),
                ('liberado_agente', models.BooleanField(default=False, verbose_name='Liberado para o agente')),
                ('criado_em', models.DateTimeField(auto_now_add=True, verbose_name='Incluído em')),
                ('incluido_por', models.ForeignKey(blank=True, null=True, on_delete=models.deletion.SET_NULL, related_name='documentos_rh', to=settings.AUTH_USER_MODEL, verbose_name='Incluído por')),
            ],
            options={
                'verbose_name': 'Documento do RH',
                'verbose_name_plural': 'Documentos do RH',
                'ordering': ['-criado_em'],
            },
        ),
    ]
