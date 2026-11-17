from django.db import migrations

ABAS_MOVIDAS = (
    'controle-estoque',
    'controle-uniformes',
    'cadastro-consumidores',
    'cadastro-medidas',
    'cadastro-fornecedores',
)


def _lista(valor):
    if isinstance(valor, (list, tuple)):
        return list(valor)
    return []


def _mapa(valor):
    return dict(valor) if isinstance(valor, dict) else {}


def _mover_abas(abas):
    compras = _lista(abas.get('Compras'))
    if not compras:
        return abas, True
    movidas = [aba for aba in compras if aba in ABAS_MOVIDAS]
    if not movidas:
        return abas, False
    restantes = [aba for aba in compras if aba not in ABAS_MOVIDAS]
    if 'home' not in restantes:
        restantes.insert(0, 'home')
    abas['Compras'] = restantes
    suprimentos = _lista(abas.get('Suprimentos'))
    if suprimentos:
        for aba in movidas:
            if aba not in suprimentos:
                suprimentos.append(aba)
        if 'home' not in suprimentos:
            suprimentos.insert(0, 'home')
        abas['Suprimentos'] = suprimentos
    return abas, True


def _mover_lista(mapa):
    """funcoes é {ambiente: [chaves]}, não um mapa aninhado."""
    compras = _lista(mapa.get('Compras'))
    if not compras:
        return mapa, False
    suprimentos = _lista(mapa.get('Suprimentos'))
    for item in compras:
        if item not in suprimentos:
            suprimentos.append(item)
    mapa.pop('Compras', None)
    mapa['Suprimentos'] = suprimentos
    return mapa, True


def _mover_mapa(mapa, chaves=None):
    compras = _mapa(mapa.get('Compras'))
    if not compras:
        return mapa, False
    if chaves is None:
        movido = compras
        restante = {}
    else:
        movido = {chave: valor for chave, valor in compras.items() if chave in chaves}
        restante = {chave: valor for chave, valor in compras.items() if chave not in chaves}
    if not movido:
        return mapa, False
    if restante:
        mapa['Compras'] = restante
    else:
        mapa.pop('Compras', None)
    suprimentos = _mapa(mapa.get('Suprimentos'))
    suprimentos.update(movido)
    mapa['Suprimentos'] = suprimentos
    return mapa, True


def move_estoques_e_cadastros(apps, schema_editor):
    CustomUser = apps.get_model('accounts', 'CustomUser')
    for user in CustomUser.objects.all():
        envs = _lista(user.environments)
        if 'Compras' not in envs:
            continue
        abas, liberar_telas = _mover_abas(_mapa(user.abas))
        funcoes, funcoes_mudou = _mover_lista(_mapa(user.funcoes))
        aba_filiais, aba_filiais_mudou = _mover_mapa(_mapa(user.aba_filiais), ABAS_MOVIDAS)
        funcao_filiais, funcao_filiais_mudou = _mover_mapa(_mapa(user.funcao_filiais))
        if not (liberar_telas or funcoes_mudou or aba_filiais_mudou or funcao_filiais_mudou):
            continue
        if 'Suprimentos' not in envs:
            envs.append('Suprimentos')
        user.environments = envs
        user.abas = abas
        user.funcoes = funcoes
        user.aba_filiais = aba_filiais
        user.funcao_filiais = funcao_filiais
        user.save(update_fields=['environments', 'abas', 'funcoes', 'aba_filiais', 'funcao_filiais'])

    Agente = apps.get_model('camilo', 'Agente')
    for agente in Agente.objects.all():
        escopos = []
        mudou = False
        for item in agente.escopos or []:
            if not isinstance(item, dict):
                escopos.append(item)
                continue
            if item.get('ambiente') == 'Compras' and item.get('parte') == 'controle-estoque':
                escopos.append({**item, 'ambiente': 'Suprimentos'})
                mudou = True
            else:
                escopos.append(item)
        if mudou:
            agente.escopos = escopos
            agente.save(update_fields=['escopos'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0040_add_suprimentos_permission'),
        ('camilo', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(move_estoques_e_cadastros, migrations.RunPython.noop),
    ]
