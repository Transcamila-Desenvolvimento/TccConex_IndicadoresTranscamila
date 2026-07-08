import os
from pathlib import Path
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env file if present (dev only — production uses real env vars)
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-fallback-nao-usar-em-producao')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get('DJANGO_DEBUG', 'True') == 'True'

# Produção: definir DJANGO_ALLOWED_HOSTS com os domínios reais (separados por vírgula).
# Sem a variável, cai no fallback permissivo (uso só em dev).
_allowed_hosts_env = os.environ.get('DJANGO_ALLOWED_HOSTS', '')
ALLOWED_HOSTS = [h.strip() for h in _allowed_hosts_env.split(',') if h.strip()] or ['*']

# App Service: hostname real + subdomínios .azurewebsites.net
_website_hostname = os.environ.get('WEBSITE_HOSTNAME', '')
if _website_hostname and _website_hostname not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(_website_hostname)
if os.environ.get('WEBSITE_SITE_NAME') and '.azurewebsites.net' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('.azurewebsites.net')

# App Service (e a maioria dos PaaS) fica atrás de um proxy que termina o TLS;
# sem isso, request.is_secure() e os redirects de segurança ficam incorretos.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

if not DEBUG:
    SECURE_SSL_REDIRECT = os.environ.get('SECURE_SSL_REDIRECT', 'True') == 'True'
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.environ.get('SECURE_HSTS_SECONDS', '2592000'))  # 30 dias
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party packages
    'rest_framework',
    'corsheaders',
    
    # Prothon apps
    'apps.accounts',
    'apps.financeiro',
    'apps.indicadores',
    'apps.filesystem',
    'apps.audit',
    'apps.rh',
    'apps.compras',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # CorsMiddleware must be as high as possible
    'prothon.middleware.azure_health_host.AzureHealthHostMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # serve estáticos/SPA em produção
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'prothon.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'prothon.wsgi.application'
ASGI_APPLICATION = 'prothon.asgi.application'

# Database
# Connects to PostgreSQL if env variables are provided, otherwise falls back to SQLite
DB_NAME = os.environ.get('DB_NAME', 'prothon_db')
DB_USER = os.environ.get('DB_USER', 'postgres')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'postgres')
DB_HOST = os.environ.get('DB_HOST', 'localhost')
DB_PORT = os.environ.get('DB_PORT', '5432')

if os.environ.get('USE_POSTGRES') == 'True' or 'DB_HOST' in os.environ:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': DB_NAME,
            'USER': DB_USER,
            'PASSWORD': DB_PASSWORD,
            'HOST': DB_HOST,
            'PORT': DB_PORT,
            # Azure Database for PostgreSQL exige SSL; 'prefer' negocia SSL quando
            # disponível sem quebrar um Postgres local sem TLS configurado.
            'OPTIONS': {
                'sslmode': os.environ.get('DB_SSLMODE', 'prefer'),
                # Evita boot travado minutos se o Postgres estiver inacessível.
                'connect_timeout': int(os.environ.get('DB_CONNECT_TIMEOUT', '15')),
            },
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Custom User Model
AUTH_USER_MODEL = 'accounts.CustomUser'

# Rest Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'apps.accounts.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

# CORS configuration
# Produção: definir CORS_ALLOWED_ORIGINS (separado por vírgula) com o(s) domínio(s) do frontend.
# Sem a variável, mantém o comportamento permissivo atual (uso só em dev).
_cors_origins_env = os.environ.get('CORS_ALLOWED_ORIGINS', '')
if _cors_origins_env:
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_origins_env.split(',') if o.strip()]
else:
    CORS_ALLOW_ALL_ORIGINS = True

# Necessário para o Django aceitar POSTs (ex.: /admin/) atrás de um domínio HTTPS do App Service.
_csrf_trusted_env = os.environ.get('CSRF_TRUSTED_ORIGINS', '')
CSRF_TRUSTED_ORIGINS = [o.strip() for o in _csrf_trusted_env.split(',') if o.strip()]

# Internationalization
LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Build do React. Quando existir, o WhiteNoise serve os arquivos (index.html,
# assets/*) diretamente na raiz do domínio — ver prothon/urls.py para o fallback
# de SPA (React Router) e apps/rh para uploads em MEDIA_ROOT.
# Em dev, o build fica em frontend/dist (sibling de backend/). No pacote de deploy
# (ver .github/workflows/deploy-azure.yml), o build é copiado para backend/frontend_dist/
# para que o zip enviado ao App Service tenha requirements.txt/manage.py na raiz.
FRONTEND_DIST_DIR = BASE_DIR / 'frontend_dist'
if not FRONTEND_DIST_DIR.exists():
    FRONTEND_DIST_DIR = BASE_DIR.parent / 'frontend' / 'dist'
if FRONTEND_DIST_DIR.exists():
    WHITENOISE_ROOT = FRONTEND_DIST_DIR

STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}

# Media (uploads do usuário, ex.: apps.rh.MovimentacaoLote.arquivo)
MEDIA_URL = '/media/'
MEDIA_ROOT = Path(os.environ.get('DJANGO_MEDIA_ROOT', BASE_DIR / 'media'))

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# JWT Configuration
JWT_SETTINGS = {
    'ACCESS_TOKEN_LIFETIME_MINUTES': int(os.environ.get('ACCESS_TOKEN_LIFETIME_MINUTES', '480')),
    'ALGORITHM': 'HS256',
}

# Celery + Redis (importações assíncronas)
USE_CELERY = os.environ.get('USE_CELERY', 'False') == 'True'
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', CELERY_BROKER_URL)
CELERY_TASK_TRACK_STARTED = True
CELERY_RESULT_EXTENDED = True
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE

# E-mail (dev: console; produção: SMTP via .env)
EMAIL_BACKEND = os.environ.get(
    'EMAIL_BACKEND',
    'django.core.mail.backends.console.EmailBackend',
)
EMAIL_HOST = os.environ.get('EMAIL_HOST', '')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True') == 'True'
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'digitalmidia@transcamila.com.br')
FRONTEND_BASE_URL = os.environ.get('FRONTEND_BASE_URL', 'http://localhost:5173')

GOOGLE_OAUTH_CLIENT_ID = os.environ.get('GOOGLE_OAUTH_CLIENT_ID', '')
GOOGLE_OAUTH_CLIENT_SECRET = os.environ.get('GOOGLE_OAUTH_CLIENT_SECRET', '')
GOOGLE_OAUTH_REDIRECT_URI = os.environ.get(
    'GOOGLE_OAUTH_REDIRECT_URI',
    f'{FRONTEND_BASE_URL.rstrip("/")}/auth/google/callback',
)
GOOGLE_OAUTH_HD = os.environ.get('GOOGLE_OAUTH_HD', 'transcamila.com.br')

