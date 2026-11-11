import json
import re
from datetime import date
from decimal import Decimal
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.frota.models import (
    CriterioDesempenho,
    FaixaBonificacao,
    GrupoCriterioDesempenho,
    ParametroBonificacao,
)
from apps.rh.models import FuncionarioQuadro


def _digitos(valor) -> str:
    return re.sub(r'\D', '', str(valor or ''))


def _data(valor):
    if not valor:
        return None
    if isinstance(valor, date):
        return valor
    return date.fromisoformat(str(valor)[:10])


def exportar_payload() -> dict:
    parametro = ParametroBonificacao.objects.first()
    return {
        'quadro': [
            {
                'nome': item.nome,
                'cpf': item.cpf,
                'filial': item.filial,
                'cargo': item.cargo,
                'departamento': item.departamento,
                'dataAdmissao': item.data_admissao.isoformat() if item.data_admissao else None,
                'dataDemissao': item.data_demissao.isoformat() if item.data_demissao else None,
                'ativo': item.ativo,
            }
            for item in FuncionarioQuadro.objects.all().order_by('filial', 'nome')
        ],
        'parametro': None if parametro is None else {
            'notaInicial': str(parametro.nota_inicial),
            'valorBonus': str(parametro.valor_bonus),
            'limitarPorGrupo': parametro.limitar_por_grupo,
        },
        'faixas': [
            {
                'notaMin': str(faixa.nota_min),
                'notaMax': str(faixa.nota_max),
                'modo': faixa.modo,
                'percentual': str(faixa.percentual),
                'ordem': faixa.ordem,
            }
            for faixa in FaixaBonificacao.objects.all()
        ],
        'grupos': [
            {
                'nome': grupo.nome,
                'pontosMaximos': str(grupo.pontos_maximos),
                'ordem': grupo.ordem,
                'ativo': grupo.ativo,
                'criterios': [
                    {
                        'nome': criterio.nome,
                        'descricao': criterio.descricao,
                        'pontos': str(criterio.pontos),
                        'zeraBonus': criterio.zera_bonus,
                        'ativo': criterio.ativo,
                        'ordem': criterio.ordem,
                    }
                    for criterio in grupo.criterios.all()
                ],
            }
            for grupo in GrupoCriterioDesempenho.objects.prefetch_related('criterios')
        ],
    }


def aplicar(payload: dict) -> dict:
    """Atualiza só o quadro, o parâmetro, as faixas e o catálogo.

    Não apaga funcionário que não veio no arquivo e não mexe em ocorrência,
    usuário do aplicativo nem nas outras tabelas.
    """
    with transaction.atomic():
        quadro = _aplicar_quadro(payload.get('quadro') or [])
        parametro = _aplicar_parametro(payload.get('parametro'))
        faixas = _aplicar_faixas(payload.get('faixas') or [])
        catalogo = _aplicar_catalogo(payload.get('grupos') or [])
    return {**quadro, **parametro, **faixas, **catalogo}


def _aplicar_quadro(linhas: list) -> dict:
    existentes = {}
    for item in FuncionarioQuadro.objects.all():
        chave = _digitos(item.cpf)
        if chave and chave not in existentes:
            existentes[chave] = item
    inseridos = atualizados = 0
    for linha in linhas:
        chave = _digitos(linha.get('cpf'))
        if len(chave) != 11:
            continue
        campos = {
            'nome': str(linha.get('nome') or '').strip(),
            'cpf': chave,
            'filial': str(linha.get('filial') or ''),
            'cargo': str(linha.get('cargo') or ''),
            'departamento': str(linha.get('departamento') or ''),
            'data_admissao': _data(linha.get('dataAdmissao')),
            'data_demissao': _data(linha.get('dataDemissao')),
            'ativo': bool(linha.get('ativo', True)),
        }
        if not campos['nome']:
            continue
        atual = existentes.get(chave)
        if atual is None:
            existentes[chave] = FuncionarioQuadro.objects.create(**campos)
            inseridos += 1
        else:
            for nome, valor in campos.items():
                setattr(atual, nome, valor)
            atual.save()
            atualizados += 1
    return {'quadro_inseridos': inseridos, 'quadro_atualizados': atualizados}


def _aplicar_parametro(dados) -> dict:
    if not isinstance(dados, dict):
        return {'parametro': 0}
    parametro = ParametroBonificacao.objects.first() or ParametroBonificacao()
    parametro.nota_inicial = Decimal(str(dados.get('notaInicial') or '100'))
    parametro.valor_bonus = Decimal(str(dados.get('valorBonus') or '0'))
    parametro.limitar_por_grupo = bool(dados.get('limitarPorGrupo'))
    parametro.save()
    return {'parametro': 1}


def _aplicar_faixas(linhas: list) -> dict:
    if not linhas:
        return {'faixas': 0}
    FaixaBonificacao.objects.all().delete()
    FaixaBonificacao.objects.bulk_create([
        FaixaBonificacao(
            nota_min=Decimal(str(linha.get('notaMin') or '0')),
            nota_max=Decimal(str(linha.get('notaMax') or '0')),
            modo=str(linha.get('modo') or FaixaBonificacao.ZERO),
            percentual=Decimal(str(linha.get('percentual') or '0')),
            ordem=int(linha.get('ordem') or indice),
        )
        for indice, linha in enumerate(linhas, start=1)
    ])
    return {'faixas': len(linhas)}


def _aplicar_catalogo(grupos: list) -> dict:
    grupos_salvos = criterios_salvos = 0
    for grupo_dados in grupos:
        nome = str(grupo_dados.get('nome') or '').strip()
        if not nome:
            continue
        grupo = GrupoCriterioDesempenho.objects.filter(nome=nome).first() or GrupoCriterioDesempenho(nome=nome)
        grupo.pontos_maximos = Decimal(str(grupo_dados.get('pontosMaximos') or '0'))
        grupo.ordem = int(grupo_dados.get('ordem') or 0)
        grupo.ativo = bool(grupo_dados.get('ativo', True))
        grupo.save()
        grupos_salvos += 1
        for criterio_dados in grupo_dados.get('criterios') or []:
            nome_criterio = str(criterio_dados.get('nome') or '').strip()
            if not nome_criterio:
                continue
            criterio = grupo.criterios.filter(nome=nome_criterio).first() or CriterioDesempenho(grupo=grupo, nome=nome_criterio)
            criterio.descricao = str(criterio_dados.get('descricao') or '')
            criterio.pontos = Decimal(str(criterio_dados.get('pontos') or '0'))
            criterio.zera_bonus = bool(criterio_dados.get('zeraBonus'))
            criterio.ativo = bool(criterio_dados.get('ativo', True))
            criterio.ordem = int(criterio_dados.get('ordem') or 0)
            criterio.save()
            criterios_salvos += 1
    return {'grupos': grupos_salvos, 'criterios': criterios_salvos}


class Command(BaseCommand):
    help = 'Envia ou aplica só o quadro de funcionários e o catálogo da bonificação.'

    def add_arguments(self, parser):
        parser.add_argument('caminho')
        parser.add_argument('--exportar', action='store_true')

    def handle(self, *args, **options):
        caminho = Path(options['caminho'])
        if options['exportar']:
            caminho.parent.mkdir(parents=True, exist_ok=True)
            caminho.write_text(
                json.dumps(exportar_payload(), ensure_ascii=False, indent=2),
                encoding='utf-8',
            )
            self.stdout.write(f'Exportado {caminho}')
            return
        if not caminho.is_file():
            raise CommandError(f'Arquivo não encontrado: {caminho}')
        payload = json.loads(caminho.read_text(encoding='utf-8'))
        if not isinstance(payload, dict):
            raise CommandError('O arquivo precisa ser um objeto JSON.')
        for chave, valor in aplicar(payload).items():
            self.stdout.write(f'{chave}={valor}')
