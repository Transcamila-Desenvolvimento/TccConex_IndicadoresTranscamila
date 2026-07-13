from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse, HttpResponseNotFound
from django.urls import include, path, re_path
from django.views.static import serve as static_serve


def health_check(_request):
    return HttpResponse('ok', content_type='text/plain')


urlpatterns = [
    path('health/', health_check),
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/financeiro/', include('apps.financeiro.urls')),
    path('api/indicadores/', include('apps.indicadores.urls')),
    path('api/fs/', include('apps.filesystem.urls')),
    path('api/audit/', include('apps.audit.urls')),
    path('api/rh/', include('apps.rh.urls')),
    path('api/compras/', include('apps.compras.urls')),
    path('api/faturamento/', include('apps.faturamento.urls')),
    # Uploads (ex.: apps.rh.MovimentacaoLote.arquivo) — serve mesmo com DEBUG=False.
    re_path(r'^media/(?P<path>.*)$', static_serve, {'document_root': settings.MEDIA_ROOT}),
]


def spa_index(request, *args, **kwargs):
    """Fallback de SPA: devolve o index.html do build do React para as rotas
    do React Router (ex.: /financeiro/reports). Não afeta /api/, /admin/, /media/
    ou /assets/, que são resolvidas pelas rotas acima antes desta."""
    index_path = settings.FRONTEND_DIST_DIR / 'index.html'
    if not index_path.exists():
        return HttpResponseNotFound(
            'Build do frontend não encontrado. Rode `npm run build` em frontend/.'
        )
    return HttpResponse(index_path.read_text(encoding='utf-8'))


urlpatterns += [
    re_path(
        r'^assets/(?P<path>.*)$',
        static_serve,
        {'document_root': settings.FRONTEND_DIST_DIR / 'assets'},
    ),
    re_path(r'^(?!api/|admin/|media/|static/|assets/).*$', spa_index),
]
