# Publicação na Azure

## O que o repositório define

| Item | Valor no código |
|---|---|
| Mecanismo | GitHub Actions, `azure/webapps-deploy@v3` |
| Workflow | `.github/workflows/deploy-azure.yml` |
| Gatilho | push na `main` e execução manual |
| App Service | `tccconex-erp` |
| Resource group usado pelos scripts | `tccconex-erp` |
| Secret | `AZURE_WEBAPP_PUBLISH_PROFILE` |
| Startup | `bash startup.sh` |
| Build no Oryx | `SCM_DO_BUILD_DURING_DEPLOYMENT=false` |
| Porta | `WEBSITES_PORT=8000` |
| Health | `/health/` |
| Pacote | `release.zip` do diretório `backend`, com `frontend_dist` e sem `venv`, `vendor`, `antenv` e SQLite |

Concorrência: um push novo na mesma ref cancela o deploy em andamento (`cancel-in-progress: true`).

O guia [DEPLOY_AZURE.md](../DEPLOY_AZURE.md) ainda cita, no início, o resource group `rg-tccconex-erp`. Mais adiante o mesmo guia e `scripts/azure-ensure-production.ps1` registram o grupo `tccconex-erp`. O hostname que responde hoje e a existência de domínio próprio: **pendente de confirmação** no portal.

## O que o workflow faz

1. `npm ci` e `npm run build` em `frontend/` com Node 20.
2. `pip install -r requirements.txt` só para `collectstatic`.
3. Copia `frontend/dist` para `backend/frontend_dist`.
4. `collectstatic` com uma `DJANGO_SECRET_KEY` exclusiva do job, que não é a chave de produção.
5. `bash -n startup.sh`.
6. Gera o zip e recusa o pacote se `vendor/` ou `antenv/` entrarem, ou se faltarem `startup.sh` e o `index.html` do frontend.
7. Publica com `clean: true`.

Esse workflow não roda `manage.py test`. Os testes ficam em `ci.yml`, no pull request, e não publicam. Falha do build do frontend ou do MkDocs reprova o pull request. As falhas já existentes da suíte Django ficam no log e não reprovam o workflow.

## Homologação

Não há slot, segundo App Service nem workflow de homologação no repositório. Criar outro ambiente gera custo e não foi criado.

## CI e CD

| Fluxo | Quando | Publica o ERP? |
|---|---|---|
| `ci.yml` | pull request para `main`, ou manual | não |
| `deploy-azure.yml` | push na `main`, ou manual | sim |

Enquanto a `main` aceitar push direto, o deploy acontece sem pull request. A trava é proteção de branch no GitHub e depende de administrador. Esta entrega não altera essa proteção.
