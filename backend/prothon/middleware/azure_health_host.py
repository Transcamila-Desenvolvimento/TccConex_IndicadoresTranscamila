"""Middleware para sondas internas do Azure App Service (Host 169.254.x.x)."""
import os


class AzureHealthHostMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.site_hostname = os.environ.get('WEBSITE_HOSTNAME', '')

    def __call__(self, request):
        host = request.META.get('HTTP_HOST', '')
        if self.site_hostname and host.split(':')[0].startswith('169.254.'):
            port = host.split(':')[1] if ':' in host else ''
            request.META['HTTP_HOST'] = (
                f'{self.site_hostname}:{port}' if port else self.site_hostname
            )
        return self.get_response(request)
