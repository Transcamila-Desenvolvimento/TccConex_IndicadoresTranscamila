from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .auditoria_views import (
    AuditoriaSGQViewSet,
    CategoriaAuditoriaSGQViewSet,
    ItemNormaSGQViewSet,
    NormaSGQViewSet,
    TipoRespostaSGQViewSet,
)
from .drive_views import SGQDriveBrowseView, SGQDriveStatusView
from .matriz_views import DocumentoSGQViewSet, PastaMatrizSGQViewSet
from .views import EscopoAnaliseOpcaoViewSet, EscopoAnaliseViewSet, PesquisaSatisfacaoViewSet

router = DefaultRouter()
router.register('pesquisas-satisfacao', PesquisaSatisfacaoViewSet, basename='sgq-pesquisas-satisfacao')
router.register('escopos-analise', EscopoAnaliseViewSet, basename='sgq-escopos-analise')
router.register('escopos-analise-opcoes', EscopoAnaliseOpcaoViewSet, basename='sgq-escopos-analise-opcoes')
router.register('documentos', DocumentoSGQViewSet, basename='sgq-documentos')
router.register('pastas', PastaMatrizSGQViewSet, basename='sgq-pastas-matriz')
router.register('auditorias', AuditoriaSGQViewSet, basename='sgq-auditorias')
router.register('normas', NormaSGQViewSet, basename='sgq-normas')
router.register('normas-itens', ItemNormaSGQViewSet, basename='sgq-normas-itens')
router.register('auditorias-categorias', CategoriaAuditoriaSGQViewSet, basename='sgq-auditorias-categorias')
router.register('auditorias-tipos-resposta', TipoRespostaSGQViewSet, basename='sgq-auditorias-tipos-resposta')

urlpatterns = [
    path('drive/status/', SGQDriveStatusView.as_view(), name='sgq-drive-status'),
    path('drive/browse/', SGQDriveBrowseView.as_view(), name='sgq-drive-browse'),
    path('', include(router.urls)),
]
