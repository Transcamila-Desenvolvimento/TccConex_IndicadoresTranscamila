from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .matriz_views import (
    DocumentoMatrizEmpresarialViewSet,
    MatrizEmpresarialDriveBrowseView,
    MatrizEmpresarialDriveStatusView,
    PastaMatrizEmpresarialViewSet,
)
from .views import (
    AgenteConsultarView,
    AgenteDetailView,
    AgenteListCreateView,
    CamiloConversarView,
    ChatPadraoView,
    MeuTermoView,
    PartesDisponiveisView,
    TermoComprovanteView,
    TermoVigenteView,
    TermosAceitosView,
)

router = DefaultRouter()
router.register('matriz-empresarial/documentos', DocumentoMatrizEmpresarialViewSet, basename='camilo-matriz-documentos')
router.register('matriz-empresarial/pastas', PastaMatrizEmpresarialViewSet, basename='camilo-matriz-pastas')

urlpatterns = [
    path('conversar/', CamiloConversarView.as_view(), name='camilo-conversar'),
    path('chat-padrao/', ChatPadraoView.as_view(), name='camilo-chat-padrao'),
    path('termo/', MeuTermoView.as_view(), name='camilo-termo'),
    path('termos/', TermosAceitosView.as_view(), name='camilo-termos'),
    path('termos/vigente/', TermoVigenteView.as_view(), name='camilo-termo-vigente'),
    path('termos/<uuid:aceite_id>/comprovante/', TermoComprovanteView.as_view(), name='camilo-termo-comprovante'),
    path('partes/', PartesDisponiveisView.as_view(), name='camilo-partes'),
    path('agentes/', AgenteListCreateView.as_view(), name='camilo-agentes'),
    path('agentes/<uuid:agente_id>/', AgenteDetailView.as_view(), name='camilo-agente'),
    path('agentes/<uuid:agente_id>/consultar/', AgenteConsultarView.as_view(), name='camilo-agente-consultar'),
    path('matriz-empresarial/drive/status/', MatrizEmpresarialDriveStatusView.as_view(), name='camilo-matriz-drive-status'),
    path('matriz-empresarial/drive/browse/', MatrizEmpresarialDriveBrowseView.as_view(), name='camilo-matriz-drive-browse'),
    path('', include(router.urls)),
]
