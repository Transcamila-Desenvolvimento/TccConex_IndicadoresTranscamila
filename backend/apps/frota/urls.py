from django.urls import path

from .olho_vivo_views import OlhoVivoView

urlpatterns = [
    path('olho-vivo/', OlhoVivoView.as_view(), name='frota-olho-vivo'),
]
