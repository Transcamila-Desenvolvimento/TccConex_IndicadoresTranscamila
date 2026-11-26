# Fluxo de dados

1. O usuário autentica em `POST /api/auth/login/`. O frontend guarda o JWT em `localStorage`, chave `prothon_token`.
2. O Axios envia `Authorization: Bearer <token>` e, quando há sessão, `X-Prothon-Environment` e `X-Prothon-Filial`.
3. `JWTAuthentication` valida o token com `DJANGO_SECRET_KEY`. Token de motorista (`tipo` igual a `motorista`) não autentica por essa classe.
4. `ModuleAccessPermission` compara o header de ambiente com `permission_module` da view e, quando o módulo exige filial, o header de filial.
5. A view lê ou grava models Django. Em produção a conexão é PostgreSQL. Uploads vão para `MEDIA_ROOT`.
6. Importações longas do financeiro usam Celery quando `USE_CELERY=True`. Sem isso, rodam na requisição. O status fica em `GET /api/financeiro/tasks/<task_id>/`.

Presença em tempo real usa Channels. O canal Redis depende de `USE_PRESENCE_REDIS`, `PRESENCE_REDIS_URL` ou do broker do Celery. Sem Redis, o código cai em memória local. O detalhe de cada consumer: ver `prothon/asgi.py` e o app de contas. Mapa completo dos eventos de WebSocket: **não identificado** nesta página.
