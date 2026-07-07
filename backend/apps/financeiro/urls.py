from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ActiveReportDataView,
    BalanceHistoryEntryViewSet,
    BankAccountViewSet,
    BankDataSyncView,
    BillingRecordViewSet,
    CashAdjustmentViewSet,
    PagarDiffAnalysisView,
    PrActionView,
    PrAnalysisView,
    ReportBatchViewSet,
    ReportFacetsView,
    CeleryTaskStatusView,
)

router = DefaultRouter()
router.register('batches', ReportBatchViewSet, basename='report-batches')
router.register('billing', BillingRecordViewSet, basename='billing')
router.register('adjustments', CashAdjustmentViewSet, basename='adjustments')
router.register('bank-accounts', BankAccountViewSet, basename='bank-accounts')
router.register('balance-history', BalanceHistoryEntryViewSet, basename='balance-history')

urlpatterns = [
    path('reports/pagar/', ActiveReportDataView.as_view(), {'report_type': 'pagar'}, name='reports-pagar'),
    path('reports/pagar/facets/', ReportFacetsView.as_view(), {'report_type': 'pagar'}, name='reports-pagar-facets'),
    path('reports/receber/', ActiveReportDataView.as_view(), {'report_type': 'receber'}, name='reports-receber'),
    path('reports/receber/facets/', ReportFacetsView.as_view(), {'report_type': 'receber'}, name='reports-receber-facets'),
    path('reports/aging/', ActiveReportDataView.as_view(), {'report_type': 'aging'}, name='reports-aging'),
    path('reports/aging/facets/', ReportFacetsView.as_view(), {'report_type': 'aging'}, name='reports-aging-facets'),
    path('reports/analise-prs/', PrAnalysisView.as_view(), name='reports-analise-prs'),
    path('reports/pagar/diff/', PagarDiffAnalysisView.as_view(), name='reports-pagar-diff'),
    path('reports/pr-action/', PrActionView.as_view(), name='reports-pr-action'),
    path('tasks/<str:task_id>/', CeleryTaskStatusView.as_view(), name='celery-task-status'),
    path('bank-data/sync/', BankDataSyncView.as_view(), name='bank-data-sync'),
    path('', include(router.urls)),
]
