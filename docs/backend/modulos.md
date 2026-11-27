# Módulos do backend

Cada domínio fica em `backend/apps/<nome>/`. A rota entra em `backend/prothon/urls.py`. A view de negócio usa `ModuleAccessPermission` quando define `permission_module`.

| Prefixo HTTP | App | Arquivo de rotas |
|---|---|---|
| `/api/auth/` | accounts | `apps/accounts/urls.py` |
| `/api/financeiro/` | financeiro | `apps/financeiro/urls.py` |
| `/api/indicadores/` | indicadores | `apps/indicadores/urls.py` |
| `/api/fs/` | filesystem | `apps/filesystem/urls.py` |
| `/api/audit/` | audit | `apps/audit/urls.py` |
| `/api/rh/` | rh | `apps/rh/urls.py` |
| `/api/compras/` | compras | `apps/compras/urls.py` |
| `/api/caepi/` | compras | `ConsultaCaepiView` |
| `/api/faturamento/` | faturamento | `apps/faturamento/urls.py` |
| `/api/sgq/` | sgq | `apps/sgq/urls.py` |
| `/api/marketing/` | marketing | `apps/marketing/urls.py` |
| `/api/logistica/` | logistica | `apps/logistica/urls.py` |
| `/api/frota/` | frota | `apps/frota/urls.py` |
| `/api/comercial/` | comercial | `apps/comercial/urls.py` |
| `/api/notificacoes/` | notificacoes | `apps/notificacoes/urls.py` |
| `/api/camilo/` | camilo | `apps/camilo/urls.py` |

Fora da API: `/health/` devolve o texto `ok`, `/admin/` é o admin do Django e `/media/` serve `MEDIA_ROOT`.

## Responsabilidade

A regra de acesso, o filtro por filial e a validação de entrada ficam nas views, serializers e services do app. O frontend envia a sessão e apresenta o retorno. Não há camada de mock ativa para esses domínios no código atual.

## Tratamento de erro

Autenticação JWT devolve falha do DRF com as mensagens de token expirado, token inválido, usuário ausente ou usuário inativo. Permissão de módulo negada usa a mensagem `Acesso negado ao módulo ou filial selecionada.` Rotina sem filial permitida usa `Sem acesso a esta rotina nesta filial.` Os demais códigos HTTP seguem o DRF de cada view. Catálogo único de erros de negócio: **não identificado**.
