from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AuditLogFacetsAPIView, AuditLogViewSet

router = DefaultRouter()
router.register('logs', AuditLogViewSet, basename='audit-log')

urlpatterns = [
    path('logs/facets/', AuditLogFacetsAPIView.as_view(), name='audit-log-facets'),
    path('', include(router.urls)),
]
