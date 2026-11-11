import math
from datetime import date
from decimal import Decimal

import jwt
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.mixins import ModuleScopedViewMixin
from apps.accounts.permissions import allowed_filiais_for_module, get_request_context, resolve_filial_name
from apps.audit.services import record_audit
from apps.rh.models import FuncionarioQuadro

from .desempenho import (
    apurar_filial,
    apurar_funcionario,
    decimal_de,
    garantir_padrao,
    ocorrencia_payload,
    periodo_do_mes,
    texto_decimal,
    validar_faixas,
)
from .models import (
    CriterioDesempenho,
    FaixaBonificacao,
    GrupoCriterioDesempenho,
    OcorrenciaDesempenho,
    UsuarioMotorista,
)
from .extrato_pdf import gerar_extrato_bonificacao
from .motoristas import usuario_pelo_token


def _filial_da_sessao(request) -> str:
    _, filial = get_request_context(request)
    permitidas = allowed_filiais_for_module(request.user, 'Frota')
    return resolve_filial_name(filial, permitidas) or ''


def _erro(mensagem: str, codigo=status.HTTP_400_BAD_REQUEST):
    return Response({'detail': mensagem}, status=codigo)


def _exige_funcao(request, funcao: str, detail: str):
    if request.user.has_funcao('Frota', funcao, _filial_da_sessao(request)):
        return None
    return _erro(detail, status.HTTP_403_FORBIDDEN)


def _parametro_payload() -> dict:
    parametro = garantir_padrao()
    return {
        'notaInicial': texto_decimal(parametro.nota_inicial),
        'valorBonus': texto_decimal(parametro.valor_bonus),
        'limitarPorGrupo': parametro.limitar_por_grupo,
        'faixas': [
            {
                'id': str(faixa.pk),
                'notaMin': texto_decimal(faixa.nota_min),
                'notaMax': texto_decimal(faixa.nota_max),
                'modo': faixa.modo,
                'percentual': texto_decimal(faixa.percentual),
            }
            for faixa in FaixaBonificacao.objects.all()
        ],
    }


def _criterio_payload(criterio: CriterioDesempenho) -> dict:
    return {
        'id': str(criterio.pk),
        'grupoId': str(criterio.grupo_id),
        'nome': criterio.nome,
        'descricao': criterio.descricao,
        'pontos': texto_decimal(criterio.pontos),
        'zeraBonus': criterio.zera_bonus,
        'ativo': criterio.ativo,
        'ordem': criterio.ordem,
    }


class ParametrosDesempenhoView(ModuleScopedViewMixin, APIView):
    permission_module = 'Frota'
    permission_aba = 'gestao-desempenho-parametros'

    def get(self, request):
        return Response(_parametro_payload())

    def put(self, request):
        negado = _exige_funcao(
            request,
            'alterar-parametros-desempenho',
            'Acesso negado. Solicite ao administrador a função "Alterar" de Parâmetros.',
        )
        if negado:
            return negado
        try:
            nota_inicial = decimal_de(request.data.get('notaInicial'), 'a nota inicial')
            valor_bonus = decimal_de(request.data.get('valorBonus'), 'o valor do bônus')
            if nota_inicial <= 0:
                raise ValueError('A nota inicial precisa ser maior que zero.')
            if valor_bonus < 0:
                raise ValueError('O valor do bônus não pode ser negativo.')
            faixas = validar_faixas(request.data.get('faixas') or [], nota_inicial)
        except ValueError as erro:
            return _erro(str(erro))
        parametro = garantir_padrao()
        parametro.nota_inicial = nota_inicial
        parametro.valor_bonus = valor_bonus
        parametro.limitar_por_grupo = bool(request.data.get('limitarPorGrupo'))
        parametro.save()
        FaixaBonificacao.objects.all().delete()
        FaixaBonificacao.objects.bulk_create([
            FaixaBonificacao(ordem=ordem, **faixa)
            for ordem, faixa in enumerate(faixas, start=1)
        ])
        record_audit(request.user, 'frota.desempenho.parametros', 'Parâmetros da bonificação atualizados.')
        return Response(_parametro_payload())


class CriteriosDesempenhoView(ModuleScopedViewMixin, APIView):
    permission_module = 'Frota'
    permission_aba = 'gestao-desempenho-criterios'

    def get(self, request):
        garantir_padrao()
        grupos = GrupoCriterioDesempenho.objects.prefetch_related('criterios')
        return Response({
            'grupos': [
                {
                    'id': str(grupo.pk),
                    'nome': grupo.nome,
                    'pontosMaximos': texto_decimal(grupo.pontos_maximos),
                    'ordem': grupo.ordem,
                    'ativo': grupo.ativo,
                    'criterios': [_criterio_payload(criterio) for criterio in grupo.criterios.all()],
                }
                for grupo in grupos
            ],
        })


class GrupoDesempenhoView(ModuleScopedViewMixin, APIView):
    permission_module = 'Frota'
    permission_aba = 'gestao-desempenho-criterios'

    def post(self, request):
        negado = _exige_funcao(
            request,
            'gerenciar-criterios-desempenho',
            'Acesso negado. Solicite ao administrador a função "Cadastrar e editar" de Critérios.',
        )
        if negado:
            return negado
        nome = str(request.data.get('nome') or '').strip()
        if not nome:
            return _erro('Informe o nome do grupo.')
        try:
            teto = decimal_de(request.data.get('pontosMaximos') or 0, 'o teto do grupo')
        except ValueError as erro:
            return _erro(str(erro))
        if teto < 0:
            return _erro('O teto do grupo não pode ser negativo.')
        garantir_padrao()
        ultima = GrupoCriterioDesempenho.objects.order_by('-ordem').values_list('ordem', flat=True).first() or 0
        grupo = GrupoCriterioDesempenho.objects.create(nome=nome, pontos_maximos=teto, ordem=ultima + 1)
        record_audit(request.user, 'frota.desempenho.grupo', f'Grupo {grupo.nome} criado.')
        return Response({'id': str(grupo.pk)}, status=status.HTTP_201_CREATED)

    def patch(self, request, pk: int):
        negado = _exige_funcao(
            request,
            'gerenciar-criterios-desempenho',
            'Acesso negado. Solicite ao administrador a função "Cadastrar e editar" de Critérios.',
        )
        if negado:
            return negado
        grupo = GrupoCriterioDesempenho.objects.filter(pk=pk).first()
        if grupo is None:
            return _erro('Grupo não encontrado.', status.HTTP_404_NOT_FOUND)
        nome = str(request.data.get('nome', grupo.nome) or '').strip()
        if not nome:
            return _erro('Informe o nome do grupo.')
        try:
            teto = decimal_de(request.data.get('pontosMaximos', grupo.pontos_maximos), 'o teto do grupo')
        except ValueError as erro:
            return _erro(str(erro))
        if teto < 0:
            return _erro('O teto do grupo não pode ser negativo.')
        grupo.nome = nome
        grupo.pontos_maximos = teto
        if 'ativo' in request.data:
            grupo.ativo = bool(request.data.get('ativo'))
        grupo.save()
        return Response({'id': str(grupo.pk)})

    def delete(self, request, pk: int):
        negado = _exige_funcao(
            request,
            'gerenciar-criterios-desempenho',
            'Acesso negado. Solicite ao administrador a função "Cadastrar e editar" de Critérios.',
        )
        if negado:
            return negado
        grupo = GrupoCriterioDesempenho.objects.filter(pk=pk).first()
        if grupo is None:
            return _erro('Grupo não encontrado.', status.HTTP_404_NOT_FOUND)
        if OcorrenciaDesempenho.objects.filter(criterio__grupo=grupo).exists():
            return _erro('Este grupo já tem ocorrências e não pode ser excluído.')
        grupo.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CriterioDesempenhoItemView(ModuleScopedViewMixin, APIView):
    permission_module = 'Frota'
    permission_aba = 'gestao-desempenho-criterios'

    def post(self, request):
        negado = _exige_funcao(
            request,
            'gerenciar-criterios-desempenho',
            'Acesso negado. Solicite ao administrador a função "Cadastrar e editar" de Critérios.',
        )
        if negado:
            return negado
        grupo = GrupoCriterioDesempenho.objects.filter(pk=request.data.get('grupoId')).first()
        if grupo is None:
            return _erro('Escolha o grupo do critério.')
        nome = str(request.data.get('nome') or '').strip()
        if not nome:
            return _erro('Informe o nome do critério.')
        try:
            pontos = decimal_de(request.data.get('pontos') or 0, 'os pontos')
        except ValueError as erro:
            return _erro(str(erro))
        if pontos < 0:
            return _erro('Os pontos não podem ser negativos.')
        ultima = grupo.criterios.order_by('-ordem').values_list('ordem', flat=True).first() or 0
        criterio = CriterioDesempenho.objects.create(
            grupo=grupo,
            nome=nome,
            descricao=str(request.data.get('descricao') or '').strip(),
            pontos=pontos,
            zera_bonus=bool(request.data.get('zeraBonus')),
            ordem=ultima + 1,
        )
        record_audit(request.user, 'frota.desempenho.criterio', f'Critério {criterio.nome} criado.')
        return Response(_criterio_payload(criterio), status=status.HTTP_201_CREATED)

    def patch(self, request, pk: int):
        negado = _exige_funcao(
            request,
            'gerenciar-criterios-desempenho',
            'Acesso negado. Solicite ao administrador a função "Cadastrar e editar" de Critérios.',
        )
        if negado:
            return negado
        criterio = CriterioDesempenho.objects.filter(pk=pk).select_related('grupo').first()
        if criterio is None:
            return _erro('Critério não encontrado.', status.HTTP_404_NOT_FOUND)
        nome = str(request.data.get('nome', criterio.nome) or '').strip()
        if not nome:
            return _erro('Informe o nome do critério.')
        try:
            pontos = decimal_de(request.data.get('pontos', criterio.pontos), 'os pontos')
        except ValueError as erro:
            return _erro(str(erro))
        if pontos < 0:
            return _erro('Os pontos não podem ser negativos.')
        criterio.nome = nome
        criterio.descricao = str(request.data.get('descricao', criterio.descricao) or '').strip()
        criterio.pontos = pontos
        if 'zeraBonus' in request.data:
            criterio.zera_bonus = bool(request.data.get('zeraBonus'))
        if 'ativo' in request.data:
            criterio.ativo = bool(request.data.get('ativo'))
        criterio.save()
        return Response(_criterio_payload(criterio))

    def delete(self, request, pk: int):
        negado = _exige_funcao(
            request,
            'gerenciar-criterios-desempenho',
            'Acesso negado. Solicite ao administrador a função "Cadastrar e editar" de Critérios.',
        )
        if negado:
            return negado
        criterio = CriterioDesempenho.objects.filter(pk=pk).first()
        if criterio is None:
            return _erro('Critério não encontrado.', status.HTTP_404_NOT_FOUND)
        if criterio.ocorrencias.exists():
            return _erro('Este critério já tem ocorrências e não pode ser excluído. Desative-o.')
        criterio.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _paginar_apuracao(resultado: dict, params) -> dict:
    todos = resultado['motoristas']
    total = sum((Decimal(item['valor']) for item in todos), Decimal('0'))
    resposta = {
        **resultado,
        'count': len(todos),
        'resumo': {
            'motoristas': len(todos),
            'comBonificacao': sum(1 for item in todos if not item['zerado'] and Decimal(item['percentual']) > 0),
            'totalPagar': texto_decimal(total),
        },
        'opcoes': [
            {'funcionarioId': item['funcionarioId'], 'nomeCompleto': item['nomeCompleto'], 'cargo': item['cargo']}
            for item in todos
        ],
    }
    if 'page' not in params and 'page_size' not in params:
        resposta['page'] = 1
        resposta['pageSize'] = len(todos) or 10
        return resposta
    page = max(1, int(params.get('page') or 1))
    page_size = min(100, max(1, int(params.get('page_size') or 10)))
    paginas = max(1, math.ceil(len(todos) / page_size))
    page = min(page, paginas)
    inicio = (page - 1) * page_size
    resposta['motoristas'] = todos[inicio:inicio + page_size]
    resposta['page'] = page
    resposta['pageSize'] = page_size
    return resposta


class ApuracaoDesempenhoView(ModuleScopedViewMixin, APIView):
    permission_module = 'Frota'
    permission_aba = 'gestao-desempenho-ocorrencias'

    def get(self, request):
        hoje = timezone.localdate()
        try:
            ano = int(request.query_params.get('ano') or hoje.year)
            mes = int(request.query_params.get('mes') or hoje.month)
            resultado = apurar_filial(_filial_da_sessao(request), ano, mes, request.query_params.get('search') or '')
            return Response(_paginar_apuracao(resultado, request.query_params))
        except (TypeError, ValueError) as erro:
            return _erro(str(erro) or 'Período inválido.')


class ExtratoBonificacaoView(ModuleScopedViewMixin, APIView):
    permission_module = 'Frota'
    permission_aba = 'gestao-desempenho-ocorrencias'

    def get(self, request):
        hoje = timezone.localdate()
        try:
            ano = int(request.query_params.get('ano') or hoje.year)
            mes = int(request.query_params.get('mes') or hoje.month)
            filial = _filial_da_sessao(request)
            resultado = apurar_filial(filial, ano, mes)
            pdf = gerar_extrato_bonificacao(resultado, filial)
        except (TypeError, ValueError) as erro:
            return _erro(str(erro) or 'Período inválido.')
        except RuntimeError as erro:
            return _erro(str(erro))
        record_audit(
            request.user,
            'frota.desempenho.extrato',
            f'Extrato de bonificação de {mes:02d}/{ano} emitido.',
        )
        resposta = HttpResponse(pdf, content_type='application/pdf')
        resposta['Content-Disposition'] = f'attachment; filename="Extrato_bonificacao_{mes:02d}_{ano}.pdf"'
        return resposta


class OcorrenciasDesempenhoView(ModuleScopedViewMixin, APIView):
    permission_module = 'Frota'
    permission_aba = 'gestao-desempenho-ocorrencias'

    def get(self, request):
        filial = _filial_da_sessao(request)
        consulta = OcorrenciaDesempenho.objects.filter(filial=filial).select_related('funcionario', 'criterio', 'criterio__grupo')
        if request.query_params.get('ano') and request.query_params.get('mes'):
            try:
                ano = int(request.query_params['ano'])
                mes = int(request.query_params['mes'])
                inicio, fim = periodo_do_mes(ano, mes)
            except (TypeError, ValueError) as erro:
                return _erro(str(erro) or 'Período inválido.')
            consulta = consulta.filter(data__gte=inicio, data__lte=fim)
        if request.query_params.get('funcionarioId'):
            consulta = consulta.filter(funcionario_id=request.query_params['funcionarioId'])
        return Response([ocorrencia_payload(item) for item in consulta[:300]])

    def post(self, request):
        negado = _exige_funcao(
            request,
            'registrar-ocorrencias-desempenho',
            'Acesso negado. Solicite ao administrador a função "Registrar" de Ocorrências.',
        )
        if negado:
            return negado
        filial = _filial_da_sessao(request)
        funcionario = FuncionarioQuadro.objects.filter(pk=request.data.get('funcionarioId'), filial=filial).first()
        if funcionario is None:
            return _erro('Motorista não encontrado nesta filial.')
        criterio = CriterioDesempenho.objects.filter(pk=request.data.get('criterioId'), ativo=True).first()
        if criterio is None:
            return _erro('Escolha um critério ativo.')
        try:
            data = date.fromisoformat(str(request.data.get('data') or ''))
            quantidade = int(request.data.get('quantidade') or 1)
        except (TypeError, ValueError):
            return _erro('Informe a data e a quantidade da ocorrência.')
        if quantidade < 1 or quantidade > 99:
            return _erro('A quantidade precisa ficar entre 1 e 99.')
        ocorrencia = OcorrenciaDesempenho.objects.create(
            funcionario=funcionario,
            criterio=criterio,
            filial=filial,
            data=data,
            quantidade=quantidade,
            observacao=str(request.data.get('observacao') or '').strip()[:240],
            criado_por=request.user if request.user.is_authenticated else None,
        )
        record_audit(
            request.user,
            'frota.desempenho.ocorrencia',
            f'Ocorrência de {criterio.nome} para {funcionario.nome}.',
        )
        ocorrencia.funcionario = funcionario
        return Response(ocorrencia_payload(ocorrencia), status=status.HTTP_201_CREATED)


class OcorrenciaDesempenhoItemView(ModuleScopedViewMixin, APIView):
    permission_module = 'Frota'
    permission_aba = 'gestao-desempenho-ocorrencias'

    def delete(self, request, pk: int):
        negado = _exige_funcao(
            request,
            'excluir-ocorrencias-desempenho',
            'Acesso negado. Solicite ao administrador a função "Excluir" de Ocorrências.',
        )
        if negado:
            return negado
        ocorrencia = (
            OcorrenciaDesempenho.objects
            .filter(pk=pk, filial=_filial_da_sessao(request))
            .select_related('funcionario', 'criterio')
            .first()
        )
        if ocorrencia is None:
            return _erro('Ocorrência não encontrada.', status.HTTP_404_NOT_FOUND)
        record_audit(
            request.user,
            'frota.desempenho.ocorrencia_excluida',
            f'Ocorrência de {ocorrencia.criterio.nome} de {ocorrencia.funcionario.nome} excluída.',
        )
        ocorrencia.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MotoristaDesempenhoView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        cabecalho = request.headers.get('Authorization') or ''
        partes = cabecalho.split()
        token = partes[1] if len(partes) == 2 and partes[0].lower() == 'bearer' else ''
        if not token:
            return _erro('Faça login novamente.', status.HTTP_401_UNAUTHORIZED)
        try:
            usuario = usuario_pelo_token(token)
        except (jwt.PyJWTError, UsuarioMotorista.DoesNotExist):
            return _erro('Faça login novamente.', status.HTTP_401_UNAUTHORIZED)
        if not usuario.funcionario.ativo:
            return _erro('Este usuário foi desativado.', status.HTTP_403_FORBIDDEN)
        hoje = timezone.localdate()
        try:
            ano = int(request.query_params.get('ano') or hoje.year)
            mes = int(request.query_params.get('mes') or hoje.month)
            return Response(apurar_funcionario(usuario.funcionario, ano, mes))
        except (TypeError, ValueError) as erro:
            return _erro(str(erro) or 'Período inválido.')
