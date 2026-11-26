# Banco de dados

## Onde os dados ficam

Desenvolvimento, sem `USE_POSTGRES` e sem `DB_HOST`: SQLite em `backend/db.sqlite3`.

Produção, com `USE_POSTGRES=True` ou com `DB_HOST` definido: PostgreSQL. O guia de implantação cita o banco `prothon_db`. Nome, host e senha reais do servidor: **pendente de confirmação** no App Service. Eles não estão no Git.

Esta documentação não consultou o banco de produção e não gerou migration.

## Tabelas

Nenhum model de negócio define `Meta.db_table`. O nome da tabela é o padrão do Django: `<app>_<modelo>` em minúsculas. `CustomUser` estende `AbstractUser`, então a tabela de login é a do usuário customizado do app `accounts`, além das tabelas do `auth` do Django para sessão e admin.

Chaves primárias são o `id` automático, exceto onde o model declara outra. `Role.id` é `CharField` de chave primária. Campos, chaves estrangeiras, índices e restrições estão nos `models.py` de cada app e nas migrations já versionadas. Um diagrama com todas as colunas não foi desenhado aqui para não duplicar um schema que o model já é.

Integridade aplicada no banco: a que as migrations geraram a partir desses models. Regras que só existem na view não viram constraint só por estarem documentadas.
