# Comercial, Frota e demais

Cabeçalho autenticado nas views de módulo: `Authorization: Bearer <jwt>` e `X-Prothon-Environment`. Frota também exige `X-Prothon-Filial`.

## Comercial

Prefixo `/api/comercial/`. Comercial está em `GLOBAL_ENVIRONMENTS`.

Rotas explícitas em `apps/comercial/urls.py`: `summary/`, `generalidades/`, `icms-ufs/`, `parametros/`, `icms-frete/`, `enderecos/buscar/`, `enderecos/reverso/`, `maps-config/`, `rota-distancia/`.

Router: `clientes/`, `produtos/`, `propostas/`, `tabela-frete/`, `tabela-frete-linhas/`, `veiculos/`.

Ações com `url_path` em `apps/comercial/views.py`: `validacao-resumo`, `consultar-cnpj`, `produtos-sugestoes`, `homologar`, `homologacao-historico`, `historico`, `lote`, `calcular-trecho`, `preview-distribuicao`, `nova-revisao`, `dashboard`, `draft`, `enviar-email`, `enviar-repasse`, `enviar-email-lote`, `reprogramar-validade`, `enviar-aviso-reprogramacao`, `historico-situacoes`, `preset-ccab`, `preset-albaugh`, `descartar-revisao`, `historico-revisoes`.

O método e o corpo de cada ação estão no `@action` e no serializer da view. Endereço e distância usam `GOOGLE_MAPS_API_KEY`. O comentário do exemplo de ambiente diz que, sem a chave, o sistema usa OpenStreetMap.

## Frota

Prefixo `/api/frota/`. Frota exige filial na sessão. Várias views ainda exigem aba.

| Método | Caminho | Aba ou acesso |
|---|---|---|
| GET, PUT | `olho-vivo/` | aba `olho-vivo`. O `PUT` ainda exige a função `responder-olho-vivo` |
| POST | `motoristas/login/` | `AllowAny` |
| GET | `motoristas/eu/` | `AllowAny` |
| GET | `motoristas/elegiveis/` | aba `tccconex-motoristas-usuarios` |
| GET, POST | `motoristas/usuarios/` | a mesma aba |
| PATCH | `motoristas/usuarios/<pk>/senha/` | a mesma aba |
| DELETE | `motoristas/usuarios/<pk>/` | a mesma aba |
| GET | `motoristas/desempenho/` | `AllowAny` na view lida |
| GET, PUT | `desempenho/parametros/` | aba `gestao-desempenho-parametros` |
| GET | `desempenho/criterios/` | aba `gestao-desempenho-criterios` |
| POST, PATCH, DELETE | `desempenho/grupos/` e `desempenho/grupos/<pk>/` | a mesma aba |
| POST, PATCH, DELETE | `desempenho/criterios/itens/` e `.../itens/<pk>/` | a mesma aba |
| GET | `desempenho/apuracao/` e `desempenho/extrato/` | aba `gestao-desempenho-ocorrencias` |
| GET, POST | `desempenho/ocorrencias/` | a mesma aba |
| DELETE | `desempenho/ocorrencias/<pk>/` | a mesma aba |

`GET olho-vivo/` sem `mes` devolve o resumo do ano. Com `ano` e `mes`, devolve o período. Ano ou mês inválido responde 400 com `detail`. A resposta do Olho Vivo é única por `filial` + `period_key`.

`UsuarioMotorista` guarda a senha no próprio model. O login do motorista não é o `POST /api/auth/login/`.

## Logística

Prefixo `/api/logistica/`. As duas views usam `permission_module = 'Logística'`.

| Método | Caminho | Efeito |
|---|---|---|
| GET | `summary/` | `environment` e `message` fixos no código |
| GET | `metas-faturamento/` | Metas do `ano` na query. Ano inválido: 400 |
| PUT | `metas-faturamento/` | Corpo `ano` e `meses`. Grava `MetaFaturamentoMensal` e audita `logistica.meta_faturamento.atualizado` |

`MetaFaturamentoConfigView` declara `permission_requires_filial = False`.

## Marketing

Prefixo `/api/marketing/`. `campanhas/` mais `drive/status/`, `drive/browse/`, `drive/thumbnail/` e `drive/preview/`.

Ações de campanha lidas no código: `quadro`, `mover-status`, `membros`, `membros/remover`, `atribuir-me`, `participar`, `comentarios`, `midias`, `midias/remover`.

## Auditoria, arquivos, notificações e Camilo

| Prefixo | Caminhos lidos |
|---|---|
| `/api/audit/` | `logs/`, `logs/facets/`, ação `logs/reciclar/` |
| `/api/fs/` | `homedir`, `list`, `write` |
| `/api/notificacoes/` | router do app, `nao-lidas/`, `lida/`, `marcar-todas-lidas/`, `push/config/`, `push/inscrever/`, `push/cancelar/` |
| `/api/camilo/` | `conversar/`, `voz/`, `atas/enviar-email/`, `chat-padrao/`, `termo/`, `termos/`, `termos/vigente/`, comprovante do aceite, `partes/`, `agentes/`, `agentes/<id>/consultar/`, `matriz-empresarial/drive/status/`, `drive/browse/`, `documentos/`, `pastas/` |

Corpo de chat, voz e termo está na view do Camilo. Sem `GEMINI_API_KEY`, o comentário do exemplo de ambiente diz que o chat avisa que o modelo não está configurado.
