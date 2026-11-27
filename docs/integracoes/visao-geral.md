# Integrações

Credenciais ficam em variável de ambiente ou no `backend/.env` local. Nenhum valor secreto entra nesta página. Os nomes estão em `backend/.env.example` e em `prothon/settings.py`.

| Integração | Onde o código usa | Configuração |
|---|---|---|
| Google OAuth | Vínculo da conta, contatos e Drive do usuário | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_OAUTH_HD` (padrão `transcamila.com.br`) |
| Google Drive | Marketing, RH, SGQ e matriz do Camilo | OAuth do usuário e as rotas `drive/` daqueles apps |
| Google Maps | Endereço, distância e mapa comercial | `GOOGLE_MAPS_API_KEY`. O comentário do `.env.example` diz que, sem a chave, o sistema usa OpenStreetMap |
| Gemini | Chat e voz do Camilo | `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TTS_MODEL`. Sem chave, o comentário do exemplo diz que o chat avisa que o modelo não está configurado |
| E-mail SMTP | Envio de mensagens do ERP | `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL` |
| Google Chat | Aviso além do sino | `GOOGLE_CHAT_SERVICE_ACCOUNT_JSON`. Vazio: só o sino, segundo o exemplo |
| Web Push | Notificação do navegador | Par VAPID. Sem as duas chaves, o exemplo diz que fica só o sininho |
| CAEPI | `ConsultaCaepiView` em `/api/caepi/` | Serviço externo chamado pela view. URL e contrato completos: ver `apps/compras/views_caepi.py` |
| Redis | Celery, cache e presença | `CELERY_BROKER_URL` e variáveis de presença |
| PostgreSQL | Dados de produção | `DB_*` e `USE_POSTGRES` |

Falha de cada chamada externa: tratada na view ou no client daquele módulo. Não há um tratador único no projeto. Timeout, retentativa e fila de cada integração: **não identificado** como política global.
