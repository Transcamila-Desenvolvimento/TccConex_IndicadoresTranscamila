from django.core.management.base import BaseCommand

from apps.indicadores.models import IndicadorFilial, IndicadorKpi

INITIAL_KPIS = [
    ('Receita Total', 'R$ 1.284.500', '+12,3%', True, 1),
    ('Fretes Realizados', '342', '+8,1%', True, 2),
    ('Toneladas Transportadas', '5.820 t', '+5,4%', True, 3),
    ('Veículos Ativos', '47', '-2,1%', False, 4),
    ('Custo Médio/Frete', 'R$ 3.753', '-3,7%', False, 5),
    ('NPS Clientes', '78', '+4 pts', True, 6),
]

INITIAL_FILIAIS = [
    ('Ibiporã (Matriz)', 'R$ 612.000', 168, '2.840 t', '102%', 1),
    ('Rondonópolis', 'R$ 398.500', 112, '1.920 t', '96%', 2),
    ('Paranaguá', 'R$ 274.000', 62, '1.060 t', '89%', 3),
]


class Command(BaseCommand):
    help = 'Seed indicadores KPIs and filiais'

    def handle(self, *args, **options):
        if not IndicadorKpi.objects.exists():
            for label, value, change, up, order in INITIAL_KPIS:
                IndicadorKpi.objects.create(
                    label=label, value=value, change=change, up=up, sort_order=order,
                )
            self.stdout.write(self.style.SUCCESS(f'Created {len(INITIAL_KPIS)} KPIs.'))
        else:
            self.stdout.write('Indicador KPIs already exist — skipping.')

        if not IndicadorFilial.objects.exists():
            for filial, receita, fretes, toneladas, meta, order in INITIAL_FILIAIS:
                IndicadorFilial.objects.create(
                    filial=filial, receita=receita, fretes=fretes,
                    toneladas=toneladas, meta=meta, sort_order=order,
                )
            self.stdout.write(self.style.SUCCESS(f'Created {len(INITIAL_FILIAIS)} filial rows.'))
        else:
            self.stdout.write('Indicador filiais already exist — skipping.')

        self.stdout.write(self.style.SUCCESS('Indicadores seed completed.'))
