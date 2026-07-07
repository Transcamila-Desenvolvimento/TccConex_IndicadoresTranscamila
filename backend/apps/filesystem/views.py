import os

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .path_utils import PathAccessError, get_home_dir, resolve_safe_path


class HomeDirAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'homeDir': get_home_dir()})


class ListDirectoryAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        raw_path = request.query_params.get('path', '')

        try:
            target = resolve_safe_path(raw_path)
        except PathAccessError as exc:
            return Response({'success': False, 'error': str(exc)}, status=status.HTTP_403_FORBIDDEN)

        if not target.exists():
            return Response(
                {'success': False, 'error': 'Diretório não encontrado.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not target.is_dir():
            return Response(
                {'success': False, 'error': 'O caminho especificado não é um diretório.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        subdirs: list[str] = []
        try:
            for item in os.listdir(target):
                if item.startswith('.'):
                    continue
                full_path = target / item
                try:
                    if full_path.is_dir():
                        subdirs.append(item)
                except OSError:
                    continue
        except OSError as exc:
            return Response(
                {'success': False, 'error': str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        parent = target.parent
        parent_path = str(parent) if parent != target else None

        return Response({
            'success': True,
            'currentPath': str(target),
            'parentPath': parent_path,
            'subdirs': sorted(subdirs),
        })


class WriteFileAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        file_path = request.data.get('filePath')
        content = request.data.get('content', '')

        if not file_path:
            return Response(
                {'success': False, 'error': 'Caminho do arquivo não fornecido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target = resolve_safe_path(file_path)
        except PathAccessError as exc:
            return Response({'success': False, 'error': str(exc)}, status=status.HTTP_403_FORBIDDEN)

        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding='utf-8')
        except OSError as exc:
            return Response(
                {'success': False, 'error': str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({'success': True})
