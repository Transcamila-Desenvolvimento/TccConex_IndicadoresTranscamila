# Indicadores

Prefixo `/api/indicadores/`. Arquivo: `backend/apps/indicadores/urls.py`.

Cabeçalho autenticado: `Authorization: Bearer <jwt>` e `X-Prothon-Environment`. As views de indicador usam `permission_module = 'Indicadores'` e `permission_requires_filial = False`. Indicadores não está em `GLOBAL_ENVIRONMENTS`; a isenção de filial está na própria view.

`POST fluxo-caixa/enviar-gerencial/` é a exceção: `permission_module = 'Financeiro'`.

Consulta inválida nas views que capturam `ValueError` responde 400 com `detail`.

## Consultas

| Método | Caminho | View |
|---|---|---|
| GET | `fluxo-caixa/` | `CashFlowView` |
| GET | `fluxo-caixa/dia/` | `CashFlowDayDetailView` |
| GET | `fluxo-caixa/atividade/` | `CashFlowActivityView` |
| POST | `fluxo-caixa/enviar-gerencial/` | `SendGerencialEmailView` |
| GET | `rh/movimentacao/` | `RHMovimentacaoIndicadorView` |
| GET | `rh/movimentacao/exportar/` | `RHMovimentacaoExportView` |
| GET | `logistica/meta-faturamento/` | `MetaFaturamentoIndicadorView` |
| GET | `frota/olho-vivo/` | `OlhoVivoIndicadorView` |
| GET | `sgq/satisfacao/` | `SgqSatisfacaoIndicadorView` |
| GET | `sgq/satisfacao/detalhes/` | `SgqSatisfacaoDetalhesView`, paginação `ReportPagination` |
| GET | `sgq/satisfacao/atividade/` | `SgqSatisfacaoActivityView` |

`GET logistica/meta-faturamento/` monta o realizado a partir de `BillingRecord` e a meta a partir de `MetaFaturamentoMensal`. A gravação da meta não está neste caminho. Ela fica em `PUT /api/logistica/metas-faturamento/`.

## Recursos somente leitura

| Recurso | ViewSet |
|---|---|
| `kpis/` | `IndicadorKpiViewSet`, `ReadOnlyModelViewSet` |
| `filiais/` | `IndicadorFilialViewSet`, `ReadOnlyModelViewSet` |

Os dois também usam `permission_module = 'Indicadores'`. Não foi lido `permission_requires_filial = False` nesses ViewSets. Como Indicadores não é ambiente global, a regra geral de `ModuleAccessPermission` exige filial na sessão, salvo o que a classe do ViewSet declarar. Nesta leitura, a isenção explícita está nas `APIView` da tabela acima.
