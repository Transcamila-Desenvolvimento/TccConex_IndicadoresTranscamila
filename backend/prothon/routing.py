from django.urls import path

from apps.marketing.consumers import MarketingPresenceConsumer

websocket_urlpatterns = [
    path('ws/marketing/presence/', MarketingPresenceConsumer.as_asgi()),
]
