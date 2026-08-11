from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    InstagramConnectionCallbackView,
    InstagramConnectionDisconnectView,
    InstagramConnectionLinkView,
    InstagramConnectionView,
    InstagramPostViewSet,
)

router = DefaultRouter()
router.register('instagram-posts', InstagramPostViewSet, basename='marketing-instagram-posts')

urlpatterns = [
    path('instagram/connection/', InstagramConnectionView.as_view(), name='marketing-instagram-connection'),
    path('instagram/connection/link/', InstagramConnectionLinkView.as_view(), name='marketing-instagram-link'),
    path('instagram/connection/callback/', InstagramConnectionCallbackView.as_view(), name='marketing-instagram-callback'),
    path('instagram/connection/disconnect/', InstagramConnectionDisconnectView.as_view(), name='marketing-instagram-disconnect'),
    path('', include(router.urls)),
]
