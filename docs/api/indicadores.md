# Indicadores

Prefixo `/api/indicadores/`. Arquivo: `backend/apps/indicadores/urls.py`.

| Caminho | View |
|---|---|
| `fluxo-caixa/` | Fluxo de caixa |
| `fluxo-caixa/dia/` | Detalhe do dia |
| `fluxo-caixa/atividade/` | Atividade |
| `fluxo-caixa/enviar-gerencial/` | Envio do gerencial |
| `rh/movimentacao/` e `rh/movimentacao/exportar/` | Indicador de movimentação de RH |
| `logistica/meta-faturamento/` | Meta de faturamento |
| `frota/olho-vivo/` | Olho vivo |
| `sgq/satisfacao/`, `sgq/satisfacao/detalhes/` e `sgq/satisfacao/atividade/` | Satisfação do SGQ |

Recursos do router: `kpis/` e `filiais/`.

As views de indicadores lidas em `apps/indicadores/views.py` usam `permission_module = 'Indicadores'` e `permission_requires_filial = False`. Há view de fluxo de caixa com `permission_module = 'Financeiro'`.

O cálculo de cada indicador está na view citada. Meta numérica de negócio que não esteja no código: **não documentado**.
