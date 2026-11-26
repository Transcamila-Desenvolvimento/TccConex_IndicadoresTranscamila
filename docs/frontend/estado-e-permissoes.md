# Estado e permissões

O token fica só em `localStorage` (`prothon_token`). O perfil do usuário vem da API, não de um objeto completo gravado no navegador.

Chamadas passam por `frontend/src/services/apiService.ts`. O interceptor acrescenta:

- `Authorization: Bearer <token>`
- `X-Prothon-Environment`, com o valor codificado, quando há ambiente na sessão
- `X-Prothon-Filial`, quando há filial na sessão

Listas e formulários usam hooks em `frontend/src/hooks/` com TanStack Query. O padrão de tela para dados remotos é `QueryDataPanel` e `useAsyncQueryState`.

Ambientes sem filial obrigatória na sessão, no frontend (`GLOBAL_SESSION_ENVIRONMENTS`): Administração/Manutenção, Financeiro, Indicadores, Compras, RH, Faturamento, Marketing, Logística, Comercial, Suprimentos e CamiloIA.

No backend, `GLOBAL_ENVIRONMENTS` não inclui Indicadores. As views de indicadores lidas declaram `permission_requires_filial = False`. SGQ e Frota exigem filial na sessão dos dois lados.

Abas e funções visíveis dependem dos campos do usuário descritos em [Usuários e perfis](../introducao/usuarios-e-perfis.md). A lista completa de chaves de aba está em `frontend/src/constants/abas.ts` e nas constantes do backend. Esta página não duplica esse catálogo.
