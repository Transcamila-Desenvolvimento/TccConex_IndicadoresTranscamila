from pathlib import Path

from django.db.models import Q
from django.http import FileResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_audit
from apps.marketing.google_drive import browse_drive_folder, drive_status
from apps.rh.documento_texto import extrair_texto, garantir_texto
from apps.rh.drive_documento import EXTENSOES, baixar_conteudo_drive

from .models import DocumentoMatrizEmpresarial, PastaMatrizEmpresarial
from .serializers import DocumentoMatrizEmpresarialSerializer, PastaMatrizEmpresarialSerializer

DOCUMENTO_MAX_BYTES = 15 * 1024 * 1024
_PROFUNDIDADE_MAXIMA_PASTA = 8


class _AdminMatrizMixin:
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not request.user.is_admin:
            self.permission_denied(request, message='Só a administração altera a Matriz empresarial.')


def _aplicar_conteudo_drive(documento, dados):
    from io import BytesIO

    if documento.arquivo:
        documento.arquivo.delete(save=False)
        documento.arquivo = ''
    documento.drive_file_id = dados['id']
    documento.link_externo = dados['link']
    documento.nome_original = dados['nome']
    documento.tamanho = dados['tamanho']
    documento.texto = extrair_texto(BytesIO(dados['conteudo']), dados['nome'], dados['tamanho'])
    documento.texto_extraido = True


def _erro_arquivo(arquivo):
    if not arquivo:
        return Response({'arquivo': 'Escolha o arquivo.'}, status=status.HTTP_400_BAD_REQUEST)
    ext = Path(arquivo.name).suffix.lower()
    if ext not in EXTENSOES:
        return Response({'arquivo': 'Tipo de arquivo não aceito.'}, status=status.HTTP_400_BAD_REQUEST)
    if arquivo.size > DOCUMENTO_MAX_BYTES:
        return Response({'arquivo': 'O arquivo passou de 15 MB.'}, status=status.HTTP_400_BAD_REQUEST)
    return None


def _resolver_pasta(valor):
    if valor in (None, '', 'null'):
        return None, None
    pasta = PastaMatrizEmpresarial.objects.filter(pk=str(valor)).first()
    if not pasta:
        return None, Response({'pastaId': 'Pasta não encontrada.'}, status=status.HTTP_400_BAD_REQUEST)
    return pasta, None


def _profundidade_pasta(pasta):
    nivel = 1
    atual = pasta.parent
    while atual is not None and nivel <= _PROFUNDIDADE_MAXIMA_PASTA + 1:
        nivel += 1
        atual = atual.parent
    return nivel


def _nome_pasta(valor):
    nome = str(valor or '').strip()
    if not nome:
        return None, Response({'nome': 'Informe o nome da pasta.'}, status=status.HTTP_400_BAD_REQUEST)
    if len(nome) > 120:
        return None, Response({'nome': 'O nome passou de 120 caracteres.'}, status=status.HTTP_400_BAD_REQUEST)
    return nome, None


def _titulo(valor, atual=''):
    titulo = str(valor if valor is not None else atual).strip()
    if not titulo:
        return None, Response({'titulo': 'Informe o título do documento.'}, status=status.HTTP_400_BAD_REQUEST)
    if len(titulo) > 160:
        return None, Response({'titulo': 'O título passou de 160 caracteres.'}, status=status.HTTP_400_BAD_REQUEST)
    return titulo, None


class PastaMatrizEmpresarialViewSet(_AdminMatrizMixin, viewsets.ModelViewSet):
    serializer_class = PastaMatrizEmpresarialSerializer
    queryset = PastaMatrizEmpresarial.objects.all()
    pagination_class = None
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def list(self, request, *args, **kwargs):
        dados = self.get_serializer(self.get_queryset(), many=True).data
        return Response({'count': len(dados), 'results': dados})

    def create(self, request, *args, **kwargs):
        nome, erro = _nome_pasta(request.data.get('nome'))
        if erro:
            return erro
        parent, erro = _resolver_pasta(request.data.get('parentId'))
        if erro:
            return erro
        if parent and _profundidade_pasta(parent) >= _PROFUNDIDADE_MAXIMA_PASTA:
            return Response({'parentId': 'Essa pasta já está no limite de níveis.'}, status=status.HTTP_400_BAD_REQUEST)
        if PastaMatrizEmpresarial.objects.filter(parent=parent, nome__iexact=nome).exists():
            return Response({'nome': 'Já existe uma pasta com esse nome aqui.'}, status=status.HTTP_400_BAD_REQUEST)
        pasta = PastaMatrizEmpresarial.objects.create(nome=nome, parent=parent)
        record_audit(request.user, 'camilo.matriz.pasta_criar', nome)
        return Response(self.get_serializer(pasta).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def renomear(self, request, pk=None):
        pasta = self.get_object()
        nome, erro = _nome_pasta(request.data.get('nome'))
        if erro:
            return erro
        if PastaMatrizEmpresarial.objects.filter(parent=pasta.parent, nome__iexact=nome).exclude(pk=pasta.pk).exists():
            return Response({'nome': 'Já existe uma pasta com esse nome aqui.'}, status=status.HTTP_400_BAD_REQUEST)
        pasta.nome = nome
        pasta.save(update_fields=['nome'])
        record_audit(request.user, 'camilo.matriz.pasta_renomear', nome)
        return Response(self.get_serializer(pasta).data)

    def destroy(self, request, *args, **kwargs):
        pasta = self.get_object()
        if pasta.subpastas.exists() or pasta.documentos.exists():
            return Response(
                {'detail': 'A pasta tem itens. Esvazie antes de excluir.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        nome = pasta.nome
        pasta.delete()
        record_audit(request.user, 'camilo.matriz.pasta_excluir', nome)
        return Response(status=status.HTTP_204_NO_CONTENT)


class DocumentoMatrizEmpresarialViewSet(_AdminMatrizMixin, viewsets.ModelViewSet):
    serializer_class = DocumentoMatrizEmpresarialSerializer
    queryset = DocumentoMatrizEmpresarial.objects.select_related('incluido_por', 'pasta')
    pagination_class = None
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        dados = self.get_serializer(qs, many=True).data
        return Response({'count': len(dados), 'results': dados})

    def get_queryset(self):
        qs = super().get_queryset()
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(Q(titulo__icontains=search) | Q(nome_original__icontains=search))
        return qs

    def create(self, request, *args, **kwargs):
        titulo, erro = _titulo(request.data.get('titulo'))
        if erro:
            return erro
        pasta, erro_pasta = _resolver_pasta(request.data.get('pastaId'))
        if erro_pasta:
            return erro_pasta
        drive_id = str(request.data.get('driveFileId') or '').strip()
        if drive_id:
            try:
                dados = baixar_conteudo_drive(request.user, drive_id)
            except ValueError as exc:
                return Response({'arquivo': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            documento = DocumentoMatrizEmpresarial(
                titulo=titulo,
                nome_original=dados['nome'],
                tamanho=dados['tamanho'],
                incluido_por=request.user,
                pasta=pasta,
            )
            _aplicar_conteudo_drive(documento, dados)
            documento.save()
            record_audit(request.user, 'camilo.matriz.incluir', titulo)
            return Response(DocumentoMatrizEmpresarialSerializer(documento).data, status=status.HTTP_201_CREATED)

        arquivo = request.FILES.get('arquivo')
        erro = _erro_arquivo(arquivo)
        if erro:
            return erro
        documento = DocumentoMatrizEmpresarial.objects.create(
            titulo=titulo,
            arquivo=arquivo,
            nome_original=Path(arquivo.name).name[:180],
            tamanho=arquivo.size,
            incluido_por=request.user,
            pasta=pasta,
        )
        garantir_texto(documento)
        record_audit(request.user, 'camilo.matriz.incluir', titulo)
        return Response(DocumentoMatrizEmpresarialSerializer(documento).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def substituir(self, request, pk=None):
        documento = self.get_object()
        titulo, erro = _titulo(request.data.get('titulo'), documento.titulo)
        if erro:
            return erro
        drive_id = str(request.data.get('driveFileId') or '').strip()
        if drive_id:
            try:
                dados = baixar_conteudo_drive(request.user, drive_id)
            except ValueError as exc:
                return Response({'arquivo': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            documento.titulo = titulo
            _aplicar_conteudo_drive(documento, dados)
            documento.save()
            record_audit(request.user, 'camilo.matriz.substituir', documento.titulo)
            return Response(DocumentoMatrizEmpresarialSerializer(documento).data)

        arquivo = request.FILES.get('arquivo')
        erro = _erro_arquivo(arquivo)
        if erro:
            return erro
        if documento.arquivo:
            documento.arquivo.delete(save=False)
        documento.titulo = titulo
        documento.arquivo = arquivo
        documento.drive_file_id = ''
        documento.link_externo = ''
        documento.nome_original = Path(arquivo.name).name[:180]
        documento.tamanho = arquivo.size
        documento.texto = ''
        documento.texto_extraido = False
        documento.save()
        garantir_texto(documento)
        record_audit(request.user, 'camilo.matriz.substituir', documento.titulo)
        return Response(DocumentoMatrizEmpresarialSerializer(documento).data)

    @action(detail=True, methods=['post'])
    def renomear(self, request, pk=None):
        documento = self.get_object()
        titulo, erro = _titulo(request.data.get('titulo'))
        if erro:
            return erro
        documento.titulo = titulo
        documento.save(update_fields=['titulo'])
        record_audit(request.user, 'camilo.matriz.renomear', titulo)
        return Response(DocumentoMatrizEmpresarialSerializer(documento).data)

    @action(detail=True, methods=['post'])
    def mover(self, request, pk=None):
        documento = self.get_object()
        pasta, erro = _resolver_pasta(request.data.get('pastaId'))
        if erro:
            return erro
        documento.pasta = pasta
        documento.save(update_fields=['pasta'])
        destino = pasta.nome if pasta else 'a raiz'
        record_audit(request.user, 'camilo.matriz.mover', f'{documento.titulo} → {destino}')
        return Response(DocumentoMatrizEmpresarialSerializer(documento).data)

    def perform_destroy(self, instance):
        titulo = instance.titulo
        if instance.arquivo:
            instance.arquivo.delete(save=False)
        instance.delete()
        record_audit(self.request.user, 'camilo.matriz.excluir', titulo)

    @action(detail=True, methods=['get'])
    def arquivo(self, request, pk=None):
        documento = self.get_object()
        if not documento.arquivo:
            return Response({'detail': 'Arquivo não encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        nome = documento.nome_original or 'documento'
        return FileResponse(documento.arquivo.open('rb'), as_attachment=True, filename=nome)


class MatrizEmpresarialDriveStatusView(_AdminMatrizMixin, APIView):
    def get(self, request):
        return Response(drive_status(request.user))


class MatrizEmpresarialDriveBrowseView(_AdminMatrizMixin, APIView):
    def get(self, request):
        folder_id = (request.query_params.get('folderId') or 'root').strip() or 'root'
        page_token = (request.query_params.get('pageToken') or '').strip() or None
        drive_id = (request.query_params.get('driveId') or '').strip() or None
        try:
            page_size = int(request.query_params.get('pageSize') or 50)
        except ValueError:
            page_size = 50
        try:
            payload = browse_drive_folder(
                request.user,
                folder_id=folder_id,
                page_token=page_token,
                page_size=page_size,
                drive_id=drive_id,
                perfil='documentos',
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=400)

        items = []
        for item in payload['items']:
            ext = Path(item.get('name') or '').suffix.lower()
            anexavel = item.get('kind') != 'folder' and ext in EXTENSOES
            items.append({**item, 'thumbnailUrl': None, 'attachable': anexavel})
        return Response({
            'folderId': payload['folderId'],
            'driveId': payload.get('driveId'),
            'items': items,
            'nextPageToken': payload.get('nextPageToken'),
        })
