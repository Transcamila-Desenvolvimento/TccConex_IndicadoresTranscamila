from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.db.models.functions.text


def migrar_catalogo_e_status(apps, schema_editor):
    Cliente = apps.get_model('comercial', 'ClienteComercial')
    Vinculo = apps.get_model('comercial', 'ClienteComercialProduto')
    Produto = apps.get_model('comercial', 'ProdutoComercial')

    catalogo = {}
    for vinculo in Vinculo.objects.all().order_by('id'):
        nome = (vinculo.nome or '').strip()
        if not nome:
            vinculo.delete()
            continue
        key = nome.casefold()
        produto = catalogo.get(key)
        if produto is None:
            produto = Produto.objects.create(
                nome=nome.upper(),
                classe_risco=vinculo.classe_risco or 'nao_classificado',
                numero_onu=vinculo.numero_onu or '',
                grupo_embalagem=vinculo.grupo_embalagem or 'nao_aplicavel',
                fispq_consulta=vinculo.fispq_consulta or 'pendente',
                ativo=True,
            )
            catalogo[key] = produto
        existente = Vinculo.objects.filter(cliente_id=vinculo.cliente_id, produto_id=produto.pk).exclude(pk=vinculo.pk).exists()
        if existente:
            vinculo.delete()
            continue
        vinculo.produto_id = produto.pk
        vinculo.save(update_fields=['produto'])

    for cliente in Cliente.objects.all():
        status = cliente.compatibilidade or 'nao_analisado'
        if status == 'compativel':
            status = 'homologado'
        elif status == 'incompativel':
            status = 'reprovado'
        tem_produto = Vinculo.objects.filter(cliente=cliente, produto__isnull=False).exists()
        if tem_produto and status == 'nao_analisado':
            status = 'pendente_validacao'
        if status not in {'nao_analisado', 'pendente_validacao', 'homologado', 'reprovado'}:
            status = 'nao_analisado'
        if cliente.compatibilidade != status:
            cliente.compatibilidade = status
            cliente.save(update_fields=['compatibilidade'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('comercial', '0028_produto_classificacao_controlada'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProdutoComercial',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nome', models.CharField(max_length=200, verbose_name='Produto')),
                ('classe_risco', models.CharField(choices=[('nao_classificado', 'Não classificado / não perigoso'), ('1', '1 — Explosivos'), ('2', '2 — Gases'), ('2.1', '2.1 — Gases inflamáveis'), ('2.2', '2.2 — Gases não inflamáveis'), ('2.3', '2.3 — Gases tóxicos'), ('3', '3 — Líquidos inflamáveis'), ('4.1', '4.1 — Sólidos inflamáveis'), ('4.2', '4.2 — Combustão espontânea'), ('4.3', '4.3 — Perigosos quando molhados'), ('5.1', '5.1 — Oxidantes'), ('5.2', '5.2 — Peróxidos orgânicos'), ('6.1', '6.1 — Substâncias tóxicas'), ('6.2', '6.2 — Substâncias infectantes'), ('8', '8 — Corrosivos'), ('9', '9 — Substâncias e artigos perigosos diversos')], default='nao_classificado', max_length=20, verbose_name='Classe de risco')),
                ('numero_onu', models.CharField(blank=True, default='', max_length=4, verbose_name='Nº de ONU')),
                ('grupo_embalagem', models.CharField(choices=[('nao_aplicavel', 'Não se aplica'), ('I', 'Grupo I'), ('II', 'Grupo II'), ('III', 'Grupo III')], default='nao_aplicavel', max_length=20, verbose_name='Grupo de embalagem')),
                ('fispq_consulta', models.CharField(choices=[('pendente', 'FISPQ pendente'), ('portal_fabricante', 'Portal do fabricante'), ('arquivo_interno', 'Arquivo interno'), ('disponivel_embarque', 'Disponível no embarque'), ('nao_se_aplica', 'Não se aplica')], default='pendente', max_length=40, verbose_name='FISPQ/FDS')),
                ('ativo', models.BooleanField(default=True)),
                ('data_criacao', models.DateTimeField(auto_now_add=True)),
                ('data_atualizacao', models.DateTimeField(auto_now=True)),
                ('atualizado_por', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='produtos_comerciais_atualizados', to=settings.AUTH_USER_MODEL)),
                ('criado_por', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='produtos_comerciais_criados', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Produto comercial',
                'verbose_name_plural': 'Produtos comerciais',
                'ordering': ['nome'],
            },
        ),
        migrations.AddConstraint(
            model_name='produtocomercial',
            constraint=models.UniqueConstraint(django.db.models.functions.text.Lower('nome'), name='comercial_produto_nome_ci_uniq'),
        ),
        migrations.AddField(
            model_name='clientecomercial',
            name='homologacao_justificativa',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='clientecomercial',
            name='homologacao_revisao',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='clientecomercial',
            name='homologado_em',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='clientecomercial',
            name='homologado_por',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='clientes_homologados', to=settings.AUTH_USER_MODEL, verbose_name='Homologado por'),
        ),
        migrations.AlterField(
            model_name='clientecomercial',
            name='compatibilidade',
            field=models.CharField(choices=[('nao_analisado', 'Não analisado'), ('pendente_validacao', 'Pendente de validação'), ('homologado', 'Homologado'), ('reprovado', 'Reprovado')], default='nao_analisado', max_length=20, verbose_name='Homologação de produtos'),
        ),
        migrations.AddField(
            model_name='clientecomercialproduto',
            name='produto',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='vinculos', to='comercial.produtocomercial'),
        ),
        migrations.AlterField(
            model_name='clientecomercialproduto',
            name='nome',
            field=models.CharField(blank=True, default='', max_length=200, verbose_name='Produto'),
        ),
        migrations.CreateModel(
            name='HomologacaoProdutoEvento',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('nao_analisado', 'Não analisado'), ('pendente_validacao', 'Pendente de validação'), ('homologado', 'Homologado'), ('reprovado', 'Reprovado'), ('reaberto', 'Reaberto para validação')], max_length=32)),
                ('justificativa', models.TextField(blank=True, default='')),
                ('produtos_snapshot', models.JSONField(blank=True, default=list)),
                ('data_criacao', models.DateTimeField(auto_now_add=True)),
                ('cliente', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='homologacao_eventos', to='comercial.clientecomercial')),
                ('usuario', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='homologacao_eventos', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Evento de homologação de produtos',
                'verbose_name_plural': 'Eventos de homologação de produtos',
                'ordering': ['-data_criacao', '-id'],
            },
        ),
        migrations.RunPython(migrar_catalogo_e_status, noop),
        migrations.AddConstraint(
            model_name='clientecomercialproduto',
            constraint=models.UniqueConstraint(condition=models.Q(('produto__isnull', False)), fields=('cliente', 'produto'), name='comercial_cliente_produto_uniq'),
        ),
    ]
