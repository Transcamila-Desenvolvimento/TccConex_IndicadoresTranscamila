# Financeiro

Prefixo `/api/financeiro/`. Arquivo: `backend/apps/financeiro/urls.py`.

## Relatórios e tarefas

| Caminho | View |
|---|---|
| `reports/pagar/` e `reports/pagar/facets/` | Dados e facetas de contas a pagar |
| `reports/receber/` e `reports/receber/facets/` | Contas a receber |
| `reports/aging/` e `reports/aging/facets/` | Aging |
| `reports/analise-prs/` | Análise de PRs |
| `reports/pagar/diff/` | Diferença de pagar |
| `reports/pr-action/` | Ação de PR |
| `tasks/<task_id>/` | Status de tarefa Celery |
| `bank-data/sync/` | Sincronização de dados bancários |
| `calendario/sistema/` | Eventos de sistema do calendário |

## Recursos do router

`batches/`, `billing/`, `adjustments/`, `caixinha/descricoes/`, `caixinha/`, `bank-accounts/`, `balance-history/`, `calendario/eventos/`.

Importação de planilha e outras ações `POST` estão em `apps/financeiro/views.py` nos ViewSets de lote e de faturamento importado. Parâmetros de cada formulário: no serializer correspondente.

Permissão das views de negócio deste app: módulo Financeiro, ambiente global no backend (sem filial obrigatória na sessão).
