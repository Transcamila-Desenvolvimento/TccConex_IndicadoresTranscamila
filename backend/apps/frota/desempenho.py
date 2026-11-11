"""Apuração mensal da bonificação de motoristas.

A nota começa no valor configurado (padrão 100). Cada ocorrência desconta
os pontos do critério. Uma ocorrência marcada como gatilho zera o bônus
do mês, mesmo com nota alta. A bonificação só é paga depois de 3 meses
de empresa, contados da admissão até o fim do mês apurado.
"""

from __future__ import annotations

import calendar
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.db import transaction
from django.db.models import Q

from apps.rh.models import FuncionarioQuadro

from .models import (
    CriterioDesempenho,
    FaixaBonificacao,
    GrupoCriterioDesempenho,
    OcorrenciaDesempenho,
    ParametroBonificacao,
)
from .motoristas import DEPARTAMENTO_MOTORISTAS

CENTAVO = Decimal('0.01')
ZERO = Decimal('0.00')
MESES_EXPERIENCIA = 3

GRUPOS_PADRAO = (
    {
        'nome': 'Manutenção',
        'pontos_maximos': Decimal('20'),
        'criterios': (
            ('Checklist diário realizado', 'Não preenchimento ou preenchimento incorreto da verificação diária do veículo.', Decimal('6'), False),
            ('Zelo e limpeza do veículo', 'Cabine ou carga suja, ou falta de conservação básica do veículo.', Decimal('6'), False),
            ('Diário de bordo (manutenção)', 'Deixar de avisar a tempo barulho, vazamento, luz de painel ou falha mecânica.', Decimal('8'), False),
        ),
    },
    {
        'nome': 'Documentação',
        'pontos_maximos': Decimal('20'),
        'criterios': (
            ('Canhotos assinados', 'Canhoto rasurado, perdido ou atrasado.', Decimal('5'), False),
            ('CT-e', 'Erro, falta de porte ou problema no conhecimento de transporte.', Decimal('2'), False),
            ('MDF-e', 'Manifesto sem encerramento no prazo ou viagem sem a documentação ativa.', Decimal('2'), False),
            ('Passes fiscais', 'Falta de parada em posto fiscal ou problema na guia de trânsito.', Decimal('3'), False),
            ('CRLV', 'Falta de porte ou perda do licenciamento do veículo.', Decimal('2'), False),
            ('Cronotacógrafo', 'Disco não substituído no prazo ou registro sem zelo.', Decimal('3'), False),
            ('Pasta de licenças', 'Pasta de licenças desorganizada, perdida ou sem porte.', Decimal('3'), False),
        ),
    },
    {
        'nome': 'Carga',
        'pontos_maximos': Decimal('10'),
        'criterios': (
            ('Conferência dos produtos', 'Divergência de quantidade ou integridade no carregamento.', Decimal('2.5'), False),
            ('Acomodação da carga', 'Peso ou paletes organizados de forma incorreta.', Decimal('2.5'), False),
            ('Amarração', 'Cinta, corda ou trava de segurança não utilizada.', Decimal('2'), False),
            ('Conferência de entregas', 'Entrega errada por falta de checagem na descarga.', Decimal('3'), False),
        ),
    },
    {
        'nome': 'Multas e infrações',
        'pontos_maximos': Decimal('10'),
        'criterios': (
            ('Excesso de velocidade', 'Velocidade acima do limite da via ou da empresa.', Decimal('2'), False),
            ('Uso de cinto de segurança', 'Condução ou carona sem cinto.', Decimal('0.5'), False),
            ('Uso de celular', 'Celular em uso com o veículo em movimento.', Decimal('2.5'), False),
            ('Ultrapassagem perigosa', 'Ultrapassagem proibida, pelo acostamento ou forçada.', Decimal('2.5'), False),
            ('Faixa contínua', 'Transposição ou rodagem sobre faixa contínua.', Decimal('1.5'), False),
            ('Falta de sinalização', 'Mudança de faixa ou conversão sem seta.', Decimal('1'), False),
        ),
    },
    {
        'nome': 'Acidentes',
        'pontos_maximos': Decimal('40'),
        'criterios': (
            ('Leve', 'Ralado ou arranhão superficial, sem afetar a operação.', Decimal('4'), False),
            ('Pequeno', 'Quebra de peça menor, como lente, lanterna ou amassado pequeno.', Decimal('8'), False),
            ('Médio', 'Colisão com funilaria leve ou guincho, sem vítimas.', Decimal('16'), False),
            ('Grande ou muito grande', 'Sinistro grave com culpa ou imprudência do motorista. Zera o bônus do mês.', Decimal('40'), True),
        ),
    },
    {
        'nome': 'Conduta',
        'pontos_maximos': Decimal('0'),
        'criterios': (
            ('Álcool ou substâncias', 'Condução sob efeito de álcool ou substância psicoativa. Zera o bônus do mês.', Decimal('0'), True),
            ('Falta injustificada', 'Falta ao trabalho sem justificativa no mês. Zera o bônus do mês.', Decimal('0'), True),
        ),
    },
)

FAIXAS_PADRAO = (
    (Decimal('95'), Decimal('100'), FaixaBonificacao.INTEGRAL, Decimal('100')),
    (Decimal('80'), Decimal('94.99'), FaixaBonificacao.PROPORCIONAL, Decimal('0')),
    (Decimal('70'), Decimal('79.99'), FaixaBonificacao.PERCENTUAL, Decimal('50')),
    (Decimal('0'), Decimal('69.99'), FaixaBonificacao.ZERO, Decimal('0')),
)


def decimal_de(valor, nome: str) -> Decimal:
    texto = str(valor if valor is not None else '').strip().replace(',', '.')
    if texto == '':
        raise ValueError(f'Informe {nome}.')
    try:
        numero = Decimal(texto)
    except InvalidOperation as erro:
        raise ValueError(f'{nome} inválido.') from erro
    return numero.quantize(CENTAVO, rounding=ROUND_HALF_UP)


def texto_decimal(valor: Decimal) -> str:
    return f'{Decimal(valor).quantize(CENTAVO, rounding=ROUND_HALF_UP)}'


def garantir_padrao() -> ParametroBonificacao:
    parametro = ParametroBonificacao.objects.first()
    if parametro is None:
        parametro = ParametroBonificacao.objects.create()
    if not GrupoCriterioDesempenho.objects.exists():
        with transaction.atomic():
            for ordem_grupo, grupo in enumerate(GRUPOS_PADRAO, start=1):
                criado = GrupoCriterioDesempenho.objects.create(
                    nome=grupo['nome'],
                    pontos_maximos=grupo['pontos_maximos'],
                    ordem=ordem_grupo,
                )
                CriterioDesempenho.objects.bulk_create([
                    CriterioDesempenho(
                        grupo=criado,
                        nome=nome,
                        descricao=descricao,
                        pontos=pontos,
                        zera_bonus=zera,
                        ordem=ordem,
                    )
                    for ordem, (nome, descricao, pontos, zera) in enumerate(grupo['criterios'], start=1)
                ])
    if not FaixaBonificacao.objects.exists():
        FaixaBonificacao.objects.bulk_create([
            FaixaBonificacao(
                nota_min=nota_min,
                nota_max=nota_max,
                modo=modo,
                percentual=percentual,
                ordem=ordem,
            )
            for ordem, (nota_min, nota_max, modo, percentual) in enumerate(FAIXAS_PADRAO, start=1)
        ])
    return parametro


def periodo_do_mes(ano: int, mes: int) -> tuple[date, date]:
    if mes < 1 or mes > 12:
        raise ValueError('Mês inválido.')
    ultimo = calendar.monthrange(ano, mes)[1]
    return date(ano, mes, 1), date(ano, mes, ultimo)


def _faixa_da_nota(nota: Decimal, faixas: list[FaixaBonificacao]) -> FaixaBonificacao | None:
    for faixa in faixas:
        if faixa.nota_min <= nota <= faixa.nota_max:
            return faixa
    return None


def _bonus(nota: Decimal, parametro: ParametroBonificacao, faixa: FaixaBonificacao | None, zerado: bool) -> tuple[Decimal, Decimal]:
    if zerado or faixa is None or faixa.modo == FaixaBonificacao.ZERO:
        return ZERO, ZERO
    if faixa.modo == FaixaBonificacao.INTEGRAL:
        return Decimal('100.00'), parametro.valor_bonus
    if faixa.modo == FaixaBonificacao.PERCENTUAL:
        percentual = faixa.percentual
        return percentual, (parametro.valor_bonus * percentual / Decimal('100')).quantize(CENTAVO, rounding=ROUND_HALF_UP)
    base = parametro.nota_inicial if parametro.nota_inicial else Decimal('100')
    percentual = (nota / base * Decimal('100')).quantize(CENTAVO, rounding=ROUND_HALF_UP)
    valor = (parametro.valor_bonus * nota / base).quantize(CENTAVO, rounding=ROUND_HALF_UP)
    return percentual, valor


def fim_experiencia(admissao: date | None) -> date | None:
    """Dia em que completam 3 meses de empresa. A bonificação entra nesse mês."""
    if admissao is None:
        return None
    mes = admissao.month - 1 + MESES_EXPERIENCIA
    ano = admissao.year + mes // 12
    mes = mes % 12 + 1
    dia = min(admissao.day, calendar.monthrange(ano, mes)[1])
    return date(ano, mes, dia)


def em_experiencia(admissao: date | None, referencia: date) -> bool:
    """Ainda não completou 3 meses de empresa no fim do mês apurado."""
    conclusao = fim_experiencia(admissao)
    if conclusao is None:
        return False
    if admissao is not None and admissao > referencia:
        return True
    return referencia < conclusao


def apurar_motorista(
    funcionario: FuncionarioQuadro,
    ocorrencias: list[OcorrenciaDesempenho],
    grupos: list[GrupoCriterioDesempenho],
    parametro: ParametroBonificacao,
    faixas: list[FaixaBonificacao],
    referencia: date,
) -> dict:
    por_criterio: dict[int, list[OcorrenciaDesempenho]] = {}
    for ocorrencia in ocorrencias:
        por_criterio.setdefault(ocorrencia.criterio_id, []).append(ocorrencia)

    nota = parametro.nota_inicial
    zerado = False
    motivos: list[str] = []
    blocos = []
    for grupo in grupos:
        bruto = ZERO
        itens = []
        for criterio in grupo.criterios.all():
            eventos = por_criterio.get(criterio.id, [])
            quantidade = sum(evento.quantidade for evento in eventos)
            if quantidade and criterio.zera_bonus:
                zerado = True
                motivos.append(criterio.nome)
            desconto = (criterio.pontos * quantidade).quantize(CENTAVO, rounding=ROUND_HALF_UP)
            bruto += desconto
            if quantidade:
                itens.append({
                    'criterioId': str(criterio.id),
                    'nome': criterio.nome,
                    'quantidade': quantidade,
                    'pontos': texto_decimal(criterio.pontos),
                    'desconto': texto_decimal(desconto),
                    'zeraBonus': criterio.zera_bonus,
                })
        aplicado = bruto
        nota -= aplicado
        if itens or grupo.ativo:
            blocos.append({
                'id': str(grupo.id),
                'nome': grupo.nome,
                'teto': texto_decimal(grupo.pontos_maximos),
                'desconto': texto_decimal(aplicado),
                'itens': itens,
            })
    if nota < ZERO:
        nota = ZERO
    nota = nota.quantize(CENTAVO, rounding=ROUND_HALF_UP)
    faixa = _faixa_da_nota(nota, faixas)
    percentual, valor = _bonus(nota, parametro, faixa, zerado)
    conclusao = fim_experiencia(funcionario.data_admissao)
    experiencia = em_experiencia(funcionario.data_admissao, referencia)
    if experiencia:
        percentual = ZERO
        valor = ZERO
    return {
        'funcionarioId': str(funcionario.pk),
        'nomeCompleto': funcionario.nome,
        'cpf': funcionario.cpf,
        'cargo': funcionario.cargo,
        'ativo': funcionario.ativo,
        'nota': texto_decimal(nota),
        'percentual': texto_decimal(percentual),
        'valor': texto_decimal(valor),
        'zerado': zerado,
        'motivoZero': ', '.join(motivos),
        'emExperiencia': experiencia,
        'inicioBonificacao': conclusao.isoformat() if experiencia and conclusao else '',
        'grupos': [bloco for bloco in blocos if bloco['itens']],
    }


def apurar_filial(filial: str, ano: int, mes: int, busca: str = '') -> dict:
    parametro = garantir_padrao()
    inicio, fim = periodo_do_mes(ano, mes)
    grupos = list(
        GrupoCriterioDesempenho.objects.filter(ativo=True).prefetch_related('criterios')
    )
    faixas = list(FaixaBonificacao.objects.all())
    ocorrencias = list(
        OcorrenciaDesempenho.objects
        .filter(filial=filial, data__gte=inicio, data__lte=fim)
        .select_related('criterio', 'funcionario')
    )
    por_funcionario: dict[int, list[OcorrenciaDesempenho]] = {}
    for ocorrencia in ocorrencias:
        por_funcionario.setdefault(ocorrencia.funcionario_id, []).append(ocorrencia)

    consulta = FuncionarioQuadro.objects.filter(filial=filial).filter(
        Q(departamento=DEPARTAMENTO_MOTORISTAS, ativo=True) | Q(pk__in=por_funcionario.keys())
    )
    if busca.strip():
        consulta = consulta.filter(nome__icontains=busca.strip())
    motoristas = [
        apurar_motorista(funcionario, por_funcionario.get(funcionario.pk, []), grupos, parametro, faixas, fim)
        for funcionario in consulta.order_by('nome')
    ]
    return {
        'ano': ano,
        'mes': mes,
        'notaInicial': texto_decimal(parametro.nota_inicial),
        'valorBonus': texto_decimal(parametro.valor_bonus),
        'motoristas': motoristas,
        'criterios': [
            {
                'id': str(criterio.id),
                'nome': criterio.nome,
                'descricao': criterio.descricao,
                'grupoNome': grupo.nome,
                'pontos': texto_decimal(criterio.pontos),
                'zeraBonus': criterio.zera_bonus,
            }
            for grupo in grupos
            for criterio in grupo.criterios.all()
            if criterio.ativo
        ],
    }


def apurar_funcionario(funcionario: FuncionarioQuadro, ano: int, mes: int) -> dict:
    resultado = apurar_filial(funcionario.filial, ano, mes)
    motorista = next(
        (item for item in resultado['motoristas'] if item['funcionarioId'] == str(funcionario.pk)),
        None,
    )
    if motorista is None:
        parametro = garantir_padrao()
        _, fim = periodo_do_mes(ano, mes)
        motorista = apurar_motorista(
            funcionario,
            [],
            list(GrupoCriterioDesempenho.objects.filter(ativo=True).prefetch_related('criterios')),
            parametro,
            list(FaixaBonificacao.objects.all()),
            fim,
        )
    inicio, fim = periodo_do_mes(ano, mes)
    eventos = OcorrenciaDesempenho.objects.filter(
        funcionario=funcionario,
        data__gte=inicio,
        data__lte=fim,
    ).select_related('criterio', 'criterio__grupo')
    motorista['ocorrencias'] = [ocorrencia_payload(evento) for evento in eventos]
    motorista['ano'] = ano
    motorista['mes'] = mes
    motorista['notaInicial'] = resultado['notaInicial']
    motorista['valorBonus'] = resultado['valorBonus']
    return motorista


def ocorrencia_payload(ocorrencia: OcorrenciaDesempenho) -> dict:
    return {
        'id': str(ocorrencia.pk),
        'funcionarioId': str(ocorrencia.funcionario_id),
        'nomeCompleto': ocorrencia.funcionario.nome,
        'criterioId': str(ocorrencia.criterio_id),
        'criterioNome': ocorrencia.criterio.nome,
        'descricao': ocorrencia.criterio.descricao,
        'grupoNome': ocorrencia.criterio.grupo.nome,
        'data': ocorrencia.data.isoformat(),
        'quantidade': ocorrencia.quantidade,
        'observacao': ocorrencia.observacao,
        'pontos': texto_decimal(ocorrencia.criterio.pontos),
        'zeraBonus': ocorrencia.criterio.zera_bonus,
    }


def validar_faixas(faixas: list[dict], nota_inicial: Decimal) -> list[dict]:
    if not faixas:
        raise ValueError('Informe ao menos uma faixa de bonificação.')
    normalizadas = []
    for item in faixas:
        nota_min = decimal_de(item.get('notaMin'), 'a nota mínima')
        nota_max = decimal_de(item.get('notaMax'), 'a nota máxima')
        if nota_min < ZERO or nota_max > nota_inicial or nota_min > nota_max:
            raise ValueError('Cada faixa precisa ficar entre zero e a nota inicial, com o mínimo menor ou igual ao máximo.')
        modo = str(item.get('modo') or '')
        if modo not in {FaixaBonificacao.INTEGRAL, FaixaBonificacao.PROPORCIONAL, FaixaBonificacao.PERCENTUAL, FaixaBonificacao.ZERO}:
            raise ValueError('Modo de faixa inválido.')
        percentual = decimal_de(item.get('percentual') or 0, 'o percentual')
        if percentual < ZERO or percentual > Decimal('100'):
            raise ValueError('O percentual da faixa precisa ficar entre 0 e 100.')
        normalizadas.append({
            'nota_min': nota_min,
            'nota_max': nota_max,
            'modo': modo,
            'percentual': percentual,
        })
    ordenadas = sorted(normalizadas, key=lambda faixa: faixa['nota_min'])
    cursor = ZERO
    for faixa in ordenadas:
        if faixa['nota_min'] < cursor:
            raise ValueError('As faixas de nota não podem se sobrepor.')
        cursor = faixa['nota_max'] + CENTAVO
    return ordenadas
