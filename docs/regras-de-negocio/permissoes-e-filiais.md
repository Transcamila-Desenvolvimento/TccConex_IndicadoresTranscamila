# Permissões e filiais

Fonte: `backend/apps/accounts/permissions.py` e `backend/apps/accounts/constants.py`.

## Quem entra

Operador entra num ambiente se o nome está em `CustomUser.environments`. Administrador entra em todos, exceto que Administração/Manutenção exige `role_id` `1`.

O header `X-Prothon-Environment` precisa ser o mesmo `permission_module` da view. Header de outro ambiente nega o acesso.

## Filial obrigatória

Ambientes globais no backend, sem filial obrigatória na sessão:

Administração/Manutenção, Financeiro, RH, Compras, Faturamento, Marketing, Logística, Comercial, Suprimentos e CamiloIA.

SGQ e Frota não estão nessa lista. Sem filial no header, a view desses módulos nega o acesso.

Indicadores também não está na lista do backend. As views lidas compensam com `permission_requires_filial = False`. O frontend trata Indicadores como sessão sem filial obrigatória.

## Escopo dos registros

`apply_filial_scope` filtra o queryset. Com `admin_bypass` verdadeiro, o administrador vê o consolidado. Com `admin_bypass` falso, até o administrador fica na filial da sessão. O comentário do código cita o SGQ como caso de registros sempre segregados.

Nomes de filial no banco aceitam apelidos em `FILIAL_DB_ALIASES` (Ibiporã, Matriz, códigos `01`, `03`, `05` e outros). A lista canônica continua sendo `ALL_BRANCHES`.

## Funções e abas

Operador só executa função listada em `funcoes` para o módulo e, se houver lista em `funcao_filiais`, só naquelas filiais. Aba com lista em `aba_filiais` só abre nessas filiais. Lista vazia não restringe.
