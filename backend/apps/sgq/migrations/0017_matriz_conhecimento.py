from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

import apps.sgq.models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('sgq', '0016_escopoanalise'),
    ]

    operations = [
        migrations.CreateModel(
            name='PastaMatrizSGQ',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nome', models.CharField(max_length=120, verbose_name='Nome')),
                ('criado_em', models.DateTimeField(auto_now_add=True)),
                ('parent', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='subpastas', to='sgq.pastamatrizsgq', verbose_name='Pasta superior')),
            ],
            options={
                'verbose_name': 'Pasta da matriz de conhecimento do SGQ',
                'verbose_name_plural': 'Pastas da matriz de conhecimento do SGQ',
                'ordering': ['nome', 'pk'],
            },
        ),
        migrations.CreateModel(
            name='DocumentoSGQ',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('titulo', models.CharField(max_length=160, verbose_name='Título')),
                ('arquivo', models.FileField(blank=True, upload_to=apps.sgq.models.documento_sgq_upload_path, verbose_name='Arquivo')),
                ('drive_file_id', models.CharField(blank=True, default='', max_length=128, verbose_name='ID no Google Drive')),
                ('link_externo', models.CharField(blank=True, default='', max_length=500, verbose_name='Link no Google Drive')),
                ('nome_original', models.CharField(max_length=180, verbose_name='Nome do arquivo')),
                ('tamanho', models.PositiveIntegerField(default=0, verbose_name='Tamanho em bytes')),
                ('texto', models.TextField(blank=True, default='', verbose_name='Texto para consulta')),
                ('texto_extraido', models.BooleanField(default=False, verbose_name='Texto já extraído')),
                ('criado_em', models.DateTimeField(auto_now_add=True, verbose_name='Incluído em')),
                ('incluido_por', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='documentos_sgq', to=settings.AUTH_USER_MODEL, verbose_name='Incluído por')),
                ('pasta', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='documentos', to='sgq.pastamatrizsgq', verbose_name='Pasta')),
            ],
            options={
                'verbose_name': 'Documento do SGQ',
                'verbose_name_plural': 'Documentos do SGQ',
                'ordering': ['-criado_em'],
            },
        ),
    ]
