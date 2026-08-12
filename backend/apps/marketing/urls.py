from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .drive_views import DriveBankConfigView, DriveBankListView, DriveBankThumbnailView
from .views import CampanhaMarketingViewSet

router = DefaultRouter()
router.register('campanhas', CampanhaMarketingViewSet, basename='marketing-campanhas')

urlpatterns = [
    path('drive-bank/config/', DriveBankConfigView.as_view(), name='marketing-drive-bank-config'),
    path('drive-bank/files/', DriveBankListView.as_view(), name='marketing-drive-bank-files'),
    path('drive-bank/thumbnail/', DriveBankThumbnailView.as_view(), name='marketing-drive-bank-thumbnail'),
    path('', include(router.urls)),
]
