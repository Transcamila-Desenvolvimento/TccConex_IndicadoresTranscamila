import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0012_alter_pesquisasatisfacao_cliente'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PesquisaSatisfacaoFormDraft',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('filial', models.CharField(max_length=100)),
                ('version', models.PositiveSmallIntegerField(default=1)),
                ('payload', models.JSONField(default=dict)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('usuario', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sgq_form_drafts', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Rascunho de Lançamento de Pesquisa',
                'verbose_name_plural': 'Rascunhos de Lançamento de Pesquisa',
                'constraints': [models.UniqueConstraint(fields=('usuario', 'filial'), name='uniq_sgq_form_draft_usuario_filial')],
            },
        ),
    ]
