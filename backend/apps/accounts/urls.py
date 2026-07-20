from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ChangePasswordAPIView,
    GoogleCallbackAPIView,
    GoogleContactsAPIView,
    GoogleLinkAPIView,
    GoogleUnlinkAPIView,
    LoginAPIView,
    RoleViewSet,
    UserManagementViewSet,
    UserProfileAPIView,
)

router = DefaultRouter()
router.register('roles', RoleViewSet, basename='role')
router.register('users', UserManagementViewSet, basename='user-management')

urlpatterns = [
    path('login/', LoginAPIView.as_view(), name='auth-login'),
    path('profile/', UserProfileAPIView.as_view(), name='auth-profile'),
    path('profile/change-password/', ChangePasswordAPIView.as_view(), name='auth-change-password'),
    path('profile/google/link/', GoogleLinkAPIView.as_view(), name='auth-google-link'),
    path('profile/google/callback/', GoogleCallbackAPIView.as_view(), name='auth-google-callback'),
    path('profile/google/unlink/', GoogleUnlinkAPIView.as_view(), name='auth-google-unlink'),
    path('google/contacts/', GoogleContactsAPIView.as_view(), name='auth-google-contacts'),
    path('', include(router.urls)),
]
