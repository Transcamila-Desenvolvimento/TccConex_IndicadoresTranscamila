# Comercial, Frota e demais

## Comercial

Prefixo `/api/comercial/`.

Rotas explícitas: `summary/`, `generalidades/`, `icms-ufs/`, `parametros/`, `icms-frete/`, `enderecos/buscar/`, `enderecos/reverso/`, `maps-config/`, `rota-distancia/`.

Router: `clientes/`, `produtos/`, `propostas/`, `tabela-frete/`, `tabela-frete-linhas/`, `veiculos/`.

Ações com `url_path` em `apps/comercial/views.py` incluem `validacao-resumo`, `consultar-cnpj`, `produtos-sugestoes`, `homologar`, `homologacao-historico`, `historico`, `lote`, `calcular-trecho`, `preview-distribuicao`, `nova-revisao`, `dashboard`, `draft`, `enviar-email`, `enviar-repasse`, `enviar-email-lote`, `reprogramar-validade`, `enviar-aviso-reprogramacao`, `historico-situacoes`, `preset-ccab`, `preset-albaugh`, `descartar-revisao`, `historico-revisoes`.

## Frota

Prefixo `/api/frota/`. Rotas em `apps/frota/urls.py`: `olho-vivo/`, `motoristas/login/`, `motoristas/eu/`, `motoristas/elegiveis/`, `motoristas/usuarios/`, senha e exclusão do usuário motorista, `motoristas/desempenho/`, `desempenho/parametros/`, `desempenho/criterios/`, `desempenho/grupos/`, `desempenho/apuracao/`, `desempenho/extrato/`, `desempenho/ocorrencias/`.

Views de motoristas usam `permission_aba = 'tccconex-motoristas-usuarios'`. Critérios, parâmetros e ocorrências usam as abas `gestao-desempenho-parametros`, `gestao-desempenho-criterios` e `gestao-desempenho-ocorrencias`.

## Marketing

Prefixo `/api/marketing/`. `campanhas/` mais `drive/status/`, `drive/browse/`, `drive/thumbnail/` e `drive/preview/`.

Ações de campanha: `quadro`, `mover-status`, `membros`, `membros/remover`, `atribuir-me`, `participar`, `comentarios`, `midias`, `midias/remover`.

## Logística

`GET` ou o método da view em `summary/` e `metas-faturamento/`. Só esses dois caminhos estão em `apps/logistica/urls.py`.

## Auditoria

`/api/audit/logs/` e `logs/facets/`. Ação `logs/reciclar/`.

## Arquivos

`/api/fs/homedir`, `/api/fs/list` e `/api/fs/write`.

## Notificações

`/api/notificacoes/` no router raiz do app, com `nao-lidas/`, `lida/`, `marcar-todas-lidas/`, `push/config/`, `push/inscrever/` e `push/cancelar/`.

## Camilo

Prefixo `/api/camilo/`: `conversar/`, `voz/`, `atas/enviar-email/`, `chat-padrao/`, `termo/`, `termos/`, `termos/vigente/`, comprovante do aceite, `partes/`, `agentes/` e `agentes/<id>/consultar/`.

Matriz empresarial: `matriz-empresarial/drive/status/`, `drive/browse/`, `documentos/` e `pastas/`.
