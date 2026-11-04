import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def gravar_revisao_zero(apps, schema_editor):
    Procedimento = apps.get_model('sgq', 'ProcedimentoSipocSGQ')
    Revisao = apps.get_model('sgq', 'RevisaoSipocSGQ')
    for item in Procedimento.objects.all().iterator():
        revisao = Revisao.objects.create(
            procedimento_id=item.id,
            numero=0,
            nome=item.nome,
            descricao=item.descricao,
            esquema=item.esquema or {'nos': [], 'ligacoes': []},
            observacao='',
            criado_por_id=item.criado_por_id,
        )
        Revisao.objects.filter(pk=revisao.pk).update(criado_em=item.criado_em)


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('sgq', '0038_sipoc_criado_por'),
    ]

    operations = [
        migrations.CreateModel(
            name='RevisaoSipocSGQ',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('numero', models.PositiveIntegerField(verbose_name='Revisão')),
                ('nome', models.CharField(max_length=140, verbose_name='Nome')),
                ('descricao', models.CharField(blank=True, max_length=300, verbose_name='Descrição')),
                ('esquema', models.JSONField(blank=True, default=dict)),
                ('observacao', models.CharField(blank=True, max_length=300, verbose_name='Observação')),
                ('criado_em', models.DateTimeField(auto_now_add=True)),
                ('criado_por', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='revisoes_sipoc_sgq', to=settings.AUTH_USER_MODEL, verbose_name='Criado por')),
                ('procedimento', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='revisoes', to='sgq.procedimentosipocsgq')),
            ],
            options={
                'verbose_name': 'Revisão do SIPOC',
                'verbose_name_plural': 'Revisões do SIPOC',
                'ordering': ['-numero', '-pk'],
            },
        ),
        migrations.AddConstraint(
            model_name='revisaosipocsgq',
            constraint=models.UniqueConstraint(fields=('procedimento', 'numero'), name='uniq_sipoc_revisao'),
        ),
        migrations.RunPython(gravar_revisao_zero, migrations.RunPython.noop),
    ]
