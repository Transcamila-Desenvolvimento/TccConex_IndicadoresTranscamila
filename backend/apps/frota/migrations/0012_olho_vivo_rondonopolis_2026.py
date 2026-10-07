import calendar
import json
from datetime import datetime

from django.db import migrations
from django.utils import timezone

ORDEM = [
    "velocidade-acima-limite",
    "sinalizacao-regras",
    "sono-cansaco-atencao",
    "sem-cinto",
    "distancia-insegura",
    "comendo-fumando",
    "radio-celular",
    "ultrapassagem-insegura",
    "velocidade-trecho",
    "sem-seta",
]
DADOS = json.loads(
    '{"2026":{"1":[57,44,40,43,54,62,56,41,45,44],'
    '"2":[31,29,26,25,35,40,29,26,38,32],'
    '"3":[45,43,20,41,32,50,43,42,45,35],'
    '"4":[54,46,39,45,50,52,53,43,49,48],'
    '"5":[34,23,23,32,29,33,29,19,35,12],'
    '"6":[43,33,28,30,43,41,41,55,58,32],'
    '"7":[49,55,53,50,51,58,47,42,51,55],'
    '"8":[37,37,34,33,40,37,30,35,40,36],'
    '"9":[21,26,21,21,18,15,25,21,24,21]}}'
)


def _filial():
    return "Rondonópolis"


def importar_rondonopolis_2026(apps, schema_editor):
    Resposta = apps.get_model("frota", "RespostaOlhoVivo")
    Item = apps.get_model("frota", "ItemRespostaOlhoVivo")
    filial = _filial()
    Resposta.objects.filter(filial=filial).delete()
    for ano_txt, meses in DADOS.items():
        ano = int(ano_txt)
        for mes_txt, valores in meses.items():
            mes = int(mes_txt)
            period_key = f"{ano}-{mes:02d}"
            resposta = Resposta.objects.create(
                filial=filial,
                period_key=period_key,
                periodicidade="mensal",
                ano=ano,
                mes=mes,
                updated_by=None,
            )
            Item.objects.bulk_create([
                Item(resposta=resposta, comportamento=chave, recorrencia=int(recorrencia))
                for chave, recorrencia in zip(ORDEM, valores)
            ])
            ultimo = calendar.monthrange(ano, mes)[1]
            quando = timezone.make_aware(datetime(ano, mes, ultimo, 18, 0))
            Resposta.objects.filter(pk=resposta.pk).update(created_at=quando, updated_at=quando)


def remover_rondonopolis_2026(apps, schema_editor):
    Resposta = apps.get_model("frota", "RespostaOlhoVivo")
    chaves = [
        f"{int(ano)}-{int(mes):02d}"
        for ano, meses in DADOS.items()
        for mes in meses
    ]
    Resposta.objects.filter(filial=_filial(), period_key__in=chaves).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("frota", "0011_olho_vivo_historico_ibipora"),
    ]

    operations = [
        migrations.RunPython(importar_rondonopolis_2026, remover_rondonopolis_2026),
    ]
