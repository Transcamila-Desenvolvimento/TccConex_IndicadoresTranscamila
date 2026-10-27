import django.db.models.deletion
from django.db import migrations, models
from django.db.models import Max

# Tipos de resposta fixos que existiam antes do cadastro, com o efeito de cada opção no cálculo
# (% de conformidade; None = não se aplica).
_TIPOS_FIXOS = {
    'conformidade': (
        'Conforme / Não conforme / Não se aplica',
        [('Conforme', 100), ('Não conforme', 0), ('Não se aplica', None)],
    ),
    'sim_nao': ('Sim / Não', [('Sim', 100), ('Não', 0)]),
    'nota': ('Nota de 0 a 10', [(str(nota), nota * 10) for nota in range(11)]),
}
_NAO_SE_APLICA = ('nao se aplica', 'não se aplica', 'n/a', 'na', 'não aplicável', 'nao aplicavel', 'não aplicado', 'nao aplicado')
_CONFORMES = ('conforme', 'sim', 'atende', 'atende totalmente')


def _valor_padrao(texto: str):
    chave = texto.strip().lower()
    if chave in _NAO_SE_APLICA:
        return None
    return 100 if chave in _CONFORMES else 0


def converter(apps, schema_editor):
    TipoResposta = apps.get_model('sgq', 'TipoRespostaSGQ')
    Item = apps.get_model('sgq', 'ItemNormaSGQ')

    for tipo in TipoResposta.objects.all():
        if tipo.opcoes and isinstance(tipo.opcoes[0], str):
            tipo.opcoes = [{'texto': texto, 'valor': _valor_padrao(texto)} for texto in tipo.opcoes]
            tipo.save(update_fields=['opcoes'])

    pares = Item.objects.exclude(tipo_resposta='').values_list('norma__filial', 'tipo_resposta').distinct()
    for filial, chave in pares:
        if chave not in _TIPOS_FIXOS:
            continue
        nome, opcoes = _TIPOS_FIXOS[chave]
        tipo = TipoResposta.objects.filter(filial=filial, nome__iexact=nome).first()
        if tipo is None:
            ultima = TipoResposta.objects.filter(filial=filial).aggregate(maior=Max('sequencia'))['maior'] or 0
            tipo = TipoResposta.objects.create(
                filial=filial,
                sequencia=ultima + 1,
                nome=nome,
                opcoes=[{'texto': texto, 'valor': valor} for texto, valor in opcoes],
                publica=True,
                emissor='Sistema',
            )
        Item.objects.filter(norma__filial=filial, tipo_resposta=chave).update(tipo_resposta_ref=tipo)


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0025_tiporespostasgq'),
    ]

    operations = [
        migrations.AddField(
            model_name='normasgq',
            name='classificacoes',
            field=models.JSONField(blank=True, default=list, verbose_name='Classificações das perguntas'),
        ),
        migrations.AddField(
            model_name='itemnormasgq',
            name='classificacao',
            field=models.CharField(blank=True, default='', max_length=10, verbose_name='Classificação (sigla da norma)'),
        ),
        migrations.AddField(
            model_name='itemnormasgq',
            name='area',
            field=models.CharField(blank=True, default='', max_length=30, verbose_name='Área / submódulo'),
        ),
        migrations.AddField(
            model_name='itemnormasgq',
            name='tipo_resposta_ref',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='itens',
                to='sgq.tiporespostasgq',
                verbose_name='Tipo de resposta',
            ),
        ),
        migrations.RunPython(converter, migrations.RunPython.noop),
    ]
