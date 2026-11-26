# Governança Git

Repositório: `https://github.com/Transcamila-Desenvolvimento/TccConex_IndicadoresTranscamila`.

Branch de produção: `main`. Ela está ligada ao deploy. Não há `develop`. Para o tamanho atual do histórico (um remoto, `origin/main`), branches permanentes extras só aumentam o risco de publicar a branch errada.

## Branches de trabalho

Crie a branch a partir da `main` atualizada.

| Prefixo | Uso |
|---|---|
| `feature/nome` | capacidade nova |
| `fix/nome` | correção |
| `hotfix/nome` | correção urgente que precisa ir para a `main` publicada |

Não crie a branch só para existir. Abra quando for commitar o trabalho.

Existe uma branch local `deploy/fatura-bipagem`, em outro worktree, atrás da `main` e com upstream apontando para `origin/main`. Não publicar a partir dela.

## Commits

O histórico recente já usa `feat` e `fix` com escopo, em português. Padronize os próximos, sem reescrever os antigos.

| Tipo | Uso |
|---|---|
| `feat` | funcionalidade |
| `fix` | correção |
| `docs` | documentação |
| `refactor` | reorganização sem mudar comportamento |
| `test` | teste |
| `chore` | manutenção |
| `ci` | workflow |
| `build` | construção e dependência |

Exemplo: `docs: registra as rotas do SGQ na central MkDocs`.

## Pull request

Use o modelo `.github/PULL_REQUEST_TEMPLATE.md`. O CI `Validação contínua` roda no pull request para `main`: build do frontend, testes Django e `mkdocs build --strict`. Ele não faz deploy. Falha do build ou da documentação reprova o pull request. A suíte Django roda e permanece no log; falhas que já existem no código da `main` não reprovam o workflow.

O merge na `main` publica o ERP, porque `deploy-azure.yml` escuta push nessa branch. Proteção para impedir push direto: configurar no GitHub, com permissão de administrador. Não há ruleset versionado no repositório.

## Releases

Não há tags. Uma versão `vX.Y.Z` só deve ser criada quando houver uma publicação que a equipe queira identificar. Não há release artificial nesta entrega.
