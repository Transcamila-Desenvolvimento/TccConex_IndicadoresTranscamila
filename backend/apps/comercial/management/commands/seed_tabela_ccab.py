from django.core.management.base import BaseCommand
from django.db import transaction

from apps.comercial.models import (
    STATUS_TABELA_PUBLICADA,
    TIPO_TABELA_DISTRIBUICAO,
    ClienteComercial,
    TabelaFrete,
)
from apps.comercial.tabela_distribuicao import preset_config_ccab
from apps.faturamento.models import TIPO_PESSOA_JURIDICA


class Command(BaseCommand):
    help = 'Cadastra cliente CCAB e tabela de distribuição Rev.61 para testes.'

    @transaction.atomic
    def handle(self, *args, **options):
        cliente, created_cliente = ClienteComercial.objects.get_or_create(
            razao_social='CCAB AGRO S.A.',
            defaults={
                'nome_fantasia': 'CCAB',
                'tipo_pessoa': TIPO_PESSOA_JURIDICA,
                'municipio': 'Londrina',
                'uf': 'PR',
                'situacao': 'cliente',
            },
        )
        if created_cliente:
            self.stdout.write(self.style.SUCCESS(f'Cliente CCAB criado (id={cliente.pk}).'))
        else:
            self.stdout.write(f'Cliente CCAB já existia (id={cliente.pk}).')

        config = preset_config_ccab()
        tabela, created = TabelaFrete.objects.update_or_create(
            codigo='CCAB-2024',
            revisao=61,
            defaults={
                'nome': 'CCAB Distribuição Rev.61',
                'cliente': cliente,
                'tipo': TIPO_TABELA_DISTRIBUICAO,
                'config': config,
                'status': STATUS_TABELA_PUBLICADA,
                'observacoes': (
                    'Importado de TABELA 2024 - CCAB - Revisão 61.xlsm (aba DISTRIBUIÇÃO). '
                    'Tarifa fixa + valor por km, bandas por divisor. '
                    'Cenário de teste: 1350 km, 1506 kg fracionado → frete ≈ 3.108,00.'
                ),
            },
        )
        tabela.regenerar_faixas()
        tabela.save()
        action = 'criada' if created else 'atualizada'
        self.stdout.write(
            self.style.SUCCESS(
                f'Tabela "{tabela.nome}" {action} (id={tabela.pk}, {len(tabela.faixas)} faixas).'
            )
        )
