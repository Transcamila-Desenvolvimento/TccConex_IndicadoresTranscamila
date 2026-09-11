from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from django.db.models import Q

from .models import (
    CLASSE_RISCO_NAO_CLASSIFICADO,
    COMPATIBILIDADE_HOMOLOGADO,
    COMPATIBILIDADE_NAO_ANALISADO,
    COMPATIBILIDADE_PENDENTE_VALIDACAO,
    COMPATIBILIDADE_REPROVADO,
    GRUPO_EMBALAGEM_NAO_APLICAVEL,
    HomologacaoProdutoEvento,
)


def q_produto_com_impeditivo():
    perigoso = Q(produtos__produto__isnull=False) & ~Q(
        produtos__produto__classe_risco=CLASSE_RISCO_NAO_CLASSIFICADO,
    )
    onu_incompleta = ~Q(produtos__produto__numero_onu__regex=r'^\d{4}$')
    return perigoso & onu_incompleta


def conformidade_vinculo(vinculo):
    catalogo = getattr(vinculo, 'produto', None)
    nome = (catalogo.nome if catalogo else vinculo.nome) or ''
    classe = (catalogo.classe_risco if catalogo else vinculo.classe_risco) or CLASSE_RISCO_NAO_CLASSIFICADO
    onu = (catalogo.numero_onu if catalogo else vinculo.numero_onu) or ''
    fispq = (catalogo.fispq_consulta if catalogo else vinculo.fispq_consulta) or ''
    grupo = (catalogo.grupo_embalagem if catalogo else vinculo.grupo_embalagem) or ''
    carga_perigosa = classe != CLASSE_RISCO_NAO_CLASSIFICADO
    alertas = []
    if carga_perigosa and len(onu) != 4:
        alertas.append('Nº ONU incompleto')
    if carga_perigosa and (not grupo or grupo == GRUPO_EMBALAGEM_NAO_APLICAVEL):
        alertas.append('Grupo de embalagem não informado')
    if carga_perigosa and any(item in {'Nº ONU incompleto'} for item in alertas):
        status = 'bloqueado'
    elif carga_perigosa:
        status = 'carga_perigosa'
    else:
        status = 'nao_perigoso'
    return {
        'status': status,
        'cargaPerigosa': carga_perigosa,
        'alertas': alertas,
        'nome': nome,
    }


def analisar_homologacao_produtos(cliente):
    vinculos = list(cliente.produtos.all())
    itens = []
    classes = []
    perigosos = 0
    nao_perigosos = 0
    fispq_pendente = 0
    onu_incompleta = 0
    grupo_pendente = 0
    bloqueados = 0
    for vinculo in vinculos:
        if vinculo.produto_id is None and not getattr(vinculo, 'produto', None):
            continue
        item = conformidade_vinculo(vinculo)
        itens.append(item)
        if item['cargaPerigosa']:
            perigosos += 1
            catalogo = vinculo.produto
            classe = (catalogo.classe_risco if catalogo else vinculo.classe_risco) or ''
            if classe and classe not in classes:
                classes.append(classe)
        else:
            nao_perigosos += 1
        if 'FISPQ pendente' in item['alertas']:
            fispq_pendente += 1
        if 'Nº ONU incompleto' in item['alertas']:
            onu_incompleta += 1
        if 'Grupo de embalagem não informado' in item['alertas']:
            grupo_pendente += 1
        if item['status'] == 'bloqueado':
            bloqueados += 1

    pendencias = []
    if not itens:
        pendencias.append('Vincule ao menos um produto no cadastro de produtos antes de homologar.')
    if fispq_pendente:
        nomes = [item['nome'] for item in itens if 'FISPQ pendente' in item['alertas']]
        pendencias.append(
            'Não é possível homologar com FISPQ pendente em carga perigosa: ' + ', '.join(nomes) + '.'
        )
    if onu_incompleta:
        for item in itens:
            if 'Nº ONU incompleto' in item['alertas']:
                pendencias.append(f'{item["nome"]}: informe o nº ONU com 4 dígitos para carga perigosa.')

    if not itens:
        resumo = 'Sem produto vinculado'
    elif bloqueados:
        partes = []
        if fispq_pendente:
            partes.append(f'{fispq_pendente} FISPQ pendente')
        if onu_incompleta:
            partes.append(f'{onu_incompleta} ONU incompleto')
        resumo = ' · '.join(partes) or 'Documentação incompleta'
    elif perigosos:
        resumo = f'{perigosos} carga perigosa · apto a homologar'
    else:
        resumo = 'Somente carga não perigosa · apto a homologar'

    return {
        'produtosVinculados': len(itens),
        'produtosPerigosos': perigosos,
        'produtosNaoPerigosos': nao_perigosos,
        'fispqPendente': fispq_pendente,
        'onuIncompleta': onu_incompleta,
        'grupoEmbalagemPendente': grupo_pendente,
        'classesRisco': classes,
        'bloqueados': bloqueados,
        'temImpeditivo': bool(pendencias),
        'aptoHomologar': bool(itens) and not pendencias,
        'pendencias': pendencias,
        'resumoPendencia': resumo,
        'itens': itens,
    }


def snapshot_produtos(cliente):
    itens = []
    vinculos = cliente.produtos.select_related('produto').order_by('ordem', 'id')
    for vinculo in vinculos:
        catalogo = vinculo.produto
        itens.append({
            'id': str(catalogo.pk) if catalogo else str(vinculo.pk),
            'nome': (catalogo.nome if catalogo else vinculo.nome) or '',
            'classeRisco': (catalogo.classe_risco if catalogo else vinculo.classe_risco) or '',
            'numeroOnu': (catalogo.numero_onu if catalogo else vinculo.numero_onu) or '',
            'grupoEmbalagem': (catalogo.grupo_embalagem if catalogo else vinculo.grupo_embalagem) or '',
            'fispq': (catalogo.fispq_consulta if catalogo else vinculo.fispq_consulta) or '',
        })
    return itens


def _registrar_evento(cliente, status, usuario, justificativa=''):
    HomologacaoProdutoEvento.objects.create(
        cliente=cliente,
        status=status,
        justificativa=(justificativa or '').strip(),
        produtos_snapshot=snapshot_produtos(cliente),
        usuario=usuario if getattr(usuario, 'pk', None) else None,
    )


def _salvar_status(cliente, status, usuario=None, justificativa='', evento=None):
    cliente.compatibilidade = status
    cliente.homologacao_justificativa = (justificativa or '').strip()
    if status in {COMPATIBILIDADE_HOMOLOGADO, COMPATIBILIDADE_REPROVADO}:
        cliente.homologado_por = usuario if getattr(usuario, 'pk', None) else None
        cliente.homologado_em = timezone.now()
        cliente.homologacao_revisao = (cliente.homologacao_revisao or 0) + 1
    else:
        cliente.homologado_por = None
        cliente.homologado_em = None
        if status == COMPATIBILIDADE_NAO_ANALISADO:
            cliente.homologacao_justificativa = ''
    cliente.save(update_fields=[
        'compatibilidade',
        'homologado_por',
        'homologado_em',
        'homologacao_justificativa',
        'homologacao_revisao',
        'data_atualizacao',
    ])
    evento_final = evento or status
    _registrar_evento(cliente, evento_final, usuario, justificativa)
    if evento_final in {COMPATIBILIDADE_PENDENTE_VALIDACAO, HomologacaoProdutoEvento.EVENTO_REABERTO}:
        from .homologacao_email_service import notificar_homologacao_pendente

        notificar_homologacao_pendente(cliente.pk, getattr(usuario, 'pk', None))


@transaction.atomic
def sincronizar_homologacao_por_produtos(cliente, usuario=None, justificativa=''):
    """Após vincular/desvincular produtos: sem produto volta a Não analisado; com produto entra na fila."""
    cliente = type(cliente).objects.select_for_update().get(pk=cliente.pk)
    tem_produto = cliente.produtos.filter(produto__isnull=False).exists()
    if not tem_produto:
        if cliente.compatibilidade != COMPATIBILIDADE_NAO_ANALISADO or cliente.homologado_em:
            _salvar_status(cliente, COMPATIBILIDADE_NAO_ANALISADO, usuario, justificativa)
        return cliente
    if cliente.compatibilidade != COMPATIBILIDADE_PENDENTE_VALIDACAO or cliente.homologado_em:
        _salvar_status(
            cliente,
            COMPATIBILIDADE_PENDENTE_VALIDACAO,
            usuario,
            justificativa or 'Composição de produtos alterada. Nova validação obrigatória.',
            evento=HomologacaoProdutoEvento.EVENTO_REABERTO if cliente.compatibilidade in {
                COMPATIBILIDADE_HOMOLOGADO,
                COMPATIBILIDADE_REPROVADO,
            } else COMPATIBILIDADE_PENDENTE_VALIDACAO,
        )
    return cliente


def _impeditivos_homologacao(cliente):
    return list(analisar_homologacao_produtos(cliente)['pendencias'])


@transaction.atomic
def decidir_homologacao(cliente, usuario, decisao: str, justificativa=''):
    cliente = type(cliente).objects.select_for_update().get(pk=cliente.pk)
    status = (decisao or '').strip()
    if status == 'compativel':
        status = COMPATIBILIDADE_HOMOLOGADO
    if status == 'incompativel':
        status = COMPATIBILIDADE_REPROVADO
    if status not in {COMPATIBILIDADE_HOMOLOGADO, COMPATIBILIDADE_REPROVADO}:
        raise ValidationError({'decisao': ['Informe homologado ou reprovado.']})
    if not cliente.produtos.filter(produto__isnull=False).exists():
        raise ValidationError({
            'detail': 'O cliente não possui produtos vinculados. A vinculação é feita no cadastro de produtos.',
        })
    if cliente.compatibilidade not in {
        COMPATIBILIDADE_PENDENTE_VALIDACAO,
        COMPATIBILIDADE_NAO_ANALISADO,
        COMPATIBILIDADE_REPROVADO,
        COMPATIBILIDADE_HOMOLOGADO,
    }:
        raise ValidationError({'detail': 'Status de homologação inválido para decisão.'})

    texto = (justificativa or '').strip()
    if cliente.compatibilidade == status:
        raise ValidationError({'detail': 'Esta decisão já está registrada para o cliente.'})
    if status == COMPATIBILIDADE_REPROVADO and len(texto) < 15:
        raise ValidationError({
            'justificativa': ['Informe o motivo da reprovação com pelo menos 15 caracteres.'],
        })
    if status == COMPATIBILIDADE_HOMOLOGADO:
        impeditivos = _impeditivos_homologacao(cliente)
        if impeditivos:
            raise ValidationError({'detail': impeditivos[0] if len(impeditivos) == 1 else impeditivos})

    _salvar_status(cliente, status, usuario, texto)
    return cliente
