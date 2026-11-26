# SGQ

Prefixo `/api/sgq/`. Arquivo: `backend/apps/sgq/urls.py`.

Rotas explícitas: `drive/status/` e `drive/browse/`.

Recursos do router:

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

Ações com `url_path` visto em `auditoria_views.py` e `views.py`: `drive-status`, `drive-browse`, `form-draft`, `excluir-lote`, `enviar-cronograma`, `reabrir-questionario`, `sugerir-evidencia`, `anexos`, `anexos-drive`, `tipos-resposta`, `exportar-modelo-itens`, `importar-itens`, `enviar-resumo`, `anos-resumo`, `lote-draft`, `exportar-modelo`.

Permissão: `SGQ`. SIPOC também declara `permission_aba = 'sipoc'`. SGQ exige filial na sessão. No App Service, `SGQ_AUDITORIAS_LIBERADAS` e `SGQ_SIPOC_LIBERADO` nascem falsos, a menos que a variável de ambiente os ligue. Fora do App Service o padrão no settings é verdadeiro.
