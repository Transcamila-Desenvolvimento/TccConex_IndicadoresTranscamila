"""Carga das auditorias do SGQ a partir do cadastro local.

Só grava normas, tipos de resposta, categorias, itens e auditorias.
Não lê nem altera usuários, pesquisas, financeiro ou qualquer outra tabela.
Se já existir algum desses registros, a importação inteira é ignorada.
"""
import json
from decimal import Decimal
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.dateparse import parse_date

from apps.sgq.models import (
    AuditoriaSGQ,
    CategoriaAuditoriaSGQ,
    ItemNormaSGQ,
    NormaSGQ,
    TipoRespostaSGQ,
)

FIXTURE = Path(__file__).resolve().parents[2] / 'fixtures' / 'auditorias_iniciais.json'


def _item(item: ItemNormaSGQ) -> dict:
    return {
        'codigo': item.codigo,
        'titulo': item.titulo,
        'descricao': item.descricao,
        'tipo': item.tipo,
        'tipoResposta': item.tipo_resposta.nome if item.tipo_resposta_id else '',
        'classificacao': item.classificacao,
        'areas': item.areas or [],
        'peso': str(item.peso),
        'obrigatorio': item.obrigatorio,
        'ordem': item.ordem,
        'filhos': [_item(filho) for filho in item.subitens.order_by('ordem', 'pk')],
    }


def exportar(destino: Path) -> dict:
    tipos = [
        {
            'filial': tipo.filial,
            'sequencia': tipo.sequencia,
            'nome': tipo.nome,
            'opcoes': tipo.opcoes,
            'publica': tipo.publica,
            'emissor': tipo.emissor,
        }
        for tipo in TipoRespostaSGQ.objects.order_by('filial', 'sequencia', 'pk')
    ]
    normas = []
    for norma in NormaSGQ.objects.order_by('filial', 'nome', 'pk'):
        normas.append({
            'filial': norma.filial,
            'nome': norma.nome,
            'descricao': norma.descricao,
            'dataAtualizacao': norma.data_atualizacao.isoformat(),
            'emissor': norma.emissor,
            'publica': norma.publica,
            'ativa': norma.ativa,
            'classificacoes': norma.classificacoes or [],
            'areas': norma.areas or [],
            'mapeamentoImportacao': norma.mapeamento_importacao or [],
            'itens': [_item(item) for item in norma.itens.filter(parent__isnull=True).order_by('ordem', 'pk')],
        })
    categorias = []
    for categoria in CategoriaAuditoriaSGQ.objects.order_by('filial', 'nome', 'pk'):
        categorias.append({
            'filial': categoria.filial,
            'nome': categoria.nome,
            'ativa': categoria.ativa,
            'emissor': categoria.emissor,
            'atualizadoPor': categoria.atualizado_por,
            'normas': list(categoria.normas.order_by('nome').values_list('nome', flat=True)),
        })
    auditorias = []
    for auditoria in AuditoriaSGQ.objects.order_by('codigo'):
        auditorias.append({
            'filial': auditoria.filial,
            'ano': auditoria.ano,
            'sequencia': auditoria.sequencia,
            'codigo': auditoria.codigo,
            'categoria': auditoria.categoria,
            'titulo': auditoria.titulo,
            'dataInicio': auditoria.data_inicio.isoformat(),
            'dataTermino': auditoria.data_termino.isoformat(),
            'auditorLider': auditoria.auditor_lider,
            'auditores': auditoria.auditores or [],
            'status': auditoria.status,
            'escopo': auditoria.escopo,
            'normas': list(auditoria.normas.order_by('nome').values_list('nome', flat=True)),
        })
    pacote = {'tiposResposta': tipos, 'normas': normas, 'categorias': categorias, 'auditorias': auditorias}
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(pacote, ensure_ascii=False), encoding='utf-8')
    return pacote


class Command(BaseCommand):
    help = 'Importa o cadastro inicial de auditorias do SGQ sem mexer no restante do banco.'

    def add_arguments(self, parser):
        parser.add_argument('--exportar', action='store_true', help='Gera a fixture a partir do banco local.')

    def handle(self, *args, **options):
        if options['exportar']:
            pacote = exportar(FIXTURE)
            self.stdout.write(
                f"{FIXTURE} — {len(pacote['normas'])} normas, {len(pacote['auditorias'])} auditorias."
            )
            return
        if (
            NormaSGQ.objects.exists()
            or TipoRespostaSGQ.objects.exists()
            or CategoriaAuditoriaSGQ.objects.exists()
            or AuditoriaSGQ.objects.exists()
        ):
            self.stdout.write('Cadastro de auditorias já existe. Nada foi alterado.')
            return
        if not FIXTURE.is_file():
            self.stdout.write(f'Fixture ausente: {FIXTURE}')
            return
        pacote = json.loads(FIXTURE.read_text(encoding='utf-8'))
        with transaction.atomic():
            tipos = {}
            for dados in pacote.get('tiposResposta') or []:
                tipo = TipoRespostaSGQ.objects.create(
                    filial=dados['filial'],
                    sequencia=dados['sequencia'],
                    nome=dados['nome'],
                    opcoes=dados.get('opcoes') or [],
                    publica=bool(dados.get('publica')),
                    emissor=dados.get('emissor') or '',
                )
                tipos[(tipo.filial, tipo.nome)] = tipo
            normas = {}
            for dados in pacote.get('normas') or []:
                norma = NormaSGQ.objects.create(
                    filial=dados['filial'],
                    nome=dados['nome'],
                    descricao=dados.get('descricao') or '',
                    data_atualizacao=parse_date(dados['dataAtualizacao']),
                    emissor=dados.get('emissor') or '',
                    publica=bool(dados.get('publica')),
                    ativa=bool(dados.get('ativa', True)),
                    classificacoes=dados.get('classificacoes') or [],
                    areas=dados.get('areas') or [],
                    mapeamento_importacao=dados.get('mapeamentoImportacao') or [],
                )
                normas[(norma.filial, norma.nome)] = norma
                self._itens(norma, dados.get('itens') or [], tipos, None)
            for dados in pacote.get('categorias') or []:
                categoria = CategoriaAuditoriaSGQ.objects.create(
                    filial=dados['filial'],
                    nome=dados['nome'],
                    ativa=bool(dados.get('ativa', True)),
                    emissor=dados.get('emissor') or '',
                    atualizado_por=dados.get('atualizadoPor') or '',
                )
                vinculadas = [normas[(dados['filial'], nome)] for nome in dados.get('normas') or [] if (dados['filial'], nome) in normas]
                if vinculadas:
                    categoria.normas.set(vinculadas)
            for dados in pacote.get('auditorias') or []:
                auditoria = AuditoriaSGQ.objects.create(
                    filial=dados['filial'],
                    ano=dados['ano'],
                    sequencia=dados['sequencia'],
                    codigo=dados['codigo'],
                    categoria=dados.get('categoria') or '',
                    titulo=dados['titulo'],
                    data_inicio=parse_date(dados['dataInicio']),
                    data_termino=parse_date(dados['dataTermino']),
                    auditor_lider=dados.get('auditorLider') or '',
                    auditores=dados.get('auditores') or [],
                    status=dados.get('status') or 'planejamento',
                    escopo=dados.get('escopo') or '',
                )
                vinculadas = [normas[(dados['filial'], nome)] for nome in dados.get('normas') or [] if (dados['filial'], nome) in normas]
                if vinculadas:
                    auditoria.normas.set(vinculadas)
        self.stdout.write(self.style.SUCCESS(
            f"Auditorias importadas: {len(pacote.get('normas') or [])} normas, "
            f"{len(pacote.get('auditorias') or [])} auditorias."
        ))

    def _itens(self, norma, itens, tipos, parent):
        for dados in itens:
            tipo_resposta = tipos.get((norma.filial, dados.get('tipoResposta') or ''))
            item = ItemNormaSGQ.objects.create(
                norma=norma,
                parent=parent,
                ordem=dados.get('ordem') or 0,
                codigo=dados.get('codigo') or '',
                titulo=dados['titulo'],
                descricao=dados.get('descricao') or '',
                tipo=dados.get('tipo') or 'orientativo',
                tipo_resposta=tipo_resposta,
                classificacao=dados.get('classificacao') or '',
                areas=dados.get('areas') or [],
                peso=Decimal(str(dados.get('peso') or '1')),
                obrigatorio=bool(dados.get('obrigatorio', True)),
            )
            self._itens(norma, dados.get('filhos') or [], tipos, item)
