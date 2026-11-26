# Módulos

Fonte dos apps: `INSTALLED_APPS` em `backend/prothon/settings.py`. Fonte dos ambientes: `ACTIVE_ENVIRONMENTS` em `backend/apps/accounts/constants.py` e `frontend/src/constants/environments.ts`.

## Apps Django

| App | Papel visto no código |
|---|---|
| `accounts` | Usuários, papéis, login JWT, vínculo Google |
| `financeiro` | Lotes de relatório, contas a pagar e receber, aging, faturamento importado, caixa, saldos, calendário |
| `indicadores` | KPIs, fluxo de caixa gerencial e leituras de outros módulos |
| `filesystem` | Listar e gravar arquivos em `/api/fs/` |
| `audit` | Log de ações |
| `rh` | Quadro, movimentações, PJ, documentos |
| `compras` | Estoque e uniformes. As views lidas usam a permissão `Suprimentos` |
| `faturamento` | Protocolos de envio e notas de débito |
| `sgq` | Pesquisas, auditorias, normas, SIPOC, documentos |
| `marketing` | Campanhas |
| `logistica` | Resumo e meta de faturamento |
| `frota` | Olho vivo, motoristas e desempenho |
| `comercial` | Clientes, propostas, tabela de frete, mapas |
| `notificacoes` | Avisos e Web Push |
| `camilo` | Agentes, chat, termos e matriz empresarial |

Não existe app Django `suprimentos`. Suprimentos é ambiente e `permission_module`.

## Ambientes na interface

Administração/Manutenção, Indicadores, Financeiro, Compras, RH, Faturamento, SGQ, Marketing, Logística, Frota, Comercial, CamiloIA e Suprimentos.

Códigos em `ENVIRONMENT_CODES`: 00 a 12, nessa ordem.

Filiais operacionais em `ALL_BRANCHES`: Ibiporã (Matriz), Rondonópolis e Paranaguá. SGQ e Frota usam só Ibiporã e Rondonópolis. O quadro de funcionários inclui também Porto Alegre (`FILIAIS_QUADRO`).
