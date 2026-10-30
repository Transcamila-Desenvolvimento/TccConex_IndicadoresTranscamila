import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0035_auditoria_detalhes_plano'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='AuditoriaFormDraft',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('filial', models.CharField(max_length=100)),
                ('version', models.PositiveSmallIntegerField(default=1)),
                ('payload', models.JSONField(default=dict)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('usuario', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sgq_auditoria_form_drafts', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Rascunho de Auditoria',
                'verbose_name_plural': 'Rascunhos de Auditoria',
                'constraints': [models.UniqueConstraint(fields=('usuario', 'filial'), name='uniq_sgq_auditoria_form_draft_usuario_filial')],
            },
        ),
    ]
