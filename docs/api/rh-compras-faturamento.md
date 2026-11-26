# RH, Compras e Faturamento

Cabeçalho autenticado: `Authorization: Bearer <jwt>` e `X-Prothon-Environment` igual ao `permission_module` da view.

## RH

Prefixo `/api/rh/`. Arquivo: `backend/apps/rh/urls.py`.

Views lidas usam `permission_module = 'RH'`. RH está em `GLOBAL_ENVIRONMENTS`, então a sessão não exige filial.

| Método | Caminho | O que o código faz |
|---|---|---|
| GET | `drive/status/` | `RHDriveStatusView` |
| GET | `drive/browse/` | `RHDriveBrowseView` |

Router e tipo lido na view:

| Recurso | ViewSet | Tipo |
|---|---|---|
| `lotes/` | `LoteMovimentacaoRHViewSet` | `ModelViewSet` |
| `movimentacoes/` | `MovimentacaoColaboradorViewSet` | `ReadOnlyModelViewSet` |
| `pjs/` | `ColaboradorPJViewSet` | `ModelViewSet` |
| `cargos/` | `CargoMappingViewSet` | `ModelViewSet` |
| `colaboradores/` | `ColaboradorViewSet` | `ModelViewSet` |
| `quadro/` | `FuncionarioQuadroViewSet` | `ModelViewSet` |
| `historico-salarial/` | `HistoricoSalarialViewSet` | `ReadOnlyModelViewSet` |
| `alteracoes/` | `InconsistenciaColaboradorViewSet` | `ModelViewSet` |
| `documentos/` | `DocumentoRHViewSet` | `ModelViewSet` |
| `pastas/` | `PastaMatrizRHViewSet` | `ModelViewSet` |

Ações confirmadas em `LoteMovimentacaoRHViewSet`:

| Método | Caminho | Efeito |
|---|---|---|
| POST | `lotes/prepare_import/` | `mes` e `ano` no corpo. `get_or_create` do lote. Responde 200 |
| POST | `lotes/importar_arquivo/` | Multipart: `mes`, `ano` e `arquivo`. Sem arquivo, 400 |
| POST | `lotes/importar_lote/` | Multipart: `arquivo`. Sem arquivo, 400 |
| GET | `lotes/exportar_modelo/` | Planilha `.xlsx` com o cabeçalho do modelo |
| POST | `lotes/<id>/enviar_email/` | Envio do lote. O corpo está na view |

O lote é único por `mes` e `ano`. Há outras ações `@action` em `apps/rh/views.py` (histórico de PJ, importação de histórico, documentos). O `url_path`, quando não é declarado, é o nome do método.

## Compras e Suprimentos

Prefixo `/api/compras/`. Nenhuma view lida usa `permission_module = 'Compras'`. Estoque e uniforme usam `permission_module = 'Suprimentos'`. Suprimentos está em `GLOBAL_ENVIRONMENTS`.

| Recurso | Tipo lido |
|---|---|
| `unidades/`, `setores/`, `colaboradores/`, `fornecedores/`, `itens/`, `uniformes/` | `ModelViewSet` |
| `entradas/`, `saidas/`, `uniformes-entregas/`, `uniformes-movimentacoes/` | `ReadOnlyModelViewSet` |

`Colaborador` deste app não é o `Colaborador` do RH. A unicidade do colaborador de compras é `setor` + `nome`. Uniforme é único por `nome` + `tamanho`.

`/api/caepi/` é `ConsultaCaepiView`, fora do prefixo de compras. Contrato da consulta externa: `apps/compras/views_caepi.py`.

## Faturamento

Prefixo `/api/faturamento/`. Views lidas usam `permission_module = 'Faturamento'`. Faturamento é ambiente global. As views de nota de débito ainda declaram `permission_requires_filial = False`.

| Método | Caminho | View | Efeito comprovado |
|---|---|---|---|
| GET | `nds/pagadores/` | `NdPagadoresView` | `selecionados`, `disponiveis` e `lote` |
| PUT | `nds/pagadores/` | `NdPagadoresView` | Corpo `codigos`, lista. Sem lista, 400. Mais de 500 códigos, 400 |
| GET | `nds/titulos/` | `NdTitulosView` | Paginado. Query `search`, `ordering`, `cliente`, `situacao`. A resposta acrescenta `totalSaldo` e `resumo` |
| GET, POST | `protocolo-clientes/` | `ClienteProtocoloViewSet` | Recurso do router |
| GET, POST | `protocolo-clientes/<id>/filiais/` | `FilialClienteProtocoloViewSet` | Lista e cria |
| DELETE | `protocolo-clientes/<id>/filiais/<pk>/` | `FilialClienteProtocoloViewSet` | Exclui a filial do cliente |
| GET, POST e demais do ViewSet | `protocolos/` | `ProtocoloEnvioViewSet` | Recurso do router |

Ações extras citadas no código de `apps/faturamento/views.py`, como `consultar-cnpj/` e `draft/`, continuam na view. O corpo de cada uma é o serializer ou o método correspondente.
