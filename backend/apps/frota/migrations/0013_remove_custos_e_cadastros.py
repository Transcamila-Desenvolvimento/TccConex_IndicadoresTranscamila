from django.db import migrations


ABAS_REMOVIDAS = {'cadastro-veiculos', 'cadastro-condutores', 'custos-frota'}
FUNCOES_REMOVIDAS = {'gerenciar-veiculos', 'gerenciar-condutores', 'gerenciar-custos-frota'}
INDICADOR_REMOVIDO = 'custos-frota'
PARTES_REMOVIDAS = {
    ('Frota', 'custos-frota'),
    ('Frota', 'cadastro-condutores'),
    ('Frota', 'cadastro-veiculos'),
    ('Indicadores', 'custos-frota'),
}


def limpar_permissoes(apps, schema_editor):
    """Tira das pessoas e dos agentes as rotinas que deixam de existir.

    Lista vazia significa acesso a tudo. Quem só tinha Custos de frota ou os
    cadastros não pode cair nesse caso e ganhar o restante.
    """
    CustomUser = apps.get_model('accounts', 'CustomUser')
    for user in CustomUser.objects.all().iterator():
        changed = []

        indicadores = list(user.indicadores or [])
        if INDICADOR_REMOVIDO in indicadores:
            nova = [item for item in indicadores if item != INDICADOR_REMOVIDO]
            if nova:
                user.indicadores = nova
            else:
                user.indicadores = []
                user.environments = [env for env in (user.environments or []) if env != 'Indicadores']
                filiais = dict(user.filiais or {})
                filiais.pop('Indicadores', None)
                user.filiais = filiais
                changed.extend(['environments', 'filiais'])
            changed.append('indicadores')

        abas = dict(user.abas or {})
        frota = list(abas.get('Frota') or [])
        if frota and any(item in ABAS_REMOVIDAS for item in frota):
            nova = [item for item in frota if item not in ABAS_REMOVIDAS]
            if not nova:
                nova = ['home']
            elif 'home' not in nova:
                nova = ['home', *nova]
            abas['Frota'] = nova
            user.abas = abas
            changed.append('abas')

        aba_filiais = dict(user.aba_filiais or {})
        por_aba = dict(aba_filiais.get('Frota') or {})
        if any(item in ABAS_REMOVIDAS for item in por_aba):
            for item in ABAS_REMOVIDAS:
                por_aba.pop(item, None)
            if por_aba:
                aba_filiais['Frota'] = por_aba
            else:
                aba_filiais.pop('Frota', None)
            user.aba_filiais = aba_filiais
            changed.append('aba_filiais')

        funcoes = dict(user.funcoes or {})
        lista = list(funcoes.get('Frota') or [])
        if any(item in FUNCOES_REMOVIDAS for item in lista):
            nova = [item for item in lista if item not in FUNCOES_REMOVIDAS]
            if nova:
                funcoes['Frota'] = nova
            else:
                funcoes.pop('Frota', None)
            user.funcoes = funcoes
            changed.append('funcoes')

        funcao_filiais = dict(user.funcao_filiais or {})
        por_funcao = dict(funcao_filiais.get('Frota') or {})
        if any(item in FUNCOES_REMOVIDAS for item in por_funcao):
            for item in FUNCOES_REMOVIDAS:
                por_funcao.pop(item, None)
            if por_funcao:
                funcao_filiais['Frota'] = por_funcao
            else:
                funcao_filiais.pop('Frota', None)
            user.funcao_filiais = funcao_filiais
            changed.append('funcao_filiais')

        if changed:
            user.save(update_fields=list(dict.fromkeys(changed)))

    Agente = apps.get_model('camilo', 'Agente')
    for agente in Agente.objects.all().iterator():
        escopos = list(agente.escopos or [])
        nova = [
            item for item in escopos
            if (item.get('ambiente'), item.get('parte')) not in PARTES_REMOVIDAS
        ]
        if len(nova) != len(escopos):
            agente.escopos = nova
            agente.save(update_fields=['escopos'])


class Migration(migrations.Migration):

    dependencies = [
        ('frota', '0012_olho_vivo_rondonopolis_2026'),
        ('accounts', '0039_remove_customuser_last_seen_at'),
        ('camilo', '0006_matriz_empresarial'),
    ]

    operations = [
        migrations.RunPython(limpar_permissoes, migrations.RunPython.noop),
        migrations.DeleteModel(name='CustoManutencaoLinha'),
        migrations.DeleteModel(name='CustoAbastecimentoLinha'),
        migrations.DeleteModel(name='CustoFrotaLote'),
        migrations.DeleteModel(name='CondutorFrota'),
        migrations.DeleteModel(name='VeiculoFrota'),
    ]
