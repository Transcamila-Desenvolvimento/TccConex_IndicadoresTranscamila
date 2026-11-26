# Autenticação e erros

Fonte: `apps/accounts/authentication.py` e `REST_FRAMEWORK` em `prothon/settings.py`.

A autenticação padrão é `JWTAuthentication`. A permissão padrão é `IsAuthenticated`. View que não declara `permission_classes` exige usuário autenticado.

O header é `Authorization: Bearer <jwt>`. O token é assinado com `SECRET_KEY` (`DJANGO_SECRET_KEY`) e o algoritmo de `JWT_SETTINGS`, com fallback `HS256`. A vida do access token vem de `ACCESS_TOKEN_LIFETIME_MINUTES`, padrão 10080.

Payload com `tipo` igual a `motorista` não autentica nessa classe. O login de motorista está em `/api/frota/motoristas/login/`.

Sem `DJANGO_SECRET_KEY`, o settings usa um fallback fixo marcado no código como impróprio para produção.

`/health/` não passa por essa autenticação: a view só devolve `ok`.
