# Regras comprovadas no código

Só entram regras lidas no código. Política da empresa que não está no repositório: **não documentado**.

## Conta

- Papel `1` é administrador e tem as funções do módulo.
- Papel `2` é operador e depende de ambientes, filiais, abas e funções gravados no usuário.
- Usuário com `status` diferente de `ativo` não passa no JWT.
- `must_change_password` desvia o frontend para a troca de senha.

## Sessão

- Ambiente e filial da requisição vêm dos headers `X-Prothon-Environment` e `X-Prothon-Filial`.
- SGQ e Frota exigem filial. SGQ e Frota só listam Ibiporã (Matriz) e Rondonópolis em `MODULE_BRANCHES`.
- No App Service (`WEBSITE_SITE_NAME` definido), auditorias e SIPOC do SGQ não entram em "todas as rotinas", a menos que `SGQ_AUDITORIAS_LIBERADAS` ou `SGQ_SIPOC_LIBERADO` sejam `True`.

## Publicação e dados

- `startup.sh` aplica `migrate` no boot quando `RUN_STARTUP_MIGRATE` é `True` ou está ausente.
- No App Service, o comando `importar_auditorias_iniciais` roda no boot. O comentário do script diz que a carga não se repete se já existir norma, tipo ou auditoria, e que uma falha dessa importação não impede o restante de subir.

## O que não está nesta página

Alçadas de aprovação comercial, limites de crédito, prazos de fatura e critérios numéricos de bonificação além dos models de frota: estão nos models e nas views daqueles apps, não numa tabela única de regras. Consultar o model antes de descrever um número.
