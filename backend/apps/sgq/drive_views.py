from pathlib import Path

from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.mixins import ModuleScopedViewMixin
from apps.marketing.google_drive import browse_drive_folder, drive_status
from apps.rh.drive_documento import EXTENSOES

from .matriz_views import _sem_aba_matriz


class SGQDriveStatusView(ModuleScopedViewMixin, APIView):
    permission_module = 'SGQ'
    permission_requires_filial = False

    def get(self, request):
        if _sem_aba_matriz(request.user):
            self.permission_denied(request, message='Sem acesso à Matriz de conhecimento.')
        return Response(drive_status(request.user))


class SGQDriveBrowseView(ModuleScopedViewMixin, APIView):
    permission_module = 'SGQ'
    permission_requires_filial = False

    def get(self, request):
        if _sem_aba_matriz(request.user):
            self.permission_denied(request, message='Sem acesso à Matriz de conhecimento.')

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
