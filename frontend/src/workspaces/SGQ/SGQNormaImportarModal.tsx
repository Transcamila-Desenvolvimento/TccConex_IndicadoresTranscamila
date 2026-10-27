import React, { useRef, useState } from 'react';
import { getSgqAuditoriaErrorMessage } from '../../hooks/useSgqAuditorias';
import { useExportarModeloItensNorma, useImportarSgqNormaItens } from '../../hooks/useSgqNormas';
import type {
  SgqNormaArea,
  SgqNormaClassificacao,
  SgqNormaImportColuna,
  SgqNormaImportPapel,
  SgqNormaItensImportResumo,
  SgqNormaTipoResposta,
} from '../../types/domain';
import { SGQ_NORMA_IMPORT_PAPEL_OPTIONS } from '../../types/domain';
import { descreverOpcoes } from './sgqRespostas';

const metaValida = (meta: number) => Number.isInteger(meta) && meta >= 0 && meta <= 100;

const contagem = (valores: Record<string, number>) => (
  Object.entries(valores).map(([sigla, total]) => `${sigla}: ${total}`).join(' · ')
);

interface Props {
  filial: string | null;
  normaId: string;
  tiposResposta: SgqNormaTipoResposta[];
  itensExistentes: number;
  onClose: () => void;
  onImportado: () => void;
}

const SGQNormaImportarModal: React.FC<Props> = ({
  filial, normaId, tiposResposta, itensExistentes, onClose, onImportado,
}) => {
  const importar = useImportarSgqNormaItens(filial, normaId);
  const baixarModelo = useExportarModeloItensNorma();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [tipoEscolhido, setTipoRespostaId] = useState('');
  const tipoRespostaId = tipoEscolhido || tiposResposta[0]?.id || '';
  const [substituir, setSubstituir] = useState(false);
  const [previa, setPrevia] = useState<SgqNormaItensImportResumo | null>(null);
  const [colunas, setColunas] = useState<SgqNormaImportColuna[]>([]);
  const [mapeamentoAlterado, setMapeamentoAlterado] = useState(false);
  const [novasClasses, setNovasClasses] = useState<SgqNormaClassificacao[]>([]);
  const [novasAreas, setNovasAreas] = useState<SgqNormaArea[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const novasCompletas = novasClasses.every((c) => c.nome.trim() && metaValida(c.metaPrimeira) && metaValida(c.metaReavaliacao))
    && novasAreas.every((a) => a.nome.trim());
  const podeImportar = Boolean(previa && !previa.pendencia && !mapeamentoAlterado);

  const executar = (dryRun: boolean) => {
    if (!arquivo || !tipoRespostaId) return;
    setErro(null);
    importar.mutate(
      {
        file: arquivo,
        tipoRespostaId,
        substituir,
        dryRun,
        mapeamento: colunas.map(({ indice, papel, area }) => ({ indice, papel, area })),
        classificacoes: dryRun ? undefined : novasClasses,
        areas: dryRun ? undefined : novasAreas,
      },
      {
        onSuccess: (resumo) => {
          if (!dryRun) {
            onImportado();
            onClose();
            return;
          }
          setPrevia(resumo);
          setColunas(resumo.colunas);
          setMapeamentoAlterado(false);
          setNovasClasses((atuais) => resumo.classificacoesNovas.map((sigla) => (
            atuais.find((c) => c.sigla === sigla) ?? { sigla, nome: '', critica: false, metaPrimeira: 0, metaReavaliacao: 0 }
          )));
          setNovasAreas((atuais) => resumo.areasNovas.map((sigla) => (
            atuais.find((a) => a.sigla === sigla) ?? { sigla, nome: '' }
          )));
        },
        onError: (err) => setErro(getSgqAuditoriaErrorMessage(err, 'Não foi possível importar a planilha. Tente novamente.')),
      },
    );
  };

  const trocarArquivo = (file: File | null) => {
    if (file && !file.name.toLowerCase().endsWith('.xlsx')) {
      setErro('Envie uma planilha Excel (.xlsx).');
      return;
    }
    setArquivo(file);
    setPrevia(null);
    setColunas([]);
    setNovasClasses([]);
    setNovasAreas([]);
    setErro(null);
    if (!file && arquivoRef.current) arquivoRef.current.value = '';
  };

  const alterarColuna = (indice: number, alteracao: Partial<SgqNormaImportColuna>) => {
    setColunas((atuais) => atuais.map((c) => (c.indice === indice ? { ...c, ...alteracao } : c)));
    setMapeamentoAlterado(true);
  };

  const alterarClasse = (indice: number, alteracao: Partial<SgqNormaClassificacao>) => {
    setNovasClasses((atuais) => atuais.map((c, i) => (i === indice ? { ...c, ...alteracao } : c)));
  };

  const fechar = () => { if (!importar.isPending) onClose(); };

  const baixar = async () => {
    setErro(null);
    try {
      const blob = await baixarModelo.mutateAsync();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'modelo_requisitos_sgq.xlsx';
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setErro('Não foi possível baixar a planilha modelo.');
    }
  };

  return (
    <div className="search-backdrop sgq-aud-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="modal-card sgq-aud-modal is-largo" role="dialog" aria-modal="true" aria-labelledby="sgq-importar-itens-title">
        <div className="modal-header">
          <div>
            <h3 id="sgq-importar-itens-title">Importar lista de verificação</h3>
            <p className="sgq-aud-modal-sub">
              Planilha Excel (.xlsx). Na análise você confere e ajusta o que cada coluna representa.
            </p>
          </div>
          <button type="button" className="btn-icon" onClick={fechar} aria-label="Fechar">
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        <div className="modal-body sgq-aud-form">
          <fieldset disabled={importar.isPending}>
            <div className="sgq-aud-campo is-wide">
              <span>Arquivo (.xlsx) <em>*</em></span>
              <div
                className={`sgq-import-arquivo${arquivo ? ' has-file' : ''}${arrastando ? ' is-arrastando' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!importar.isPending) setArrastando(true);
                }}
                onDragLeave={() => setArrastando(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setArrastando(false);
                  if (importar.isPending) return;
                  trocarArquivo(e.dataTransfer.files?.[0] ?? null);
                }}
              >
                <input
                  ref={arquivoRef}
                  id="sgq-norma-arquivo"
                  className="sgq-import-arquivo-input"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => trocarArquivo(e.target.files?.[0] ?? null)}
                />
                <label htmlFor="sgq-norma-arquivo" className="sgq-import-arquivo-btn">
                  <i className="bi bi-paperclip" aria-hidden="true" />
                  {arquivo ? 'Trocar' : 'Anexar'}
                </label>
                <span className="sgq-import-arquivo-nome" title={arquivo?.name}>
                  {arquivo ? <i className="bi bi-file-earmark-excel" aria-hidden="true" /> : null}
                  <span>{arquivo ? arquivo.name : 'Arraste a planilha ou clique em Anexar'}</span>
                </span>
                {arquivo && (
                  <button
                    type="button"
                    className="sgq-import-arquivo-limpar"
                    onClick={() => trocarArquivo(null)}
                    aria-label="Remover arquivo"
                  >
                    <i className="bi bi-x-lg" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
            <label>
              <span>Tipo de resposta das perguntas <em>*</em></span>
              <select className="form-input" value={tipoRespostaId} onChange={(e) => setTipoRespostaId(e.target.value)}>
                {tiposResposta.length === 0 && <option value="">Nenhum tipo de resposta cadastrado</option>}
                {tiposResposta.map((tipo) => (
                  <option key={tipo.id} value={tipo.id} title={descreverOpcoes(tipo.opcoes)}>
                    {tipo.codigo} - {tipo.nome}
                  </option>
                ))}
              </select>
            </label>
            {itensExistentes > 0 && (
              <label className="sgq-norma-switch sgq-norma-switch-inline">
                <input type="checkbox" checked={substituir} onChange={(e) => setSubstituir(e.target.checked)} />
                <span>Substituir os {itensExistentes} itens atuais</span>
              </label>
            )}
            <p className="is-wide sgq-norma-aviso">
              <i className="bi bi-info-circle" aria-hidden="true" />
              Baixe o modelo e preencha a aba Lista. O mesmo arquivo serve para ISO 9001, SASSMAQ e outras normas:
              código e pergunta são obrigatórios; classificação e áreas (SS, MA, Q ou outra sigla) ficam em branco quando
              a norma não usa. Na análise você confere o que cada coluna representa.
            </p>
          </fieldset>

          {previa && colunas.length > 0 && (
            <div className="sgq-norma-colunas">
              <strong>Colunas da planilha (cabeçalho na linha {previa.linhaCabecalho})</strong>
              <div className="table-container">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Coluna</th>
                      <th>Exemplos</th>
                      <th>Usar como</th>
                      <th>Sigla da área</th>
                    </tr>
                  </thead>
                  <tbody>
                    {colunas.map((coluna) => (
                      <tr key={coluna.indice} className={coluna.papel === 'ignorar' ? 'is-ignorada' : undefined}>
                        <td title={coluna.cabecalho}>{coluna.cabecalho}</td>
                        <td className="sgq-norma-colunas-exemplos" title={coluna.exemplos.join(' | ')}>
                          {coluna.exemplos.join(' | ') || '—'}
                        </td>
                        <td>
                          <select
                            className="form-input"
                            value={coluna.papel}
                            disabled={importar.isPending}
                            onChange={(e) => alterarColuna(coluna.indice, { papel: e.target.value as SgqNormaImportPapel })}
                            aria-label={`Uso da coluna ${coluna.cabecalho}`}
                          >
                            {SGQ_NORMA_IMPORT_PAPEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td>
                          {coluna.papel === 'area' && (
                            <input
                              className="form-input"
                              maxLength={10}
                              value={coluna.area}
                              disabled={importar.isPending}
                              onChange={(e) => alterarColuna(coluna.indice, { area: e.target.value.toUpperCase() })}
                              aria-label={`Sigla da área da coluna ${coluna.cabecalho}`}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {previa && !mapeamentoAlterado && (
            <div className="sgq-norma-previa">
              {previa.pendencia ? (
                <span className="is-alerta">{previa.pendencia}</span>
              ) : (
                <>
                  <strong>
                    {previa.total} itens encontrados: {previa.orientativos} textos orientativos e {previa.perguntas} perguntas,
                    em {previa.requisitos} requisito(s) principal(is).
                  </strong>
                  {Object.keys(previa.porClassificacao).length > 0 && (
                    <span>Perguntas por classificação: {contagem(previa.porClassificacao)}.</span>
                  )}
                  {Object.keys(previa.porArea).length > 0 && <span>Perguntas por área: {contagem(previa.porArea)}.</span>}
                  {substituir && itensExistentes > 0 && (
                    <span className="is-alerta">Os {itensExistentes} itens atuais da norma serão excluídos.</span>
                  )}
                  {previa.linhasIgnoradas.length > 0 && (
                    <span>Linhas sem código ignoradas: {previa.linhasIgnoradas.join(', ')}.</span>
                  )}
                  {previa.avisos.length > 0 && <ul>{previa.avisos.map((aviso) => <li key={aviso}>{aviso}</li>)}</ul>}
                </>
              )}

              {novasClasses.length > 0 && (
                <fieldset className="sgq-norma-previa-classes" disabled={importar.isPending}>
                  <span className="is-alerta">Classificações novas na planilha: defina-as para importar (serão cadastradas na norma).</span>
                  <ol className="sgq-norma-classes">
                    {novasClasses.map((classe, indice) => (
                      <li key={classe.sigla} className="sgq-norma-classe is-nova">
                        <strong className="sgq-req-classe" title={`${previa.porClassificacao[classe.sigla]} perguntas`}>{classe.sigla}</strong>
                        <label>
                          Nome
                          <input
                            className="form-input"
                            maxLength={60}
                            value={classe.nome}
                            onChange={(e) => alterarClasse(indice, { nome: e.target.value })}
                            placeholder="Ex.: Mandatória"
                          />
                        </label>
                        <label className="sgq-tr-na" title="Pergunta obrigatória; uma não conformidade reprova a auditoria">
                          <input
                            type="checkbox"
                            checked={classe.critica}
                            onChange={(e) => alterarClasse(indice, { critica: e.target.checked })}
                          />
                          <span>Crítica</span>
                        </label>
                        <label title="Meta de conformidade na 1ª avaliação">
                          Meta 1ª (%)
                          <input
                            className="form-input"
                            type="number"
                            min={0}
                            max={100}
                            value={classe.metaPrimeira}
                            onChange={(e) => alterarClasse(indice, { metaPrimeira: Number(e.target.value) })}
                          />
                        </label>
                        <label title="Meta de conformidade nas reavaliações">
                          Reavaliação (%)
                          <input
                            className="form-input"
                            type="number"
                            min={0}
                            max={100}
                            value={classe.metaReavaliacao}
                            onChange={(e) => alterarClasse(indice, { metaReavaliacao: Number(e.target.value) })}
                          />
                        </label>
                      </li>
                    ))}
                  </ol>
                </fieldset>
              )}

              {novasAreas.length > 0 && (
                <fieldset className="sgq-norma-previa-classes" disabled={importar.isPending}>
                  <span className="is-alerta">Áreas novas na planilha: informe o nome de cada uma (serão cadastradas na norma).</span>
                  <ol className="sgq-norma-classes">
                    {novasAreas.map((area, indice) => (
                      <li key={area.sigla} className="sgq-norma-classe is-area-nova">
                        <strong className="sgq-req-classe" title={`${previa.porArea[area.sigla]} perguntas`}>{area.sigla}</strong>
                        <input
                          className="form-input"
                          maxLength={60}
                          value={area.nome}
                          onChange={(e) => setNovasAreas((atuais) => atuais.map((a, i) => (i === indice ? { ...a, nome: e.target.value } : a)))}
                          placeholder="Ex.: Saúde e Segurança"
                          aria-label={`Nome da área ${area.sigla}`}
                        />
                      </li>
                    ))}
                  </ol>
                </fieldset>
              )}
            </div>
          )}
          {erro && <p className="sgq-norma-erro">{erro}</p>}

          <div className="modal-footer">
            <button
              type="button"
              className="reports-action-btn secondary sgq-import-modelo"
              onClick={baixar}
              disabled={importar.isPending || baixarModelo.isPending}
            >
              <i className="bi bi-download" aria-hidden="true" />
              {baixarModelo.isPending ? 'Baixando...' : 'Baixar modelo'}
            </button>
            <button type="button" className="reports-action-btn secondary" onClick={fechar} disabled={importar.isPending}>
              Cancelar
            </button>
            {podeImportar && previa ? (
              <button
                type="button"
                className="reports-action-btn primary"
                onClick={() => executar(false)}
                disabled={importar.isPending || !novasCompletas}
                title={novasCompletas ? undefined : 'Defina o nome (e as metas, nas classificações) dos itens novos'}
              >
                {importar.isPending ? 'Importando...' : `Importar ${previa.total} itens`}
              </button>
            ) : (
              <button
                type="button"
                className="reports-action-btn primary"
                onClick={() => executar(true)}
                disabled={!arquivo || !tipoRespostaId || importar.isPending}
              >
                {importar.isPending ? 'Analisando...' : previa ? 'Analisar novamente' : 'Analisar planilha'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SGQNormaImportarModal;
