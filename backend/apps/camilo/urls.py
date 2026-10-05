from django.urls import path

from .views import (
    AgenteConsultarView,
    AgenteDetailView,
    AgenteListCreateView,
    CamiloConversarView,
    PartesDisponiveisView,
)

urlpatterns = [
    path('conversar/', CamiloConversarView.as_view(), name='camilo-conversar'),
    path('partes/', PartesDisponiveisView.as_view(), name='camilo-partes'),
    path('agentes/', AgenteListCreateView.as_view(), name='camilo-agentes'),
    path('agentes/<uuid:agente_id>/', AgenteDetailView.as_view(), name='camilo-agente'),
    path('agentes/<uuid:agente_id>/consultar/', AgenteConsultarView.as_view(), name='camilo-agente-consultar'),
]
