from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .drive_views import DriveBrowseView, DrivePreviewView, DriveStatusView, DriveThumbnailView
from .views import CampanhaMarketingViewSet

router = DefaultRouter()
router.register('campanhas', CampanhaMarketingViewSet, basename='marketing-campanhas')

urlpatterns = [
    path('drive/status/', DriveStatusView.as_view(), name='marketing-drive-status'),
    path('drive/browse/', DriveBrowseView.as_view(), name='marketing-drive-browse'),
    path('drive/thumbnail/', DriveThumbnailView.as_view(), name='marketing-drive-thumbnail'),
    path('drive/preview/', DrivePreviewView.as_view(), name='marketing-drive-preview'),
    path('', include(router.urls)),
]
