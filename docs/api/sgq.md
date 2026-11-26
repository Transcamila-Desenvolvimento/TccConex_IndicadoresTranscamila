# SGQ

Prefixo `/api/sgq/`. Arquivo: `backend/apps/sgq/urls.py`.

Permissão: `permission_module = 'SGQ'`. SGQ não é ambiente global: sem `X-Prothon-Filial`, `ModuleAccessPermission` nega o acesso. SIPOC também declara `permission_aba = 'sipoc'`.

No App Service, `SGQ_AUDITORIAS_LIBERADAS` e `SGQ_SIPOC_LIBERADO` nascem falsos. Fora do App Service o padrão em `settings.py` é verdadeiro. Com o flag falso, a rotina não entra em "todas as rotinas"; o acesso depende do cadastro da rotina no usuário.

Cabeçalho: `Authorization: Bearer <jwt>`, `X-Prothon-Environment: SGQ` e `X-Prothon-Filial`.

## Rotas fixas

| Caminho | View |
|---|---|
| `drive/status/` | `SGQDriveStatusView` |
| `drive/browse/` | `SGQDriveBrowseView` |

## Router

| Recurso | ViewSet |
|---|---|
| `pesquisas-satisfacao/` | `PesquisaSatisfacaoViewSet` |
| `escopos-analise/` | `EscopoAnaliseViewSet` |
| `escopos-analise-opcoes/` | `EscopoAnaliseOpcaoViewSet` |
| `documentos/` | `DocumentoSGQViewSet` |
| `pastas/` | `PastaMatrizSGQViewSet` |
| `auditorias/` | `AuditoriaSGQViewSet` |
| `normas/` | `NormaSGQViewSet` |
| `normas-itens/` | `ItemNormaSGQViewSet` |
| `auditorias-categorias/` | `CategoriaAuditoriaSGQViewSet` |
| `auditorias-tipos-resposta/` | `TipoRespostaSGQViewSet` |
| `sipoc-setores/` | `SetorSipocSGQViewSet` |
| `sipoc-procedimentos/` | `ProcedimentoSipocSGQViewSet` |

Ações com `url_path` lidas em `auditoria_views.py` e `views.py`: `drive-status`, `drive-browse`, `form-draft`, `excluir-lote`, `enviar-cronograma`, `reabrir-questionario`, `sugerir-evidencia`, `anexos`, `anexos-drive`, `tipos-resposta`, `exportar-modelo-itens`, `importar-itens`, `enviar-resumo`, `anos-resumo`, `lote-draft`, `exportar-modelo`.

Método HTTP de cada ação: o `methods` do `@action` na view. Corpo: o serializer ou os campos lidos dentro do método. Esta página não copia um JSON que o código não concentra num schema.

## Integridade lida no model

`AuditoriaSGQ.codigo` é único. O comentário do model diz que o código segue `AA-NNNNN`, sequencial por ano. Há `UniqueConstraint` `uniq_sgq_auditoria_ano_sequencia` em `ano` + `sequencia`.

`NormaSGQ` é única por `filial` + `nome`. `CategoriaAuditoriaSGQ` também. `TipoRespostaSGQ` é único por `filial` + `sequencia` e por `filial` + `nome`. `RespostaAuditoriaSGQ` é única por `auditoria` + `item`. `EscopoAnaliseOpcao` é única por `escopo` + `chave`.

`RespostaAuditoriaSGQ.item` usa `PROTECT`. Excluir a pergunta com resposta vinculada é recusado pelo banco.
