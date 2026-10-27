from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def cadastrar_categorias_usadas(apps, schema_editor):
    """Cada categoria digitada nas auditorias existentes vira um cadastro ativo da filial."""
    AuditoriaSGQ = apps.get_model('sgq', 'AuditoriaSGQ')
    CategoriaAuditoriaSGQ = apps.get_model('sgq', 'CategoriaAuditoriaSGQ')
    vistas = set()
    for filial, nome in AuditoriaSGQ.objects.values_list('filial', 'categoria').distinct():
        nome = (nome or '').strip()[:120]
        chave = (filial, nome.casefold())
        if not nome or chave in vistas:
            continue
        vistas.add(chave)
        CategoriaAuditoriaSGQ.objects.create(filial=filial, nome=nome)


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0022_auditoria_normas_vinculadas'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CategoriaAuditoriaSGQ',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('filial', models.CharField(max_length=100, verbose_name='Filial')),
                ('nome', models.CharField(max_length=120, verbose_name='Título')),
                ('ativa', models.BooleanField(default=True, verbose_name='Ativa')),
                ('emissor', models.CharField(blank=True, default='', max_length=150, verbose_name='Emissor')),
                ('atualizado_por', models.CharField(blank=True, default='', max_length=150, verbose_name='Atualizado por')),
                ('criado_em', models.DateTimeField(auto_now_add=True)),
                ('atualizado_em', models.DateTimeField(auto_now=True)),
                ('criado_por', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='categorias_auditoria_sgq', to=settings.AUTH_USER_MODEL, verbose_name='Criado por',
                )),
                ('normas', models.ManyToManyField(blank=True, related_name='categorias', to='sgq.normasgq', verbose_name='Normas')),
            ],
            options={
                'verbose_name': 'Categoria de auditoria do SGQ',
                'verbose_name_plural': 'Categorias de auditoria do SGQ',
                'ordering': ['nome', 'pk'],
                'constraints': [
                    models.UniqueConstraint(fields=('filial', 'nome'), name='uniq_sgq_categoria_auditoria_filial_nome'),
                ],
            },
        ),
        migrations.RunPython(cadastrar_categorias_usadas, migrations.RunPython.noop),
    ]
