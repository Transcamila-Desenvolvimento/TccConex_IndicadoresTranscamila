import os

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'prothon.settings')

django_asgi_app = get_asgi_application()

from apps.marketing.ws_auth import JWTQueryAuthMiddleware  # noqa: E402
from prothon.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': JWTQueryAuthMiddleware(URLRouter(websocket_urlpatterns)),
})
