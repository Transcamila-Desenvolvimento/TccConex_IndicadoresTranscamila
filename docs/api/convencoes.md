# Convenções da API

Não há especificação OpenAPI no repositório. Os caminhos abaixo saem de `path` e `router.register` em cada `urls.py`.

## Formato

- Prefixo `/api/`.
- Autenticação: `Authorization: Bearer <jwt>`, salvo `/health/` e o que a view marcar como público.
- Sessão: `X-Prothon-Environment` e `X-Prothon-Filial`.
- `REST_FRAMEWORK` não define paginação global nem parser extra. Relatórios financeiros paginam com `ReportPagination` (`page`, `page_size` e filtros). ViewSets usam o comportamento do router do DRF: lista, criação, detalhe, atualização e exclusão quando o ViewSet implementa a ação.
- Ações adicionais usam `@action` nos arquivos de views. O caminho extra é o `url_path` ou o nome do método. O corpo de cada ação está no serializer ou na view daquele arquivo. Esta central não copia corpos que o código não concentra num schema.

## Códigos

| Situação | Código típico no DRF |
|---|---|
| Sem token ou token inválido | 401 |
| Módulo ou filial negados | 403 |
| Registro ausente | 404 |
| Validação do serializer | 400 |

Confirmação de cada view: no arquivo citado na página do módulo.
