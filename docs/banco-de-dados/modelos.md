# Modelos e tabelas

Lista das classes `models.Model` e de `CustomUser` encontradas nos `models.py`. Relacionamentos são os campos `ForeignKey`, `OneToOneField` e `ManyToManyField` de cada classe.

## accounts

`Role`, `CustomUser`.

## financeiro

`ReportBatch`, `PagarTitulo`, `ReceberTitulo`, `AgingTitulo`, `BillingRecord`, `CashAdjustment`, `CaixinhaLancamento`, `CaixinhaDescricao`, `BankAccount`, `CalendarioEvento`, `BalanceHistoryEntry`.

## indicadores

`IndicadorKpi`, `IndicadorFilial`, `MetaFaturamentoMensal`, `GerencialSnapshot`.

## audit

`AuditLog`.

## rh

`Colaborador`, `FuncionarioQuadro`, `LoteMovimentacaoRH`, `MovimentacaoColaborador`, `InconsistenciaColaborador`, `CargoMapping`, `ColaboradorPJ`, `ColaboradorPJHistorico`, `DocumentoRH`, `PastaMatrizRH`.

## compras

`UnidadeMedida`, `Setor`, `Colaborador`, `Fornecedor`, `ItemEstoque`, `EntradaEstoque`, `SaidaEstoque`, `Uniforme`, `EntregaUniforme`, `EntregaUniformeItem`, `DevolucaoUniforme`, `DevolucaoUniformeItem`, `MovimentacaoUniforme`.

Há duas classes chamadas `Colaborador`: uma em `rh` e outra em `compras`. São models diferentes.

## faturamento

`ClienteProtocolo`, `FilialClienteProtocolo`, `ProtocoloEnvio`, `ProtocoloEnvioDraft`, `PagadorNd`, `TituloNd`.

## sgq

`PesquisaSatisfacao`, `PesquisaSatisfacaoLoteDraft`, `PesquisaSatisfacaoFormDraft`, `AuditoriaFormDraft`, `EscopoAnalise`, `EscopoAnaliseOpcao`, `DocumentoSGQ`, `AuditoriaSGQ`, `NormaSGQ`, `CategoriaAuditoriaSGQ`, `TipoRespostaSGQ`, `ItemNormaSGQ`, `RespostaAuditoriaSGQ`, `AnexoRespostaAuditoriaSGQ`, `SetorSipocSGQ`, `ProcedimentoSipocSGQ`, `PastaMatrizSGQ`.

## marketing

`CampanhaMarketing`, `CampanhaComentario`, `CampanhaMembro`, `CampanhaMidia`.

## frota

`RespostaOlhoVivo`, `UsuarioMotorista`, `ParametroBonificacao`, `FaixaBonificacao`, `GrupoCriterioDesempenho`, `CriterioDesempenho`, `OcorrenciaDesempenho`, `ItemRespostaOlhoVivo`.

## comercial

`ClienteComercial`, `ProdutoComercial`, `ClienteComercialProduto`, `HomologacaoProdutoEvento`, `PropostaComercial`, `PropostaComercialDraft`, `PropostaFreteLinha`, `TabelaFrete`, `TabelaFreteLinha`, `GeneralidadeComercial`, `MatrizIcmsUf`, `ParametrosComercial`, `VeiculoComercial`, `VeiculoRotuloCliente`.

## notificacoes

`Notificacao`, `PushInscricao`.

## camilo

`Agente`, `ChatPadrao`, `TermoVersao`, `TermoAceite`, `PastaMatrizEmpresarial`, `DocumentoMatrizEmpresarial`.

## Sem model neste levantamento

`filesystem` e `logistica` não apareceram com classe `models.Model` em `models.py`. Logística lê configuração em views e o indicador de meta usa `MetaFaturamentoMensal` no app `indicadores`.
