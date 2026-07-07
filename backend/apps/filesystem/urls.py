from django.urls import path

from .views import HomeDirAPIView, ListDirectoryAPIView, WriteFileAPIView

urlpatterns = [
    path('homedir', HomeDirAPIView.as_view(), name='fs-homedir'),
    path('list', ListDirectoryAPIView.as_view(), name='fs-list'),
    path('write', WriteFileAPIView.as_view(), name='fs-write'),
]
