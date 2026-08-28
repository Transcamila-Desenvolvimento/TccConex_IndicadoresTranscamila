from django.db import migrations


def _loja_controla_flags(loja: str) -> bool:
    texto = (loja or '').strip()
    if texto.isdigit():
        return int(texto) == 1
    return texto.casefold() in {'01', '1'}


def mover_flags_para_loja_01(apps, schema_editor):
    Cliente = apps.get_model('faturamento', 'ClienteProtocolo')
    por_codigo = {}
    for cliente in Cliente.objects.exclude(codigo=''):
        por_codigo.setdefault(cliente.codigo, []).append(cliente)

    for cadastros in por_codigo.values():
        matriz = next((item for item in cadastros if _loja_controla_flags(item.loja)), None)
        emitir = any(item.emitir_protocolo_canhotos for item in cadastros)
        pesquisa = any(item.considerar_pesquisa_satisfacao for item in cadastros)
        if matriz:
            mudou = False
            if emitir and not matriz.emitir_protocolo_canhotos:
                matriz.emitir_protocolo_canhotos = True
                matriz.padrao_protocolo = True
                mudou = True
            if pesquisa and not matriz.considerar_pesquisa_satisfacao:
                matriz.considerar_pesquisa_satisfacao = True
                mudou = True
            if mudou:
                matriz.save()
        for item in cadastros:
            if matriz and item.pk == matriz.pk:
                continue
            if item.emitir_protocolo_canhotos or item.considerar_pesquisa_satisfacao or item.padrao_protocolo:
                item.emitir_protocolo_canhotos = False
                item.considerar_pesquisa_satisfacao = False
                item.padrao_protocolo = False
                item.save()


class Migration(migrations.Migration):

    dependencies = [
        ('faturamento', '0010_alter_clienteprotocolo_options'),
    ]

    operations = [
        migrations.RunPython(mover_flags_para_loja_01, migrations.RunPython.noop),
    ]
