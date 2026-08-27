from django.urls import path

from .views import FrotaSummaryView

urlpatterns = [
    path('summary/', FrotaSummaryView.as_view(), name='frota-summary'),
]
