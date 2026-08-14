from django.urls import path

from .views import LogisticaSummaryView, MetaFaturamentoConfigView

urlpatterns = [
    path('summary/', LogisticaSummaryView.as_view(), name='logistica-summary'),
    path('metas-faturamento/', MetaFaturamentoConfigView.as_view(), name='logistica-metas-faturamento'),
]
