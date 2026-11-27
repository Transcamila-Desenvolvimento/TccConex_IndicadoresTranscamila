# Variáveis de ambiente

Valores secretos ficam no App Service e no `backend/.env` local. A tabela lista o nome e o efeito. O exemplo comentado está em `backend/.env.example`.

## Django e HTTP

| Variável | Efeito se definida | Se ausente |
|---|---|---|
| `DJANGO_SECRET_KEY` | chave do JWT e do Django | fallback fixo, impróprio para produção |
| `DJANGO_DEBUG` | `True` só se o valor for `True` | tratado como debug ligado |
| `DJANGO_ALLOWED_HOSTS` | lista separada por vírgula | `*` |
| `CORS_ALLOWED_ORIGINS` | lista; desliga CORS aberto | `CORS_ALLOW_ALL_ORIGINS` verdadeiro |
| `CSRF_TRUSTED_ORIGINS` | origens do admin | vazio, e o código acrescenta o hostname da Azure quando existe |
| `SECURE_SSL_REDIRECT` | com debug desligado | padrão `True` |
| `SECURE_HSTS_SECONDS` | com debug desligado | 2592000 |
| `DJANGO_MEDIA_ROOT` | pasta de upload | `backend/media` |
| `DATA_UPLOAD_MAX_MEMORY_SIZE` e `FILE_UPLOAD_MAX_MEMORY_SIZE` | limite de upload | 40 MB |

No App Service o código também honra `WEBSITE_HOSTNAME` e `WEBSITE_SITE_NAME` para host e CORS.

## Banco, fila e boot

| Variável | Efeito |
|---|---|
| `USE_POSTGRES` | `True` seleciona PostgreSQL |
| `DB_HOST` | presença também seleciona PostgreSQL, mesmo sem `USE_POSTGRES` |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT` | conexão. Padrões de código: `prothon_db`, `postgres`, `postgres`, `5432` |
| `DB_SSLMODE` | padrão `prefer` |
| `DB_CONNECT_TIMEOUT` | padrão 15 |
| `USE_CELERY` | `True` sobe o worker no `startup.sh` |
| `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND` | Redis |
| `USE_PRESENCE_REDIS`, `PRESENCE_REDIS_URL`, `CACHE_REDIS_URL` | presença e cache |
| `RUN_STARTUP_MIGRATE` | no script, valor diferente de `True` pula o `migrate` |
| `WEBSITES_PORT` | porta do Daphne, padrão 8000 |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `false` para não rebuildar no Oryx |
| `WEBSITES_CONTAINER_START_TIME_LIMIT` | tempo de boot. O script de garantia usa 1800 |

## Integrações

`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_OAUTH_HD`, `GOOGLE_MAPS_API_KEY`, `GOOGLE_CHAT_SERVICE_ACCOUNT_JSON`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TTS_MODEL`, `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL`, `FRONTEND_BASE_URL`, `PUBLIC_BASE_URL`, `WEBPUSH_VAPID_PUBLIC_KEY`, `WEBPUSH_VAPID_PRIVATE_KEY`, `WEBPUSH_VAPID_SUBJECT`.

Flags do SGQ: `SGQ_AUDITORIAS_LIBERADAS`, `SGQ_SIPOC_LIBERADO`.

Retenção de avisos: `NOTIFICACOES_RETER_LIDAS_DIAS` (30), `NOTIFICACOES_RETER_DIAS` (90), `NOTIFICACOES_MAX_POR_USUARIO` (200), `NOTIFICACOES_PUSH_RETER_DIAS` (90), `NOTIFICACOES_RECICLAGEM_INTERVALO_HORAS` (24).

JWT: `ACCESS_TOKEN_LIFETIME_MINUTES` (10080).

## Secret do GitHub

`AZURE_WEBAPP_PUBLISH_PROFILE`: conteúdo do perfil de publicação do App Service. Usado só pelo workflow de deploy. Não há outros secrets referenciados nos workflows.
