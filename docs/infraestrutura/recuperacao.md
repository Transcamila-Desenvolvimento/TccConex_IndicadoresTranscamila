# Recuperação

Nenhuma destas ações foi executada nesta entrega. São o procedimento lido no repositório.

## Ver a versão publicada

A `main` do GitHub é a versão que o workflow publica. O commit implantado é o SHA do push que disparou `Deploy TccConex ERP para Azure App Service`. Não há tag Git no repositório. O número de release da aplicação: **não identificado**.

## Ver o log

No GitHub, a execução do workflow mostra build, zip e o passo `azure/webapps-deploy`. No App Service, o log de boot é o stdout de `startup.sh`, que imprime `TccConex ERP startup.sh v10` e as etapas de dependência, migrate e Daphne.

## Falha de publicação

O job falha se o build do frontend falha, se `startup.sh` tem erro de sintaxe, se o zip contém `vendor/` ou `antenv/`, ou se faltam `startup.sh` e o `index.html`. Falha depois do upload aparece no log do App Service. `GET /health/` devolve `ok` quando o processo responde.

## Voltar uma versão

O caminho versionado é publicar de novo um commit anterior da `main`, por revert em pull request, não por reescrita do histórico. Isso dispara outro deploy. Rollback pelo portal, slot ou restore de banco: **não identificado** no repositório e não deve ser feito sem autorização.

Interromper um deploy em andamento: o próprio workflow cancela a execução anterior da mesma ref quando chega um push novo (`cancel-in-progress: true`). Cancelar pelo botão do GitHub Actions não desfaz um pacote que o App Service já tenha ativado.

## O que não rodar como recuperação casual

`scripts/azure-ensure-production.ps1` altera startup, Always On, app settings e reinicia o App Service. `scripts/azure-migrate-data.ps1` é carga de dados. Os dois ficam fora do fluxo normal de documentação.
