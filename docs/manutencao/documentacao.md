# Manutenção da documentação

A central faz parte do repositório. Quem altera o sistema atualiza a página correspondente no mesmo pull request.

| Mudança no código | Página a revisar |
|---|---|
| Rota, view ou contrato HTTP | `docs/api/` |
| Model, coluna ou relação | `docs/banco-de-dados/` |
| Permissão, filial, função ou aba | `docs/regras-de-negocio/` |
| Integração ou variável nova | `docs/integracoes/` e `docs/infraestrutura/variaveis-de-ambiente.md` |
| Workflow, App Service ou startup | `docs/infraestrutura/publicacao-azure.md` |
| App ou ambiente novo | `docs/introducao/modulos.md` e a regra `.cursor/rules/modulos-oficiais.mdc` |

O pull request tem um item para marcar essa atualização. O workflow `ci.yml` recusa o pull request se `mkdocs build --strict` falhar. Isso pega navegação quebrada e link interno que o MkDocs não resolve. Não substitui a leitura do conteúdo.

Docstring, tipo e comentário que já existem podem ser citados. Não se acrescenta comentário no código só para alimentar esta central.

A documentação descreve o código commitado. Comportamento visto só em conversa ou em rascunho local fica marcado como pendente até entrar no Git.
