import uuid

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Agente',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('nome', models.CharField(max_length=80)),
                ('instrucao', models.TextField(blank=True, default='')),
                ('escopos', models.JSONField(blank=True, default=list)),
                ('criado_em', models.DateTimeField(auto_now_add=True)),
                ('atualizado_em', models.DateTimeField(auto_now=True)),
                ('usuario', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='agentes_camilo', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Agente CamiloIA',
                'verbose_name_plural': 'Agentes CamiloIA',
                'ordering': ['-criado_em'],
            },
        ),
    ]
