from django.urls import path

from .desempenho_views import (
    ApuracaoDesempenhoView,
    ExtratoBonificacaoView,
    CriterioDesempenhoItemView,
    CriteriosDesempenhoView,
    GrupoDesempenhoView,
    MotoristaDesempenhoView,
    OcorrenciaDesempenhoItemView,
    OcorrenciasDesempenhoView,
    ParametrosDesempenhoView,
)
from .motorista_views import (
    MotoristaEuView,
    MotoristaLoginView,
    MotoristasElegiveisView,
    UsuarioMotoristaExcluirView,
    UsuarioMotoristaSenhaView,
    UsuariosMotoristaView,
)
from .olho_vivo_views import OlhoVivoView

urlpatterns = [
    path('olho-vivo/', OlhoVivoView.as_view(), name='frota-olho-vivo'),
    path('motoristas/login/', MotoristaLoginView.as_view(), name='frota-motoristas-login'),
    path('motoristas/eu/', MotoristaEuView.as_view(), name='frota-motoristas-eu'),
    path('motoristas/elegiveis/', MotoristasElegiveisView.as_view(), name='frota-motoristas-elegiveis'),
    path('motoristas/usuarios/', UsuariosMotoristaView.as_view(), name='frota-motoristas-usuarios'),
    path('motoristas/usuarios/<int:pk>/senha/', UsuarioMotoristaSenhaView.as_view(), name='frota-motorista-senha'),
    path('motoristas/usuarios/<int:pk>/', UsuarioMotoristaExcluirView.as_view(), name='frota-motorista-excluir'),
    path('motoristas/desempenho/', MotoristaDesempenhoView.as_view(), name='frota-motorista-desempenho'),
    path('desempenho/parametros/', ParametrosDesempenhoView.as_view(), name='frota-desempenho-parametros'),
    path('desempenho/criterios/', CriteriosDesempenhoView.as_view(), name='frota-desempenho-criterios'),
    path('desempenho/grupos/', GrupoDesempenhoView.as_view(), name='frota-desempenho-grupo-criar'),
    path('desempenho/grupos/<int:pk>/', GrupoDesempenhoView.as_view(), name='frota-desempenho-grupo'),
    path('desempenho/criterios/itens/', CriterioDesempenhoItemView.as_view(), name='frota-desempenho-criterio-criar'),
    path('desempenho/criterios/itens/<int:pk>/', CriterioDesempenhoItemView.as_view(), name='frota-desempenho-criterio'),
    path('desempenho/apuracao/', ApuracaoDesempenhoView.as_view(), name='frota-desempenho-apuracao'),
    path('desempenho/extrato/', ExtratoBonificacaoView.as_view(), name='frota-desempenho-extrato'),
    path('desempenho/ocorrencias/', OcorrenciasDesempenhoView.as_view(), name='frota-desempenho-ocorrencias'),
    path('desempenho/ocorrencias/<int:pk>/', OcorrenciaDesempenhoItemView.as_view(), name='frota-desempenho-ocorrencia'),
]
