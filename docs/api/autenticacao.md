# Autenticação e usuários

Prefixo `/api/auth/`. Arquivo: `backend/apps/accounts/urls.py`.

| Método e caminho | Função no código |
|---|---|
| `POST login/` | Login e emissão do JWT |
| `GET profile/` | Perfil do usuário autenticado |
| `POST profile/change-password/` | Troca de senha |
| `POST profile/google/link/` | Inicia vínculo Google |
| `GET profile/google/callback/` | Retorno do vínculo. O nome da view é `GoogleCallbackAPIView` |
| `POST profile/google/unlink/` | Remove o vínculo |
| `GET google/contacts/` | Contatos Google |
| `GET users/directory/` | Diretório de usuários |

Recursos do router:

| Recurso | ViewSet |
|---|---|
| `roles/` | `RoleViewSet` |
| `users/` | `UserManagementViewSet` |

Ações extras vistas em `apps/accounts/views.py`: `users/indicador-filiais-opcoes/` e, no detalhe do usuário, `force-password-change/` mais outra ação `POST` cujo `url_path` não foi nomeado no decorador (o DRF usa o nome do método).

Corpo do login e o formato exato do JWT de resposta: ver `LoginAPIView` e o ponto que assina o token. Não há exemplo estável versionado fora do código.
