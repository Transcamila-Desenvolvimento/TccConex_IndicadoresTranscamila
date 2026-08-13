from django.http import HttpResponse, StreamingHttpResponse
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.mixins import ModuleScopedViewMixin

from .google_drive import (
    browse_drive_folder,
    drive_status,
    fetch_thumbnail_bytes,
    open_drive_file_stream,
)


class DriveStatusView(ModuleScopedViewMixin, APIView):
    permission_module = 'Marketing'
    permission_requires_filial = False

    def get(self, request):
        return Response(drive_status(request.user))


class DriveBrowseView(ModuleScopedViewMixin, APIView):
    permission_module = 'Marketing'
    permission_requires_filial = False

    def get(self, request):
        folder_id = (request.query_params.get('folderId') or 'root').strip() or 'root'
        page_token = (request.query_params.get('pageToken') or '').strip() or None

        try:
            page_size = int(request.query_params.get('pageSize') or 50)
        except ValueError:
            page_size = 50

        drive_id = (request.query_params.get('driveId') or '').strip() or None

        try:
            payload = browse_drive_folder(
                request.user,
                folder_id=folder_id,
                page_token=page_token,
                page_size=page_size,
                drive_id=drive_id,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=400)

        items = []
        for item in payload['items']:
            items.append({**item, 'thumbnailUrl': None})

        return Response({
            'folderId': payload['folderId'],
            'driveId': payload.get('driveId'),
            'items': items,
            'nextPageToken': payload.get('nextPageToken'),
        })


class DriveThumbnailView(ModuleScopedViewMixin, APIView):
    permission_module = 'Marketing'
    permission_requires_filial = False

    def get(self, request):
        file_id = (request.query_params.get('fileId') or '').strip()
        if not file_id:
            return Response({'detail': 'fileId é obrigatório.'}, status=400)

        try:
            body, content_type = fetch_thumbnail_bytes(request.user, file_id)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=404)

        response = HttpResponse(body, content_type=content_type)
        response['Cache-Control'] = 'private, max-age=300'
        return response


class DrivePreviewView(ModuleScopedViewMixin, APIView):
    permission_module = 'Marketing'
    permission_requires_filial = False

    def get(self, request):
        file_id = (request.query_params.get('fileId') or '').strip()
        if not file_id:
            return Response({'detail': 'fileId é obrigatório.'}, status=400)

        try:
            content_type, name, drive_response = open_drive_file_stream(request.user, file_id)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=404)

        def stream():
            try:
                while True:
                    chunk = drive_response.read(65536)
                    if not chunk:
                        break
                    yield chunk
            finally:
                drive_response.close()

        response = StreamingHttpResponse(stream(), content_type=content_type)
        response['Content-Disposition'] = f'inline; filename="{name}"'
        response['Cache-Control'] = 'private, max-age=300'
        return response
