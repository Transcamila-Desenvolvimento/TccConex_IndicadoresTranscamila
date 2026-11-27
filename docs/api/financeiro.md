# Financeiro

Prefixo `/api/financeiro/`. Arquivo: `backend/apps/financeiro/urls.py`.

Permissão das views de negócio: `permission_module = 'Financeiro'`. Financeiro está em `GLOBAL_ENVIRONMENTS`, então a sessão não exige filial. Cabeçalho: `Authorization: Bearer <jwt>` e `X-Prothon-Environment: Financeiro`.

Relatórios paginados usam `ReportPagination`: `page`, `page_size` e filtros descritos na view.

## Consultas

| Método | Caminho | View |
|---|---|---|
| GET | `reports/pagar/` | `ActiveReportDataView`, `report_type=pagar` |
| GET | `reports/pagar/facets/` | `ReportFacetsView` |
| GET | `reports/receber/` | `ActiveReportDataView`, `report_type=receber` |
| GET | `reports/receber/facets/` | `ReportFacetsView` |
| GET | `reports/aging/` | `ActiveReportDataView`, `report_type=aging` |
| GET | `reports/aging/facets/` | `ReportFacetsView` |
| GET | `reports/analise-prs/` | `PrAnalysisView` |
| GET | `reports/pagar/diff/` | `PagarDiffAnalysisView` |
| POST | `reports/pr-action/` | `PrActionView` |
| GET | `tasks/<task_id>/` | `CeleryTaskStatusView` |
| POST | `bank-data/sync/` | `BankDataSyncView` |
| GET | `calendario/sistema/` | `CalendarSystemEventsView` |

## Lotes

`ReportBatchViewSet` é somente leitura no router `batches/`, com duas ações `POST`.

| Método | Caminho | Efeito comprovado |
|---|---|---|
| GET | `batches/` | Lista os lotes e inclui `maxBatches` |
| POST | `batches/prepare_import/` | Cria lote (201) ou reutiliza o do dia (200) |
| POST | `batches/<id>/import_report/` | Multipart. Campos `type` (`pagar`, `receber` ou `aging`) e arquivo `file` |
| POST | `batches/<id>/finalize/` | Marca o lote como ativo e desativa os demais |

`type` fora dessa lista ou arquivo ausente responde 400. Com `USE_CELERY=True`, a importação responde 202 e `{ "async": true, "taskId": "..." }`. Sem Celery, a importação é síncrona e devolve `type`, `fileName`, `success`, `rowCount`, `skippedRows` e `issues`. Erro não tratado na leitura do arquivo responde 500.

O status da tarefa assíncrona é `GET tasks/<task_id>/`.

## Faturamento, ajustes e cofre

| Recurso | ViewSet | Observação lida na view |
|---|---|---|
| `billing/` | `BillingRecordViewSet` | `ModelViewSet`. `POST billing/import_xml/` recebe multipart `file`. Com Celery, 202 e `taskId`. Sem arquivo, 400 |
| `adjustments/` | `CashAdjustmentViewSet` | `ModelViewSet` paginado. Criar, editar e excluir gravam auditoria |
| `caixinha/` | `CaixinhaLancamentoViewSet` | `GET caixinha/resumo/` devolve `saldo`, `totalEntradas` e `totalSaidas`. `GET caixinha/extrato/` exige data inicial e final (`start_date` ou `startDate`, e o par final); sem as duas, 400 |
| `caixinha/descricoes/` | `CaixinhaDescricaoViewSet` | `ModelViewSet` |
| `bank-accounts/` | `BankAccountViewSet` | `ModelViewSet` |
| `balance-history/` | `BalanceHistoryEntryViewSet` | `ModelViewSet` |
| `calendario/eventos/` | `CalendarioEventoViewSet` | `ModelViewSet`. O model diz que cada usuário vê os próprios eventos |

Corpo de criação e edição de cada recurso: o serializer da view. Esta página não duplica campos que o serializer já declara.
