# Estrutura e rotas

Fonte: `frontend/src/routes/AppRoutes.tsx`. A interface usa React Router. Workspaces carregam com lazy loading.

## Rotas públicas e de sessão

| Caminho | Tela |
|---|---|
| `/login` | Login |
| `/change-password` | Troca de senha. Exige autenticação e não bloqueia quem ainda precisa trocar a senha |
| `/auth/google/callback` | Retorno do Google. Exige autenticação |
| `/select-environment` | Escolha de ambiente e filial |
| `/consulta-ca` | Consulta CAEPI. Exige autenticação |
| `/notificacao/:id` | Abre um aviso. Exige autenticação |

## Área autenticada

`/` exige login, senha já trocada e ambiente selecionado. Se o ambiente exige filial e a filial da sessão não está em `branchesForModule`, a rota volta para `/select-environment`.

| Caminho | Workspace |
|---|---|
| `/` | Redireciona para a home do ambiente selecionado |
| `/admin/*` | Administração |
| `/financeiro/*` | Financeiro |
| `/relatorios` | Relatórios |
| `/indicadores/*` | Indicadores |
| `/compras/*` | Compras |
| `/rh/*` | RH |
| `/faturamento/*` | Faturamento |
| `/sgq/*` | SGQ |
| `/marketing/*` | Marketing |
| `/logistica/*` | Logística |
| `/frota/*` | Frota |
| `/comercial/*` | Comercial |
| `/suprimentos/*` | Suprimentos |
| `/agente-camilo/*` | CamiloIA |

Caminho desconhecido dentro da área volta para `/`. Fora dela, volta para `/login`.

O dev local sobe o Vite na porta 5173 e o Django na porta 8001 (`start.ps1`). Em produção o mesmo host serve a interface e a API.
