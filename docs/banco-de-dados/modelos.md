# Modelos e tabelas

Lista das classes `models.Model` e de `CustomUser` encontradas nos `models.py`. Relacionamentos são os campos `ForeignKey`, `OneToOneField` e `ManyToManyField` de cada classe.

Colunas abaixo foram lidas nos `models.py` dos apps de negócio. Chave primária omitida é o `id` automático do Django, salvo onde o model declara outra. `filesystem` e `logistica` não têm `models.Model`.

## accounts

Tabela de `Role`: `accounts_role`. PK de `Role` é `id` (`CharField`, tamanho 10), não o inteiro automático.

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | CharField | PK |
| `name` | CharField | |
| `description` | TextField | blank |
| `permissions` | JSONField | lista, blank |

`CustomUser` estende `AbstractUser`. Tabela: `accounts_customuser`. Além das colunas do usuário do Django (`username`, `password`, `email`, `is_staff`, `is_active`, `date_joined`, entre outras), o model declara:

| Coluna | Tipo | Observação |
|---|---|---|
| `name` | CharField | blank |
| `cargo` | CharField | blank |
| `telefone` | CharField | blank |
| `cpf` | CharField | até 11, blank |
| `role_id` | CharField | padrão `2`. `1` é administrador |
| `status` | CharField | padrão `ativo` |
| `environments` | JSONField | lista de ambientes |
| `filiais` | JSONField | objeto por ambiente |
| `indicadores` | JSONField | lista. Vazia significa todos |
| `indicador_filiais` | JSONField | recorte por indicador |
| `funcoes` | JSONField | funções do operador por ambiente |
| `abas` | JSONField | abas por ambiente |
| `aba_filiais` | JSONField | filiais de cada aba |
| `funcao_filiais` | JSONField | filiais de cada função |
| `google_email` | EmailField | null, blank |
| `google_sub` | CharField | null, blank |
| `google_linked_at` | DateTimeField | null, blank |
| `google_token` | JSONField | null, blank. Segredo de sessão Google; não documentar o valor |
| `google_picture_url` | URLField | blank |
| `must_change_password` | BooleanField | padrão falso |

Não há `ForeignKey` de `CustomUser` para `Role`. O papel é o texto `role_id`.

## financeiro

```mermaid
erDiagram
    ReportBatch ||--o{ PagarTitulo : batch
    ReportBatch ||--o{ ReceberTitulo : batch
    ReportBatch ||--o{ AgingTitulo : batch
    BankAccount ||--o{ BalanceHistoryEntry : account
    CustomUser ||--o{ ReportBatch : updated_by
    CustomUser ||--o{ CalendarioEvento : usuario
```

`ReportBatch` (`financeiro_reportbatch`): `label`, `reference_date`, `updated_by` para `CustomUser` com `SET_NULL` e null, `is_active`, `imported_pagar`, `imported_receber`, `imported_aging`, `created_at`.

`PagarTitulo`: `batch` (`CASCADE`), `filial`, `cod_forn`, `fornecedor`, `titulo`, `tipo`, `emissao`, `vencimento`, `vencimento_real`, `valor` e `saldo` (`Decimal` 14,2), `historico` blank, `pr_desconsiderada`.

`ReceberTitulo`: `batch` (`CASCADE`), `filial`, `cod_cliente`, `cliente`, `titulo`, `natureza`, `emissao`, `vencimento`, `vencimento_real`, `valor`, `saldo`, `historico` blank.

`AgingTitulo`: `batch` (`CASCADE`), `origem`, `cod_cliente`, `cliente`, `loja`, `docto`, `serie`, `tipo`, `emissao`, `vencimento`, `regiao`, `total`.

`BillingRecord`: `reference_date`, `branch`, `value`, `notes_count`. `unique_together` de `reference_date` e `branch`.

`CashAdjustment`: `reference_date`, `adjustment_type`, `value`, `observation`, `created_by`.

`CaixinhaLancamento`: `reference_date`, `movement_type`, `value`, `description`, `created_by` blank.

`CaixinhaDescricao`: `movement_type`, `description`, `created_by` blank. `UniqueConstraint` `uniq_caixinha_descricao_tipo` em `movement_type` + `description`.

`BankAccount`: `bank`, `agency`, `number`, `account_type`, `balance`, `credit_limit`, `last_updated`.

`CalendarioEvento`: `usuario` (`CASCADE` para `CustomUser`), `titulo`, `descricao` blank, `data`, `cor` padrão `azul`, `created_at`, `updated_at`.

`BalanceHistoryEntry`: `account` (`CASCADE` para `BankAccount`), `reference_date`, `bank`, `number`, `entry_type`, `value`.

## indicadores

`IndicadorKpi`: `label`, `value`, `change`, `up` (padrão verdadeiro), `sort_order`.

`IndicadorFilial`: `filial`, `receita`, `fretes`, `toneladas`, `meta`, `sort_order`.

`MetaFaturamentoMensal`: `ano`, `mes`, `valor` (`Decimal` 15,2). Único por `ano` + `mes`. O realizado do indicador não fica neste model; vem de `BillingRecord`.

`GerencialSnapshot`: `reference_date` único, `batch_label` blank, `fat_dia`, `fat_mes`, `fat_ano`, `saldo_banco`, `duplicatas_a_receber`, `ctas_rec_atrasadas`, `ctes_emitidos`, `a_disponibilizar`, `contas_pagar_ate_corte`, `pagar_cutoff_date` null, `ctas_pag_atrasadas`, `saidas_previstas`, `posicao_gerencial`, `caixa_positivo_ate` blank, `sent_by` blank, `sent_at`. Não há chave estrangeira destes quatro models para o financeiro. O realizado da meta é lido na view.

## audit

`AuditLog`.

## rh

`Colaborador`: `cpf` único, `matricula`, `nome_completo`, `empresa`, `filial`, `departamento`, `cargo`, `situacao`, `data_admissao`, `data_demissao`, `telefone`, `nome_lider`, `data_nascimento`, `escolaridade`, `sexo` (`M` ou `F`), `regime` padrão `CLT`, `categoria`, `data_atualizacao`, `desconsiderado`.

`FuncionarioQuadro`: `nome`, `cpf` único, `filial`, `cargo`, `departamento`, `data_admissao`, `data_demissao`, `ativo` padrão verdadeiro, `criado_em`.

`LoteMovimentacaoRH`: `mes`, `ano`, `data_importacao`, `usuario` (`SET_NULL` para `CustomUser`), `arquivo`. Único por `mes` + `ano`.

`MovimentacaoColaborador`: `lote` (`CASCADE`), `filial`, `nome`, `situacao`, `uf_estado`, `funcao`, `data_admissao`, `data_nascimento`, `cpf`, `pis_pasep`, `rg`, `salario` (`Decimal` 12,2), `categoria`.

`InconsistenciaColaborador`: `lote` (`CASCADE`), `cpf`, `nome`, `tipo` padrão `salario`, `valor_anterior`, `valor_atual`, `justificativa`, `data_criacao`.

`CargoMapping`: `cargo` único, `categoria`, `data_criacao`, `ultima_atualizacao`.

`ColaboradorPJ`: `nome`, `cpf` único, `salario`, `filial`, `cargo`, `data_admissao`, `data_demissao`, `data_nascimento`, `ativo`, `data_criacao`.

`ColaboradorPJHistorico`: `pj` (`ForeignKey`), `ano`, `mes`, `salario`, `cargo`, `filial`, `motivo`, `data_criacao`. Único por `pj` + `ano` + `mes`.

`DocumentoRH`: `titulo`, `arquivo`, `drive_file_id`, `link_externo`, `nome_original`, `tamanho`, `texto`, `texto_extraido`, `incluido_por` e `pasta` (`ForeignKey`), `criado_em`.

`PastaMatrizRH`: `nome`. Demais campos do model estão em `apps/rh/models.py`.

## compras

Há duas classes `Colaborador`: `rh.Colaborador` e `compras.Colaborador`. São tabelas diferentes.

`UnidadeMedida.nome` e `Setor.nome` são únicos. `Fornecedor.nome` é único. `ItemEstoque`: `nome` único, `unidade` padrão `Un`, `qtd_atual`, `qtd_minima`.

`compras.Colaborador`: `setor` (`ForeignKey`), `nome`, `cargo`, `cpf`. Único por `setor` + `nome` (`compras_colaborador_setor_nome_unique`).

`EntradaEstoque`: `item` e `fornecedor` com `SET_NULL`, mais os snapshots `item_nome` e `fornecedor_nome`, `data`, `quantidade`, `valor_unitario`, `data_criacao`.

`SaidaEstoque`: `item`, `setor` e `colaborador` com `SET_NULL`, snapshots de nome, `data`, `quantidade`, `data_criacao`.

`Uniforme`: `nome`, `codigo`, `tamanho`, `qtd_nova`, `qtd_usada`, `estoque_minimo`, `criado_em`. Único por `nome` + `tamanho`.

`EntregaUniforme`: `colaborador` (`ForeignKey` para o colaborador de compras), snapshots de nome, CPF, cargo e setor, `data_entrega`, `observacoes`, `usuario` (`SET_NULL`), `usuario_nome`, `criado_em`.

`EntregaUniformeItem`: `entrega` (`PROTECT`), `uniforme` (`SET_NULL`), snapshots, `condicao`, `quantidade`, `qtd_devolvida`, `qtd_descartada`, `qtd_perdida`.

`DevolucaoUniforme`: `entrega` (`PROTECT`), `data_devolucao`, `observacoes`, `usuario`, `usuario_nome`, `criado_em`.

`DevolucaoUniformeItem`: `devolucao` e `entrega_item` com `PROTECT`, `qtd_boa`, `qtd_danificada`, `qtd_sem_condicoes`, `qtd_perdida`.

`MovimentacaoUniforme`: `tipo`, `uniforme` (`SET_NULL`), snapshots, `condicao`, `quantidade`, `variacao_estoque`, `saldo_novo`, `saldo_usado`, `data`, `colaborador`, `entrega`, `devolucao`, `observacao`, `usuario`, `usuario_nome`, `criado_em`.

## faturamento

`ClienteProtocolo`: `codigo`, `loja` padrão `01`, `tipo_pessoa`, `nome`, `razao_social`, `nome_fantasia`, `nome_interno`, `municipio`, `cnpj`, `padrao_protocolo`, `emitir_protocolo_canhotos`, `considerar_pesquisa_satisfacao`, `requer_expedicao`, `exige_filial`, `ultimo_numero_protocolo`, `emails_envio`, `emails_copia`, `data_criacao`, `data_atualizacao`. `codigo` + `loja` são únicos quando `codigo` não é vazio (`faturamento_cliente_codigo_loja_uniq`).

`FilialClienteProtocolo`: `cliente` (`ForeignKey`), `nome`. Único por `cliente` + `nome`.

`ProtocoloEnvio`: `data`, `cliente` (`ForeignKey`), `nota_fiscal`, `numero_sequencial`, `notas_filiais` (`JSONField`), `expedicao`, `usuario` (`ForeignKey`), `usuario_nome`, `data_criacao`, `data_atualizacao`.

`ProtocoloEnvioDraft`: `usuario` (`OneToOneField`), `version`, `payload`, `updated_at`.

`PagadorNd`: `cod_cliente` único, `nome`, `criado_em`, `criado_por` (`ForeignKey`).

`TituloNd`: `chave` única, `filial`, `cod_cliente`, `cliente`, `titulo`, `natureza`, `emissao`, `vencimento_real`, `saldo` (`Decimal` 14,2), `historico`, `baixado`, `atualizado_em`.

## sgq

`PesquisaSatisfacao`: `filial` padrão `Ibiporã (Matriz)`, `data_inclusao` null, `motorista`, `cte`, `data_entrega`, `nota_fiscal`, `cliente` padrão `OUTROS`, `cliente_recusou_assinar`, os critérios `prazo_entrega`, `condicoes_mercadoria`, `condicoes_veiculo`, `apresentacao_motorista` e `atendimento_dispensado` (opções `otimo`, `bom`, `regular`, `ruim`, ou vazio), `analise`, `escopo_analise` (`JSONField`), `criado_por`, `data_criacao`, `data_atualizacao`. O comentário do model diz que a obrigatoriedade condicional dos critérios fica no serializer: se o cliente recusou assinar, o model aceita string vazia.

`PesquisaSatisfacaoLoteDraft`: `usuario` (`CASCADE`), `filial`, `version`, `rows` (`JSONField`), `updated_at`. Único por `usuario` + `filial`.

`PesquisaSatisfacaoFormDraft` e `AuditoriaFormDraft`: `usuario` (`CASCADE`), `filial`, `version`, `payload` (`JSONField`), `updated_at`. Cada um é único por `usuario` + `filial`.

`EscopoAnalise`: `chave` única, `label`, `ordem`, `ativo` padrão verdadeiro. O comentário diz que o catálogo é global para as filiais do SGQ.

`EscopoAnaliseOpcao`: `escopo` (`CASCADE`), `chave`, `label`, `ordem`, `ativo`. Único por `escopo` + `chave`.

`DocumentoSGQ`: `titulo`, `arquivo`, `drive_file_id`, `link_externo`, `nome_original`, `tamanho`, `texto`, `texto_extraido`, `incluido_por` (`SET_NULL`), `pasta` (`PROTECT` para `PastaMatrizSGQ`, null), `criado_em`.

`AuditoriaSGQ`: `filial`, `ano`, `sequencia`, `codigo` único, `categoria`, `titulo`, `data_inicio`, `data_termino`, `normas` (`ManyToMany` para `NormaSGQ`), `auditor_lider`, `auditores` (`JSONField`), `status` padrão `planejamento` (`planejamento`, `execucao` ou `concluida`), `escopo`, `criterios`, `processos_areas`, `responsaveis_processos`, `metodologia`, `consideracoes_finais`, `questionario_concluido`, `questionario_concluido_em` null, `planejamento` (`JSONField`), `criado_por` (`SET_NULL`), `criado_em`, `atualizado_em`. Único também por `ano` + `sequencia`. A função `status_auditoria_automatico` mantém `concluida` quando já está concluída; passa a `execucao` se o questionário foi concluído ou se existe resposta de pergunta; caso contrário devolve `planejamento`.

`NormaSGQ`: `filial`, `nome`, `descricao`, `data_atualizacao`, `emissor`, `publica`, `ativa`, `classificacoes`, `areas` e `mapeamento_importacao` (`JSONField`), `criado_por` (`SET_NULL`), `criado_em`, `atualizado_em`. Única por `filial` + `nome`.

`CategoriaAuditoriaSGQ`: `filial`, `nome`, `normas` (`ManyToMany`), `ativa`, `emissor`, `atualizado_por`, `criado_por` (`SET_NULL`), `criado_em`, `atualizado_em`. Única por `filial` + `nome`.

`TipoRespostaSGQ`: `filial`, `sequencia`, `nome`, `opcoes` (`JSONField`), `publica`, `emissor`, `criado_por` (`SET_NULL`), `criado_em`, `atualizado_em`. Única por `filial` + `sequencia` e por `filial` + `nome`. A propriedade `codigo` formata a sequência com três dígitos.

`ItemNormaSGQ`: `norma` (`CASCADE`), `parent` (`CASCADE` para o próprio item, null), `ordem`, `codigo`, `titulo`, `descricao`, `tipo` padrão `orientativo` (`orientativo` ou `pergunta`), `tipo_resposta` (`PROTECT`, null), `classificacao`, `areas` (`JSONField`), `peso` padrão 1, `obrigatorio` padrão verdadeiro, `criado_em`, `atualizado_em`.

`RespostaAuditoriaSGQ`: `auditoria` (`CASCADE`), `item` (`PROTECT`), `opcao_codigo`, `opcao_texto`, `valor` null, `observacoes`, `destaque` (`forte`, `fraco` ou vazio), `respondido_por` (`SET_NULL`), `atualizado_em`. Única por `auditoria` + `item`. O comentário diz que `valor` nulo significa "não se aplica".

`AnexoRespostaAuditoriaSGQ`: `resposta` (`CASCADE`), `arquivo`, `nome_original`, `tamanho`, `drive_file_id`, `drive_url`, `incluido_por` (`SET_NULL`), `criado_em`.

`SetorSipocSGQ`: `filial`, `nome`, `criado_em`.

`ProcedimentoSipocSGQ`: `filial`, `setor` (`PROTECT`), `nome`, `descricao`, `esquema` (`JSONField`), `criado_por` (`SET_NULL`), `atualizado_em`, `criado_em`.

`PastaMatrizSGQ`: `nome`, `parent` (`CASCADE` para a própria pasta, null), `criado_em`.

## marketing

`CampanhaMarketing`: `titulo`, `descricao`, `data_inicio`, `data_fim`, `status`, `canais` (`JSONField`), `responsavel`, `responsavel_user` (`ForeignKey` para `CustomUser`), `cor` padrão `azul`, `ordem_kanban`, `criado_por`, `criado_por_user` (`ForeignKey`), `data_criacao`, `data_atualizacao`.

`CampanhaComentario`: `campanha` (`ForeignKey`), `autor_user` (`ForeignKey`), `autor_nome`, `texto`, `mencoes` (`ManyToMany` para usuário), `data_criacao`.

`CampanhaMembro`: `campanha`, `user` e `adicionado_por` (`ForeignKey`), `data_criacao`. Único por `campanha` + `user` (`uniq_campanha_membro`).

`CampanhaMidia`: `campanha` (`ForeignKey`), `drive_file_id` com índice, `adicionado_por` (`ForeignKey`), `ordem`, `data_criacao`. Único por `campanha` + `drive_file_id` (`uniq_campanha_midia`).

## frota

`RespostaOlhoVivo`: `filial`, `periodicidade`, `ano`, `mes` null, `period_key`, `updated_by` (`ForeignKey`), `created_at`, `updated_at`. Único por `filial` + `period_key`.

`ItemRespostaOlhoVivo`: `resposta` (`CASCADE`), `comportamento`, `recorrencia`. Único por `resposta` + `comportamento`.

`UsuarioMotorista`: `funcionario` (`OneToOneField`), `username` único, `password`, `criado_em`, `criado_por` (`ForeignKey`). A senha fica neste model, separada de `CustomUser`.

`ParametroBonificacao`: `nota_inicial` padrão 100, `valor_bonus` padrão 500, `limitar_por_grupo`.

`FaixaBonificacao`: `nota_min`, `nota_max`, `modo`, `percentual`, `ordem`.

`GrupoCriterioDesempenho`: `nome`, `pontos_maximos`, `ordem`, `ativo`.

`CriterioDesempenho`: `grupo` (`ForeignKey`), `nome`, `descricao`, `pontos`, `zera_bonus`, `ativo`, `ordem`.

`OcorrenciaDesempenho`: `funcionario` e `criterio` (`ForeignKey`), `filial`, `data`, `quantidade`, `observacao`, `criado_em`, `criado_por`.

## comercial

`ClienteComercial`: `tipo_pessoa`, `cnpj`, `cnpj_digits` com índice, `razao_social`, `nome_fantasia`, `municipio`, `uf`, `logradouro`, `numero`, `complemento`, `bairro`, `cep`, `telefone`, `email`, `inscricao_estadual`, `responsavel`, `observacoes`, `situacao`, `compatibilidade`, `previsao_volumes`, `tipos_embalagens`, `quantidade_volumes`, `posicoes_pallets`, `cliente_desde`, `homologado_por` (`ForeignKey`), `homologado_em`, `homologacao_justificativa`, `homologacao_revisao`, `data_criacao`, `data_atualizacao`. `cnpj_digits` é único quando não está vazio. O `save` grava `tipo_pessoa` como pessoa jurídica e normaliza CNPJ e nomes.

`ProdutoComercial`: `nome`, `classe_risco`, `numero_onu`, `grupo_embalagem`, `fispq_consulta`, `tipo_produto`, `ativo` padrão verdadeiro, `criado_por` e `atualizado_por` (`ForeignKey`), `data_criacao`, `data_atualizacao`. O nome é único sem diferenciar maiúsculas (`comercial_produto_nome_ci_uniq`).

`ClienteComercialProduto`: `cliente` e `produto` (`ForeignKey`), `ordem`, `nome`, `classe_risco`, `numero_onu`, `grupo_embalagem`, `fispq_consulta`. Único por `cliente` + `produto` quando o produto não é nulo.

`HomologacaoProdutoEvento`: `cliente` (`ForeignKey`), `status`, `justificativa`, `produtos_snapshot` (`JSONField`), `usuario` (`ForeignKey`), `data_criacao`.

`PropostaComercial`: `tipo`, `status`, `cliente` (`ForeignKey`), `titulo`, `subtitulo`, `revisao`, `data_proposta`, `proposta_referente`, `responsavel`, `emitido_por` (`ForeignKey`), `reajuste` padrão `Anual com base no índice INCT`, `cliente_nome`, `att`, `validade` padrão `30 dias`, `validade_inicio`, `vencimento_reprogramado`, `vigencia` padrão `12 meses`, `faturamento` padrão `Semanal / 30 DDL`, `local_emissao`, `valor_estimado` (`Decimal`), `observacoes`, os booleanos `inclui_transferencia`, `inclui_distribuicao`, `inclui_armazenagem`, `inclui_op_portuaria`, `inclui_spot` e `inclui_carga_fechada`, `condicoes`, `tabela_armazenagem`, `margens_veiculo`, `tabela_distribuicao`, `historico_revisoes`, `historico_situacoes` e `ajustes_iniciais` (`JSONField`), `aviso_reprogramacao_pendente`, `envio_iniciado_em`, `modo_envio`, `ano` com índice, `numero`, `data_criacao`, `data_atualizacao`. `ano` + `numero` são únicos quando os dois estão preenchidos. A propriedade `numero_identificacao` formata `NNN-AAAA`.

`PropostaComercialDraft`: `usuario` (`OneToOneField`), `version`, `payload`, `updated_at`.

`PropostaFreteLinha`: `proposta` (`ForeignKey`), `ordem`, `origem`, `entrega`, `veiculo`, `veiculo_key`, `modalidade` padrão `transferencia`, `km`, `devolucao_container`, `observacoes`, `peso`, `tarifa_frete`, `pedagio`, `retirada_ctnt`, `desova_ctnt`, `ad_valorem`, `gris`, `icms` padrão `Não incluso`, `prazo_dias`, `outros_valores`, `total_estimado`.

`TabelaFrete`: `nome`, `codigo`, `revisao` padrão 1, `vigencia_inicio`, `vigencia_fim`, `status`, `observacoes`, `clientes` (`ManyToMany` para `ClienteComercial`), `clientes_vinculo_key`, `tipo`, `config` e `faixas` (`JSONField`), `criado_por` e `atualizado_por` (`ForeignKey`), `data_criacao`, `data_atualizacao`.

`TabelaFreteLinha`: `tabela` (`ForeignKey`), `ordem`, `origem`, `entrega`, `veiculo`, `tarifa_frete`, `pedagio`, `ad_valorem`, `gris`, `icms` padrão `Não incluso`, `prazo_dias`, `total_estimado`, `data_criacao`, `data_atualizacao`.

`GeneralidadeComercial`: `cliente` (`ForeignKey`), `tipo_servico`, `ordem`, `rotulo`, `valor`.

`MatrizIcmsUf`: `matriz` (`JSONField`), `atualizado_em`.

`ParametrosComercial`: `logo_pdf` e `logo_email` (`BinaryField`), `logo_pdf_tipo`, `logo_email_tipo`, `validades`, `validade_padrao`, `prazos_faturamento`, `faturamento_padrao`, `vigencias`, `vigencia_padrao`, `atualizado_em`.

`VeiculoComercial`: `nome`, `codigo` único, `antt_fixo`, `antt_por_km`, `capacidade_kg`, `ativo`, `ordem`, `data_criacao`, `data_atualizacao`.

`VeiculoRotuloCliente`: `veiculo` e `cliente` (`CASCADE`), `rotulo`. Único por `veiculo` + `cliente` (`uniq_rotulo_veiculo_cliente`).

## audit

`AuditLog`: `user` (`SET_NULL` para `CustomUser`, null), `username`, `action` com índice, `details`, `created_at`. A ordenação do model é `created_at` decrescente.

## notificacoes

`Notificacao`: `usuario` (`ForeignKey`), `ambiente`, `tipo` com índice, `titulo`, `mensagem`, `link`, `lida_em` null, `criada_em`.

`PushInscricao`: `usuario` (`CASCADE`), `endpoint` único, `p256dh`, `auth`, `user_agent`, `criada_em`, `atualizada_em`. `p256dh` e `auth` são chaves da inscrição do navegador. O valor não entra nesta documentação.

## camilo

`Agente`: PK `id` (`UUIDField`). `usuario` (`ForeignKey`), `nome`, `instrucao`, `escopos` (`JSONField`), `criado_em`, `atualizado_em`.

`ChatPadrao`: PK `id` (`PositiveSmallIntegerField`, padrão 1, não editável). `nome`, `instrucao`. O model é um registro único.

`TermoVersao`: `numero` único, `titulo`, `introducao`, `assinatura`, `declaracao`, `secoes` (`JSONField`), `vigente` padrão falso, `criado_em`, `criado_por` (`ForeignKey`).

`TermoAceite`: PK `id` (`UUIDField`). `usuario` (`ForeignKey`), `versao`, `nome`, `username`, `cpf`, `texto` (`JSONField`), `ip`, `aceito_em`. Único por `usuario` + `versao` (`camilo_termo_usuario_versao`).

`PastaMatrizEmpresarial`: `nome`, `parent` (`CASCADE` para a própria pasta, null), `criado_em`.

`DocumentoMatrizEmpresarial`: `titulo`, `arquivo`, `drive_file_id`, `link_externo`, `nome_original`, `tamanho`, `texto`, `texto_extraido`, `incluido_por` e `pasta` (`ForeignKey`), `criado_em`.

## Sem model neste levantamento

`filesystem` e `logistica` não apareceram com classe `models.Model` em `models.py`. Logística lê configuração em views e o indicador de meta usa `MetaFaturamentoMensal` no app `indicadores`.
