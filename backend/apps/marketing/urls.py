from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CampanhaMarketingViewSet

router = DefaultRouter()
router.register('campanhas', CampanhaMarketingViewSet, basename='marketing-campanhas')

urlpatterns = [
    path('', include(router.urls)),
]
