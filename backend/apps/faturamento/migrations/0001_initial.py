# Generated manually for apps.faturamento

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ClienteProtocolo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nome', models.CharField(max_length=200)),
                ('cnpj', models.CharField(blank=True, max_length=20, null=True)),
                ('requer_expedicao', models.BooleanField(default=False, verbose_name='Requer expedição?')),
                ('emails_envio', models.TextField(blank=True, null=True, verbose_name='E-mails para envio')),
                ('emails_copia', models.TextField(blank=True, null=True, verbose_name='E-mails em cópia')),
                ('data_criacao', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Cliente de protocolo',
                'verbose_name_plural': 'Clientes de protocolo',
                'ordering': ['nome'],
            },
        ),
        migrations.CreateModel(
            name='ProtocoloEnvio',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('data', models.DateField(verbose_name='Data de envio')),
                ('nota_fiscal', models.TextField(help_text='Números das NFs separados por vírgula (até 60)')),
                ('expedicao', models.CharField(blank=True, choices=[('Transcamila Ibiporã', 'Transcamila Ibiporã'), ('Transcamila Barueri', 'Transcamila Barueri'), ('Transcamila Paranaguá', 'Transcamila Paranaguá'), ('Transcamila Rondonópolis', 'Transcamila Rondonópolis'), ('Retira', 'Retira'), ('Outro', 'Outro')], max_length=50, null=True, verbose_name='Expedição')),
                ('usuario_nome', models.CharField(blank=True, default='', max_length=150)),
                ('access_token', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('data_criacao', models.DateTimeField(auto_now_add=True)),
                ('data_atualizacao', models.DateTimeField(auto_now=True)),
                ('cliente', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='protocolos', to='faturamento.clienteprotocolo', verbose_name='Cliente')),
                ('usuario', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='protocolos_envio', to=settings.AUTH_USER_MODEL, verbose_name='Indexador')),
            ],
            options={
                'verbose_name': 'Protocolo de envio',
                'verbose_name_plural': 'Protocolos de envio',
                'ordering': ['-data', '-data_criacao'],
            },
        ),
    ]
