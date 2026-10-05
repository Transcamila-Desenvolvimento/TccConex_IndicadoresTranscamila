from pathlib import Path

from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.mixins import ModuleScopedViewMixin
from apps.marketing.google_drive import browse_drive_folder, drive_status

from .drive_documento import EXTENSOES


def _sem_aba_documentos(user) -> bool:
    if getattr(user, 'is_admin', False):
        return False
    abas = (getattr(user, 'abas', None) or {}).get('RH') or []
    return bool(abas) and 'documentos' not in abas


class RHDriveStatusView(ModuleScopedViewMixin, APIView):
    permission_module = 'RH'
    permission_requires_filial = False

    def get(self, request):
        if _sem_aba_documentos(request.user):
            self.permission_denied(request, message='Sem acesso à aba Documentos do RH.')
        return Response(drive_status(request.user))


class RHDriveBrowseView(ModuleScopedViewMixin, APIView):
    permission_module = 'RH'
    permission_requires_filial = False

    def get(self, request):
        if _sem_aba_documentos(request.user):
            self.permission_denied(request, message='Sem acesso à aba Documentos do RH.')

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
