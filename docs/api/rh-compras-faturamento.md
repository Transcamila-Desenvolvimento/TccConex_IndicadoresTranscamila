# RH, Compras e Faturamento

## RH

Prefixo `/api/rh/`. Router: `lotes/`, `movimentacoes/`, `pjs/`, `cargos/`, `colaboradores/`, `quadro/`, `historico-salarial/`, `alteracoes/`, `documentos/`, `pastas/`.

Rotas explícitas: `drive/status/` e `drive/browse/`.

Ações de importação, histórico e documentos estão em `apps/rh/views.py`. Views lidas usam `permission_module = 'RH'`. RH é ambiente global.

## Compras e Suprimentos

Prefixo `/api/compras/`. Router: `unidades/`, `setores/`, `colaboradores/`, `fornecedores/`, `itens/`, `entradas/`, `saidas/`, `uniformes/`, `uniformes-entregas/`, `uniformes-movimentacoes/`.

As views de estoque e uniforme declaram `permission_module = 'Suprimentos'`. Não foi encontrada a atribuição `permission_module = 'Compras'`. O ambiente Compras existe na interface e em `ACTIVE_ENVIRONMENTS`. Como a tela Compras escolhe o header de ambiente em cada chamada: **pendente de confirmação** tela a tela.

`GET` ou `POST` em `/api/caepi/` é `ConsultaCaepiView`, fora do prefixo de compras.

## Faturamento

Prefixo `/api/faturamento/`.

| Caminho | View |
|---|---|
| `nds/pagadores/` | Pagadores de nota de débito |
| `nds/titulos/` | Títulos de nota de débito |
| `protocolo-clientes/` | `ClienteProtocoloViewSet` |
| `protocolo-clientes/<id>/filiais/` | Lista e cria filiais do cliente. `DELETE` no detalhe |
| `protocolos/` | `ProtocoloEnvioViewSet` |

Ações extras em `apps/faturamento/views.py` incluem `consultar-cnpj/`, `draft/` e `bulk_print_labels/`, além de outras ações `POST` e `GET` sem `url_path` explícito.
