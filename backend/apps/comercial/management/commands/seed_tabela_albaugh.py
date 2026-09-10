from django.core.management.base import BaseCommand
from django.db import transaction

from apps.comercial.models import (
    STATUS_TABELA_PUBLICADA,
    TIPO_TABELA_DISTRIBUICAO,
    ClienteComercial,
    TabelaFrete,
)
from apps.comercial.tabela_distribuicao import preset_config_albaugh
from apps.faturamento.models import TIPO_PESSOA_JURIDICA


class Command(BaseCommand):
    help = 'Cadastra cliente Albaugh e tabela de distribuição Rev.31 para testes.'

    @transaction.atomic
    def handle(self, *args, **options):
        cliente, created_cliente = ClienteComercial.objects.get_or_create(
            razao_social='Albaugh LLC S.A.',
            defaults={
                'nome_fantasia': 'Albaugh',
                'tipo_pessoa': TIPO_PESSOA_JURIDICA,
                'municipio': 'São Paulo',
                'uf': 'SP',
                'situacao': 'cliente',
            },
        )
        if created_cliente:
            self.stdout.write(self.style.SUCCESS(f'Cliente Albaugh criado (id={cliente.pk}).'))
        else:
            self.stdout.write(f'Cliente Albaugh já existia (id={cliente.pk}).')

        config = preset_config_albaugh()
        tabela, created = TabelaFrete.objects.update_or_create(
            codigo='ALBAUGH-2022',
            revisao=31,
            defaults={
                'nome': 'Albaugh Distribuição Rev.31',
                'cliente': cliente,
                'tipo': TIPO_TABELA_DISTRIBUICAO,
                'config': config,
                'status': STATUS_TABELA_PUBLICADA,
                'observacoes': (
                    'Importado de TABELA 2022 - ALBAUGH - Rev.31.xlsx. '
                    'Grade referência Hortolândia; pedágio R$/ton Paulínia×RO (51,70). '
                    'Cenário de teste: 1400 km, 5000 kg fechado → frete 16.877,73.'
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
