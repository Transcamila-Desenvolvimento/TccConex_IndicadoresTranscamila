from django.core.management.base import BaseCommand
from django.db import transaction

from apps.comercial.models import (
    STATUS_TABELA_PUBLICADA,
    TIPO_TABELA_DISTRIBUICAO,
    TabelaFrete,
)
from apps.comercial.tabela_distribuicao import preset_config_oficial_distribuicao


class Command(BaseCommand):
    help = 'Cadastra a Tabela de frete padrão Distribuição (modelo oficial .xlsm) para testes.'

    @transaction.atomic
    def handle(self, *args, **options):
        config = preset_config_oficial_distribuicao()
        tabela, created = TabelaFrete.objects.update_or_create(
            codigo='PADRAO-DIST',
            revisao=1,
            defaults={
                'nome': 'Tabela de frete padrão Distribuição',
                'tipo': TIPO_TABELA_DISTRIBUICAO,
                'config': config,
                'status': STATUS_TABELA_PUBLICADA,
                'observacoes': (
                    'Espelho de TABELA FRETES MODELO OFICIAL.xlsm (abas OFICIAL e SIMULAÇÃO). '
                    'ANTT Res. 6.084/2026 — 17/07/2026; margens Truck 33%, Carreta 6 38% (exibe ANTT 7 eixos), '
                    'Carreta 7 33%; pedágio 17 × 1,05; GRIS/ADV 0,15%; faixas 0–3600 km.'
                ),
            },
        )
        tabela.regenerar_faixas()
        tabela.save()
        action = 'criada' if created else 'atualizada'
        self.stdout.write(
            self.style.SUCCESS(
                f'Tabela "{tabela.nome}" {action} (id={tabela.pk}, {len(tabela.faixas)} faixas, status={tabela.status}).'
            )
        )
