# TCCConex

Documentação técnica e funcional do ERP TCCConex, lida no código da `main` (`a429b12`) e nas configurações versionadas.

O que está escrito aqui foi conferido em `backend/`, `frontend/`, `.github/workflows/` e `scripts/`. Quando um comportamento não pôde ser confirmado, a página diz **não identificado** ou **pendente de confirmação**. Em divergência, prevalece o código.

## Como ler

- [Visão geral](introducao/visao-geral.md) descreve o que o sistema organiza.
- [Arquitetura](arquitetura/visao-geral.md) mostra frontend, API e o App Service.
- [APIs](api/convencoes.md) lista as rotas registradas em `urls.py`.
- [Banco de dados](banco-de-dados/visao-geral.md) lista os models Django, sem consulta ao PostgreSQL de produção.
- [Publicação](infraestrutura/publicacao-azure.md) descreve o deploy atual.
- [Desenvolvimento](desenvolvimento/governanca-git.md) descreve branches, commits e pull requests.

## Onde esta documentação vive

A fonte é a pasta `docs/` neste repositório. Ela compila com MkDocs Material (`mkdocs build` na raiz). Não há site público desta central. Publicar fora do Git depende de autorização explícita.

Atualizar só a documentação não muda a funcionalidade. O workflow de deploy da aplicação ainda dispara em todo push na `main`, inclusive quando o commit mexe apenas em `docs/`. Separar esse gatilho altera a publicação existente e fica pendente de autorização.
