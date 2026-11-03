from django.urls import path

from apps.accounts.consumers import SessionPresenceConsumer
from apps.marketing.consumers import MarketingPresenceConsumer
from apps.sgq.consumers import AuditoriaPresencaConsumer

websocket_urlpatterns = [
    path('ws/presence/', SessionPresenceConsumer.as_asgi()),
    path('ws/marketing/presence/', MarketingPresenceConsumer.as_asgi()),
    path('ws/sgq/auditorias/<int:auditoria_id>/presence/', AuditoriaPresencaConsumer.as_asgi()),
]
