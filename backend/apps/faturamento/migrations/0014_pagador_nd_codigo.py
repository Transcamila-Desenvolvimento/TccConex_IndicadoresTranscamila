from django.db import migrations, models


def preencher_codigo(apps, schema_editor):
    PagadorNd = apps.get_model('faturamento', 'PagadorNd')
    ReceberTitulo = apps.get_model('financeiro', 'ReceberTitulo')
    ReportBatch = apps.get_model('financeiro', 'ReportBatch')
    lote = (
        ReportBatch.objects.filter(is_active=True, imported_receber=True)
        .order_by('-reference_date', '-created_at')
        .first()
    )
    for pagador in PagadorNd.objects.all():
        cod = ''
        if lote:
            encontrado = (
                ReceberTitulo.objects.filter(batch_id=lote.id, cliente=pagador.nome)
                .exclude(cod_cliente='')
                .values_list('cod_cliente', flat=True)
                .first()
            )
            cod = (encontrado or '').strip()
        if not cod or PagadorNd.objects.filter(cod_cliente=cod).exclude(pk=pagador.pk).exists():
            pagador.delete()
            continue
        pagador.cod_cliente = cod
        pagador.save(update_fields=['cod_cliente'])


class Migration(migrations.Migration):

    dependencies = [
        ('faturamento', '0013_titulo_nd'),
        ('financeiro', '0010_caixinha_descricao'),
    ]

    operations = [
        migrations.AddField(
            model_name='pagadornd',
            name='cod_cliente',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
        migrations.RunPython(preencher_codigo, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='pagadornd',
            name='nome',
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AlterField(
            model_name='pagadornd',
            name='cod_cliente',
            field=models.CharField(max_length=50, unique=True),
        ),
        migrations.AlterModelOptions(
            name='pagadornd',
            options={
                'ordering': ['nome', 'cod_cliente'],
                'verbose_name': 'Pagador de ND',
                'verbose_name_plural': 'Pagadores de ND',
            },
        ),
    ]
