from django.http import HttpResponse
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.mixins import ModuleScopedViewMixin

from .drive_bank import (
    drive_bank_status,
    drive_folder_configured,
    fetch_thumbnail_bytes,
    list_drive_media,
)


class DriveBankConfigView(ModuleScopedViewMixin, APIView):
    permission_module = 'Marketing'
    permission_requires_filial = False

    def get(self, request):
        status_payload = drive_bank_status(request.user)
        return Response(status_payload)


class DriveBankListView(ModuleScopedViewMixin, APIView):
    permission_module = 'Marketing'
    permission_requires_filial = False

    def get(self, request):
        if not drive_folder_configured():
            return Response(
                {'detail': 'Banco de mídias não configurado. Defina MARKETING_DRIVE_FOLDER_ID.'},
                status=503,
            )

        kind = (request.query_params.get('kind') or 'all').strip().lower()
        if kind not in {'all', 'image', 'video'}:
            kind = 'all'

        search = (request.query_params.get('search') or '').strip()
        page_token = (request.query_params.get('pageToken') or '').strip() or None

        try:
            page_size = int(request.query_params.get('pageSize') or 24)
        except ValueError:
            page_size = 24

        try:
            payload = list_drive_media(
                request.user,
                page_token=page_token,
                search=search,
                kind=kind,
                page_size=page_size,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=400)

        files = []
        for item in payload['files']:
            thumb_url = None
            if item.get('hasThumbnail'):
                thumb_url = f"/api/marketing/drive-bank/thumbnail/?fileId={item['id']}"
            files.append({
                **item,
                'thumbnailUrl': thumb_url,
            })

        return Response({
            'files': files,
            'nextPageToken': payload.get('nextPageToken'),
            'authMode': payload.get('authMode'),
        })


class DriveBankThumbnailView(ModuleScopedViewMixin, APIView):
    permission_module = 'Marketing'
    permission_requires_filial = False

    def get(self, request):
        file_id = (request.query_params.get('fileId') or '').strip()
        if not file_id:
            return Response({'detail': 'fileId é obrigatório.'}, status=400)
        if not drive_folder_configured():
            return Response({'detail': 'Banco de mídias não configurado.'}, status=503)

        try:
            body, content_type = fetch_thumbnail_bytes(request.user, file_id)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=404)

        response = HttpResponse(body, content_type=content_type)
        response['Cache-Control'] = 'private, max-age=300'
        return response
