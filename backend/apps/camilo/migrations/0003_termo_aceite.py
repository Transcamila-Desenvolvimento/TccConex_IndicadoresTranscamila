import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('camilo', '0002_chat_padrao'),
    ]

    operations = [
        migrations.CreateModel(
            name='TermoAceite',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('versao', models.CharField(max_length=16)),
                ('nome', models.CharField(max_length=255)),
                ('username', models.CharField(max_length=150)),
                ('texto', models.JSONField(default=dict)),
                ('ip', models.CharField(blank=True, default='', max_length=64)),
                ('aceito_em', models.DateTimeField(auto_now_add=True)),
                ('usuario', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='termos_camilo',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Aceite do termo CamiloIA',
                'verbose_name_plural': 'Aceites do termo CamiloIA',
                'ordering': ['-aceito_em'],
            },
        ),
        migrations.AddConstraint(
            model_name='termoaceite',
            constraint=models.UniqueConstraint(fields=('usuario', 'versao'), name='camilo_termo_usuario_versao'),
        ),
    ]
