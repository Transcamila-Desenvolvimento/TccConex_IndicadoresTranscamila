from django.db import migrations, models


def completar_opcoes(apps, schema_editor):
    TipoResposta = apps.get_model('sgq', 'TipoRespostaSGQ')
    for tipo in TipoResposta.objects.all():
        opcoes = [
            {
                'codigo': str(opcao.get('codigo') or opcao['texto'])[:10],
                'texto': opcao['texto'],
                'valor': opcao.get('valor'),
                'exigeJustificativa': bool(opcao.get('exigeJustificativa', False)),
            }
            for opcao in tipo.opcoes
        ]
        if opcoes != tipo.opcoes:
            tipo.opcoes = opcoes
            tipo.save(update_fields=['opcoes'])


def copiar_area(apps, schema_editor):
    Item = apps.get_model('sgq', 'ItemNormaSGQ')
    for item in Item.objects.exclude(area=''):
        item.areas = [item.area[:10].upper()]
        item.save(update_fields=['areas'])


class Migration(migrations.Migration):

    dependencies = [
        ('sgq', '0027_item_tipo_resposta_cadastro'),
    ]

    operations = [
        migrations.AddField(
            model_name='normasgq',
            name='areas',
            field=models.JSONField(blank=True, default=list, verbose_name='Áreas das perguntas'),
        ),
        migrations.AddField(
            model_name='normasgq',
            name='mapeamento_importacao',
            field=models.JSONField(blank=True, default=list, verbose_name='Mapeamento da importação'),
        ),
        migrations.AddField(
            model_name='itemnormasgq',
            name='areas',
            field=models.JSONField(blank=True, default=list, verbose_name='Áreas (siglas da norma)'),
        ),
        migrations.RunPython(completar_opcoes, migrations.RunPython.noop),
        migrations.RunPython(copiar_area, migrations.RunPython.noop),
    ]
