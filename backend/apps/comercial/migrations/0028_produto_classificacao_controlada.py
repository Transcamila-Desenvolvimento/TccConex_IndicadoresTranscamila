from django.db import migrations, models


def normalizar_produtos(apps, schema_editor):
    Produto = apps.get_model('comercial', 'ClienteComercialProduto')
    classe_ok = {
        'nao_classificado', '1', '2', '2.1', '2.2', '2.3', '3',
        '4.1', '4.2', '4.3', '5.1', '5.2', '6.1', '6.2', '8', '9',
    }
    fispq_map = {
        'portal do fabricante': 'portal_fabricante',
        'arquivo interno': 'arquivo_interno',
        'disponível no embarque': 'disponivel_embarque',
        'disponivel no embarque': 'disponivel_embarque',
        'portal_fabricante': 'portal_fabricante',
        'arquivo_interno': 'arquivo_interno',
        'disponivel_embarque': 'disponivel_embarque',
        'pendente': 'pendente',
        'nao_se_aplica': 'nao_se_aplica',
    }
    onu_classe = {
        '1203': '3', '1263': '3', '1993': '3',
        '1759': '8', '1760': '8', '2922': '8',
        '2810': '6.1', '2811': '6.1',
        '3077': '9', '3082': '9',
    }
    for produto in Produto.objects.all():
        onu = ''.join(ch for ch in (produto.numero_onu or '') if ch.isdigit())[:4]
        classe = (produto.classe_risco or '').strip()
        token = classe.split('—')[0].split('-')[0].strip()
        if token not in classe_ok:
            token = 'nao_classificado'
        if onu in onu_classe and token == 'nao_classificado':
            token = onu_classe[onu]
        fispq = fispq_map.get((produto.fispq_consulta or '').strip().casefold(), 'pendente')
        produto.numero_onu = onu
        produto.classe_risco = token
        produto.fispq_consulta = fispq
        if token == 'nao_classificado':
            produto.grupo_embalagem = 'nao_aplicavel'
        produto.save(update_fields=['numero_onu', 'classe_risco', 'fispq_consulta', 'grupo_embalagem'])


class Migration(migrations.Migration):

    dependencies = [
        ('comercial', '0027_cliente_produtos_atividade'),
    ]

    operations = [
        migrations.AddField(
            model_name='clientecomercialproduto',
            name='grupo_embalagem',
            field=models.CharField(
                choices=[
                    ('nao_aplicavel', 'Não se aplica'),
                    ('I', 'Grupo I'),
                    ('II', 'Grupo II'),
                    ('III', 'Grupo III'),
                ],
                default='nao_aplicavel',
                max_length=20,
                verbose_name='Grupo de embalagem',
            ),
        ),
        migrations.AlterField(
            model_name='clientecomercialproduto',
            name='classe_risco',
            field=models.CharField(
                choices=[
                    ('nao_classificado', 'Não classificado / não perigoso'),
                    ('1', '1 — Explosivos'),
                    ('2', '2 — Gases'),
                    ('2.1', '2.1 — Gases inflamáveis'),
                    ('2.2', '2.2 — Gases não inflamáveis'),
                    ('2.3', '2.3 — Gases tóxicos'),
                    ('3', '3 — Líquidos inflamáveis'),
                    ('4.1', '4.1 — Sólidos inflamáveis'),
                    ('4.2', '4.2 — Combustão espontânea'),
                    ('4.3', '4.3 — Perigosos quando molhados'),
                    ('5.1', '5.1 — Oxidantes'),
                    ('5.2', '5.2 — Peróxidos orgânicos'),
                    ('6.1', '6.1 — Substâncias tóxicas'),
                    ('6.2', '6.2 — Substâncias infectantes'),
                    ('8', '8 — Corrosivos'),
                    ('9', '9 — Substâncias e artigos perigosos diversos'),
                ],
                default='nao_classificado',
                max_length=20,
                verbose_name='Classe de risco',
            ),
        ),
        migrations.AlterField(
            model_name='clientecomercialproduto',
            name='fispq_consulta',
            field=models.CharField(
                choices=[
                    ('pendente', 'FISPQ pendente'),
                    ('portal_fabricante', 'Portal do fabricante'),
                    ('arquivo_interno', 'Arquivo interno'),
                    ('disponivel_embarque', 'Disponível no embarque'),
                    ('nao_se_aplica', 'Não se aplica'),
                ],
                default='pendente',
                max_length=40,
                verbose_name='FISPQ/FDS',
            ),
        ),
        migrations.AlterField(
            model_name='clientecomercialproduto',
            name='numero_onu',
            field=models.CharField(blank=True, default='', max_length=4, verbose_name='Nº de ONU'),
        ),
        migrations.RunPython(normalizar_produtos, migrations.RunPython.noop),
    ]
