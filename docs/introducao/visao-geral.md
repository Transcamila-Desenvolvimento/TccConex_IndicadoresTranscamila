# Visão geral

O TCCConex é o ERP interno da Transcamila. O repositório junta uma interface React e uma API Django. Em produção os dois saem no mesmo Azure App Service: o Django serve o build do React e as rotas `/api/`.

O nome do projeto Django é `prothon`. O usuário do sistema é `accounts.CustomUser`.

## Para que serve

O código cobre operação financeira, indicadores, pessoas, compras e suprimentos, faturamento, qualidade (SGQ), marketing, logística, frota, comercial e um agente interno (CamiloIA). Cada área é um ambiente escolhido depois do login.

## O que esta página não afirma

Objetivo comercial além do que os módulos implementam, lista de processos oficiais da empresa e público externo do sistema: **não documentado** no repositório. O guia `docs/DEPLOY_AZURE.md` trata da implantação, não do negócio.
