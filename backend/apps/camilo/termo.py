"""Texto oficial do termo de uso do CamiloIA, versionado para o comprovante."""

VERSAO_ATUAL = 'v1'
ASSINATURA = 'CamiloIA - Desenvolvido e distribuído internamente: Transcamila Cargas e Armazéns Gerais Ltda.'

TERMOS = {
    'v1': {
        'titulo': 'Termo de uso do Camilo IA',
        'introducao': 'Antes de usar esta ferramenta, leia e aceite as condições abaixo.',
        'assinatura': ASSINATURA,
        'declaracao': 'Li e concordo com o termo de uso do Camilo IA.',
        'secoes': [
            {
                'titulo': 'Visibilidade das informações',
                'texto': (
                    'As mensagens, perguntas e demais conteúdos compartilhados neste chat ficam '
                    'visíveis para a empresa. O histórico pode ser consultado por pessoas '
                    'autorizadas a acompanhar o uso do Camilo IA. Este ambiente não é um canal '
                    'particular nem confidencial em relação à organização.'
                ),
            },
            {
                'titulo': 'Responsabilidade',
                'texto': (
                    'O Camilo IA é uma ferramenta de trabalho e o seu uso ocorre sob '
                    'responsabilidade da empresa. As respostas servem de apoio à rotina e devem '
                    'ser conferidas antes de decisões, comunicações externas ou registros oficiais. '
                    'Utilize o chat apenas para atividades da empresa e compartilhe somente as '
                    'informações necessárias à sua função.'
                ),
            },
        ],
    },
}


def texto_da_versao(versao: str) -> dict | None:
    from apps.camilo.models import TermoVersao

    numero = str(versao or '').removeprefix('v')
    if numero.isdigit():
        registro = TermoVersao.objects.filter(numero=int(numero)).first()
        if registro:
            return registro.como_texto()
    texto = TERMOS.get(versao)
    if not texto:
        return None
    return {
        'titulo': texto['titulo'],
        'introducao': texto['introducao'],
        'assinatura': texto['assinatura'],
        'declaracao': texto['declaracao'],
        'secoes': [dict(secao) for secao in texto['secoes']],
    }


def versao_vigente():
    from django.db import transaction

    from apps.camilo.models import TermoVersao

    vigente = TermoVersao.objects.filter(vigente=True).order_by('-numero').first()
    if vigente:
        return vigente
    ultima = TermoVersao.objects.order_by('-numero').first()
    if ultima:
        ultima.vigente = True
        ultima.save(update_fields=['vigente'])
        return ultima
    texto = TERMOS['v1']
    with transaction.atomic():
        return TermoVersao.objects.create(
            numero=1,
            titulo=texto['titulo'],
            introducao=texto['introducao'],
            assinatura=texto['assinatura'],
            declaracao=texto['declaracao'],
            secoes=texto['secoes'],
            vigente=True,
        )


def cabecalho_fixo() -> dict:
    texto = TERMOS['v1']
    return {
        'titulo': texto['titulo'],
        'introducao': texto['introducao'],
        'assinatura': texto['assinatura'],
    }


def publicar_versao(usuario, dados: dict):
    from django.db import transaction

    from apps.camilo.models import TermoVersao

    with transaction.atomic():
        TermoVersao.objects.filter(vigente=True).update(vigente=False)
        ultima = TermoVersao.objects.order_by('-numero').first()
        numero = (ultima.numero if ultima else 0) + 1
        fixo = cabecalho_fixo()
        return TermoVersao.objects.create(
            numero=numero,
            titulo=fixo['titulo'],
            introducao=fixo['introducao'],
            assinatura=fixo['assinatura'],
            declaracao=dados['declaracao'],
            secoes=dados['secoes'],
            vigente=True,
            criado_por=usuario,
        )


def termo_publico(registro) -> dict:
    texto = registro.como_texto()
    texto['versao'] = registro.codigo
    return texto
