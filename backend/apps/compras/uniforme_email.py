"""Aviso de entrega ou devolução de uniforme, no mesmo padrão visual do e-mail comercial."""

import logging
from email.mime.image import MIMEImage

from django.core.exceptions import ValidationError
from django.core.mail import EmailMessage
from django.core.validators import validate_email
from django.template.loader import render_to_string

from .models import CONDICAO_CHOICES
from .termo_pdf import gerar_termo_pdf
from .uniformes_service import UniformeError

logger = logging.getLogger(__name__)

_CONDICAO = dict(CONDICAO_CHOICES)


def validar_email_aviso(valor) -> str:
    email = (valor or '').strip()
    if not email:
        raise UniformeError('Informe o e-mail que vai receber o aviso.')
    try:
        validate_email(email)
    except ValidationError:
        raise UniformeError('Informe um e-mail válido para o aviso.')
    return email


def enviar_aviso_entrega(entrega, destino: str) -> dict:
    itens = [
        {
            'termo': entrega.numero,
            'nome': item.uniforme_nome,
            'tamanho': item.uniforme_tamanho,
            'condicao': _CONDICAO.get(item.condicao, item.condicao),
            'quantidade': item.quantidade,
            'detalhe': '',
        }
        for item in entrega.itens.all()
    ]
    return _enviar(
        destino,
        assunto=f'Entrega de uniforme — {entrega.numero}',
        titulo='Entrega de uniforme',
        subtitulo=entrega.numero,
        pessoa=entrega.colaborador_nome,
        cargo=entrega.colaborador_cargo,
        setor=entrega.colaborador_setor,
        data=entrega.data_entrega,
        data_rotulo='Data da entrega',
        responsavel=entrega.usuario_nome,
        observacoes=entrega.observacoes,
        itens=itens,
        eh_devolucao=False,
        entregas=[entrega],
    )


def enviar_aviso_devolucao(devolucoes, destino: str) -> dict:
    if not devolucoes:
        return {'emailEnviado': False, 'emailAviso': ''}
    primeira = devolucoes[0].entrega
    itens = []
    termos = []
    for devolucao in devolucoes:
        entrega = devolucao.entrega
        termos.append(entrega.numero)
        for item in devolucao.itens.all():
            peca = item.entrega_item
            partes = []
            if item.qtd_boa:
                partes.append(f'{item.qtd_boa} em boas condições')
            if item.qtd_danificada:
                partes.append(f'{item.qtd_danificada} danificada(s)')
            if item.qtd_sem_condicoes:
                partes.append(f'{item.qtd_sem_condicoes} sem condições de uso')
            if item.qtd_perdida:
                partes.append(f'{item.qtd_perdida} perdida(s)')
            itens.append({
                'termo': entrega.numero,
                'nome': peca.uniforme_nome,
                'tamanho': peca.uniforme_tamanho,
                'condicao': _CONDICAO.get(peca.condicao, peca.condicao),
                'quantidade': item.qtd_boa + item.qtd_danificada + item.qtd_sem_condicoes + item.qtd_perdida,
                'detalhe': ', '.join(partes),
            })
    varios = len(termos) > 1
    return _enviar(
        destino,
        assunto='Devolução de uniforme — ' + (primeira.colaborador_nome if varios else primeira.numero),
        titulo='Devolução de uniforme',
        subtitulo=', '.join(termos),
        pessoa=primeira.colaborador_nome,
        cargo=primeira.colaborador_cargo,
        setor=primeira.colaborador_setor,
        data=devolucoes[0].data_devolucao,
        data_rotulo='Data da devolução',
        responsavel=devolucoes[0].usuario_nome,
        observacoes=devolucoes[-1].observacoes,
        itens=itens,
        eh_devolucao=True,
        entregas=[devolucao.entrega for devolucao in devolucoes],
    )


def _enviar(destino, *, assunto, titulo, subtitulo, pessoa, cargo, setor, data, data_rotulo, responsavel, observacoes, itens, eh_devolucao, entregas) -> dict:
    if not destino:
        return {'emailEnviado': False, 'emailAviso': ''}
    from apps.comercial.proposta_email_service import LOGO_CID, _logo_mime_subtype, _logo_png_bytes

    logo = _logo_png_bytes()
    html = render_to_string('compras/emails/uniforme.html', {
        'titulo': titulo,
        'subtitulo': subtitulo,
        'pessoa': pessoa,
        'cargo': cargo,
        'setor': setor,
        'data': data,
        'data_rotulo': data_rotulo,
        'responsavel': responsavel,
        'observacoes': observacoes,
        'itens': itens,
        'eh_devolucao': eh_devolucao,
        'total_pecas': sum(item['quantidade'] for item in itens),
        'logo_cid': LOGO_CID if logo else '',
    })
    mensagem = EmailMessage(subject=assunto, body=html, to=[destino])
    mensagem.content_subtype = 'html'
    anexados = set()
    for entrega in entregas:
        if entrega.pk in anexados:
            continue
        anexados.add(entrega.pk)
        mensagem.attach(
            f'Termo_{entrega.numero}.pdf',
            gerar_termo_pdf(entrega),
            'application/pdf',
        )
    if logo:
        imagem = MIMEImage(logo, _subtype=_logo_mime_subtype())
        imagem.add_header('Content-ID', f'<{LOGO_CID}>')
        imagem.add_header('Content-Disposition', 'inline', filename='logo.png')
        mensagem.attach(imagem)
    try:
        mensagem.send(fail_silently=False)
    except Exception:
        logger.exception('Falha ao enviar aviso de uniforme para %s', destino)
        return {'emailEnviado': False, 'emailAviso': destino}
    return {'emailEnviado': True, 'emailAviso': destino}
