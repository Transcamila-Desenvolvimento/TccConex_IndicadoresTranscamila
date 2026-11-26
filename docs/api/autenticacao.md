# Autenticação e usuários

Prefixo `/api/auth/`. Arquivo: `backend/apps/accounts/urls.py`.

Cabeçalhos comuns, quando a view exige login: `Authorization: Bearer <jwt>`. Login é público (`AllowAny`).

## POST `/api/auth/login/`

View: `LoginAPIView`. Corpo em `LoginSerializer`: `username` e `password`, ambos obrigatórios. A senha é só de escrita.

| Situação no código | HTTP |
|---|---|
| Serializer inválido | 400, com os erros do serializer |
| Usuário inexistente ou senha incorreta | 401, `detail`: `Nome de usuário ou senha incorretos.` |
| `status` diferente de `ativo` | 403, `detail`: `Este usuário foi desativado pela administração.` |
| Sucesso | 200, `token` e `user` |

O token é JWT HS256. O payload leva `user_id`, `username`, `name`, `role_id` e `exp`. A duração vem de `ACCESS_TOKEN_LIFETIME_MINUTES` (padrão no settings: 10080). A chave de assinatura é `DJANGO_SECRET_KEY`. Não há refresh token neste método.

`user` sai de `UserSerializer`: `id`, `username`, `name`, `cargo`, `telefone`, `cpf`, `roleId`, `status`, `environments`, `filiais`, `indicadores`, `indicadorFiliais`, `funcoes`, `funcaoFiliais`, `abas`, `abaFiliais`, `lastLogin`, `googleEmail`, `googleLinkedAt`, `googlePicture`, `mustChangePassword`, e ainda `sgqAuditoriasLiberadas` e `sgqSipocLiberado` acrescentados na representação.

Exemplo do corpo, sem valores reais:

```json
{ "username": "operador", "password": "senha" }
```

## Perfil e senha

| Método e caminho | View | Auth | O que o código faz |
|---|---|---|---|
| `GET profile/` | `UserProfileAPIView` | autenticado | Devolve `UserSerializer` do usuário do token |
| `POST profile/change-password/` | `ChangePasswordAPIView` | autenticado | Troca a senha. Campos no serializer de troca |
| `POST profile/google/link/` | `GoogleLinkAPIView` | autenticado | Inicia o vínculo Google |
| `GET profile/google/callback/` | `GoogleCallbackAPIView` | autenticado | Troca o código e grava e-mail, `sub`, data, token e foto |
| `POST profile/google/unlink/` | `GoogleUnlinkAPIView` | autenticado | Zera o vínculo Google |
| `GET google/contacts/` | `GoogleContactsAPIView` | autenticado | Lista contatos da conta Google vinculada |
| `GET users/directory/` | `UserDirectoryAPIView` | autenticado | Diretório com `UserDirectorySerializer` |

O corpo exato da troca de senha e do callback Google fica nos serializers e nas views correspondentes. Esta página não copia o fluxo OAuth inteiro.

## Recursos do router

| Recurso | ViewSet | Métodos do `ModelViewSet` |
|---|---|---|
| `roles/` | `RoleViewSet` | lista, criação, detalhe, atualização e exclusão, salvo restrição dentro da view |
| `users/` | `UserManagementViewSet` | o mesmo, com serializer de criação e de edição em `get_serializer_class` |

Ações extras em `apps/accounts/views.py`: `users/indicador-filiais-opcoes/` e, no detalhe do usuário, `force-password-change/`. Outra ação `POST` no detalhe não declara `url_path`; o DRF usa o nome do método.

Permissão de administração: `role_id` `1` é administrador (`CustomUser.is_admin`). Criar usuário operador grava `must_change_password` verdadeiro no serializer de criação.
