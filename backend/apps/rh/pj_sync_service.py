"""Sincroniza PJs cadastrados nas linhas dos lotes mensais importados."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.db import transaction

from .models import (
    ColaboradorPJ,
    ColaboradorPJHistorico,
    InconsistenciaColaborador,
    LoteMovimentacaoRH,
    MovimentacaoColaborador,
)
from .utils import definir_categoria_colaborador

SITUACAO_PJ = 'ATIVO (PJ)'


def _competencia_key(ano: int, mes: int) -> int:
    return ano * 12 + mes


def competencia_anterior(ano: int, mes: int) -> tuple[int, int]:
    if mes <= 1:
        return ano - 1, 12
    return ano, mes - 1


def format_salario_br(valor) -> str:
    numero = Decimal(valor or 0)
    return f"R$ {numero:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')


def _date_to_competencia(d: date | None) -> int | None:
    if not d:
        return None
    return _competencia_key(d.year, d.month)


def pj_ativo_na_competencia(pj: ColaboradorPJ, ano: int, mes: int) -> bool:
    """PJ conta no mês se estiver ativo e a competência estiver entre admissão e demissão."""
    if not pj.ativo:
        return False

    competencia = _competencia_key(ano, mes)
    inicio = _date_to_competencia(pj.data_admissao)
    fim = _date_to_competencia(pj.data_demissao)

    if inicio is not None and competencia < inicio:
        return False
    if fim is not None and competencia > fim:
        return False
    return True


def salario_e_overrides_para_competencia(
    pj: ColaboradorPJ,
    ano: int,
    mes: int,
) -> tuple[Decimal, str | None, str | None]:
    """Retorna (salario, cargo, filial) vigentes na competência.

    Usa a última entrada de histórico com (ano, mes) <= competência;
    campos vazios no histórico caem no cadastro mestre do PJ.
    """
    competencia = _competencia_key(ano, mes)
    vigente = None
    for entry in pj.historico.all():
        entry_key = _competencia_key(entry.ano, entry.mes)
        if entry_key > competencia:
            continue
        if vigente is None or entry_key > _competencia_key(vigente.ano, vigente.mes):
            vigente = entry

    if vigente is None:
        return pj.salario, pj.cargo, pj.filial

    salario = vigente.salario if vigente.salario is not None else pj.salario
    cargo = vigente.cargo or pj.cargo
    filial = vigente.filial or pj.filial
    return salario, cargo, filial


def _motivo_historico_competencia(pj: ColaboradorPJ, ano: int, mes: int) -> str:
    for entry in pj.historico.all():
        if entry.ano == ano and entry.mes == mes:
            return (entry.motivo or '').strip()
    return ''


def sync_alteracao_salarial_pj(pj: ColaboradorPJ, lote: LoteMovimentacaoRH, salario_atual) -> None:
    """Gera/atualiza a linha em Alterações quando o salário do PJ mudou vs. o mês anterior."""
    qs = InconsistenciaColaborador.objects.filter(lote=lote, cpf=pj.cpf, tipo='salario')
    prev_ano, prev_mes = competencia_anterior(lote.ano, lote.mes)
    if not pj_ativo_na_competencia(pj, prev_ano, prev_mes):
        qs.delete()
        return

    salario_ant, _, _ = salario_e_overrides_para_competencia(pj, prev_ano, prev_mes)
    atual = Decimal(salario_atual or 0)
    anterior = Decimal(salario_ant or 0)
    if atual == anterior:
        qs.delete()
        return

    motivo = _motivo_historico_competencia(pj, lote.ano, lote.mes)
    if not motivo:
        motivo = (
            'Redução salarial por governança'
            if atual < anterior
            else 'Alteração salarial PJ'
        )
    qs.delete()
    InconsistenciaColaborador.objects.create(
        lote=lote,
        cpf=pj.cpf,
        nome=pj.nome,
        tipo='salario',
        valor_anterior=format_salario_br(anterior),
        valor_atual=format_salario_br(atual),
        justificativa=motivo,
    )


def _linha_e_clt(mov: MovimentacaoColaborador) -> bool:
    situacao = (mov.situacao or '').upper()
    return 'PJ' not in situacao


@transaction.atomic
def sync_pj_nos_lotes(pj: ColaboradorPJ) -> dict:
    """Projeta o PJ em todos os lotes importados conforme admissão/demissão/histórico."""
    pj = ColaboradorPJ.objects.prefetch_related('historico').get(pk=pj.pk)
    lotes = list(LoteMovimentacaoRH.objects.all())
    upserted = 0
    removed = 0
    skipped_clt = 0

    for lote in lotes:
        existente = MovimentacaoColaborador.objects.filter(lote=lote, cpf=pj.cpf).first()

        if existente and _linha_e_clt(existente):
            skipped_clt += 1
            continue

        deve_estar = pj_ativo_na_competencia(pj, lote.ano, lote.mes)

        if not deve_estar:
            if existente and not _linha_e_clt(existente):
                existente.delete()
                removed += 1
            InconsistenciaColaborador.objects.filter(lote=lote, cpf=pj.cpf, tipo='salario').delete()
            continue

        salario, cargo, filial = salario_e_overrides_para_competencia(pj, lote.ano, lote.mes)
        # Mesma normalização do CargoMapping (UPPER) para o PJ aparecer na classificação
        # e receber a categoria ao mapear o cargo.
        cargo_norm = str(cargo).strip().upper() if cargo else None
        categoria = definir_categoria_colaborador(cargo_norm)

        defaults = {
            'filial': filial,
            'nome': pj.nome,
            'situacao': SITUACAO_PJ,
            'funcao': cargo_norm,
            'data_admissao': pj.data_admissao,
            'data_nascimento': pj.data_nascimento,
            'salario': salario,
            'categoria': categoria,
        }

        if existente:
            for field, value in defaults.items():
                setattr(existente, field, value)
            existente.save()
        else:
            MovimentacaoColaborador.objects.create(
                lote=lote,
                cpf=pj.cpf,
                **defaults,
            )
        upserted += 1
        sync_alteracao_salarial_pj(pj, lote, salario)

    return {
        'upserted': upserted,
        'removed': removed,
        'skipped_clt': skipped_clt,
    }


def sync_todos_pjs() -> dict:
    """Reprojeta todos os PJs em todos os lotes (usado após importação)."""
    totals = {'upserted': 0, 'removed': 0, 'skipped_clt': 0, 'pjs': 0}
    for pj in ColaboradorPJ.objects.prefetch_related('historico').all():
        res = sync_pj_nos_lotes(pj)
        totals['upserted'] += res['upserted']
        totals['removed'] += res['removed']
        totals['skipped_clt'] += res['skipped_clt']
        totals['pjs'] += 1
    return totals


def remove_pj_de_todos_lotes(cpf: str) -> int:
    """Remove linhas ATIVO (PJ) do CPF em todos os lotes (não toca linhas CLT)."""
    qs = MovimentacaoColaborador.objects.filter(cpf=cpf, situacao__icontains='PJ')
    lote_ids = list(qs.values_list('lote_id', flat=True))
    count = qs.count()
    qs.delete()
    if lote_ids:
        InconsistenciaColaborador.objects.filter(cpf=cpf, tipo='salario', lote_id__in=lote_ids).delete()
    return count
