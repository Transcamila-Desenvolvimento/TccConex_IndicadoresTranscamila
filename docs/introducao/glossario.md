# Glossário

Termos como aparecem no código.

| Termo | Significado no repositório |
|---|---|
| Ambiente | Módulo de trabalho escolhido na sessão, por exemplo `Financeiro` ou `SGQ` |
| Filial | Unidade operacional. Nomes canônicos em `ALL_BRANCHES` |
| `permission_module` | Ambiente que a view exige |
| `X-Prothon-Environment` | Header com o ambiente da sessão |
| `X-Prothon-Filial` | Header com a filial da sessão |
| Papel | `role_id` `1` (admin) ou `2` (operador) |
| Função | Capacidade extra do operador, em `CustomUser.funcoes` |
| Aba | Item de menu liberável em `CustomUser.abas` |
| Prothon | Nome do projeto Django (`backend/prothon`) |
| CamiloIA | Ambiente do agente. Código `11` |
| Suprimentos | Ambiente `12`. Permissão usada pelas views de estoque e uniforme |
| App Service | `tccconex-erp`, onde o workflow publica o ERP |
| `main` | Branch publicada. Push nela dispara o deploy |

Siglas de negócio que não aparecem no código: **não documentado**.
