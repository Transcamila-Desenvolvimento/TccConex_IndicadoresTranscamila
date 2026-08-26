import React, { useEffect, useMemo, useState } from 'react';
import type { SgqEscopoAnaliseOpcaoCadastro } from '../../types/domain';
import {
  useCreateSgqEscopoAnaliseOpcao,
  useDeleteSgqEscopoAnaliseOpcao,
  useSgqEscoposAnaliseCadastro,
  useUpdateSgqEscopoAnaliseOpcao,
} from '../../hooks/useSgqPesquisas';
import QueryDataPanel from '../../components/QueryDataPanel';

type Props = {
  onClose: () => void;
};

function errorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (!data) return fallback;
  if (typeof data.detail === 'string') return data.detail;
  const first = Object.values(data).find((value) => Array.isArray(value) && value.length > 0);
  if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
  return fallback;
}

const PencilIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const CloseIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SGQEscoposAnaliseModal: React.FC<Props> = ({ onClose }) => {
  const query = useSgqEscoposAnaliseCadastro();
  const createOpcao = useCreateSgqEscopoAnaliseOpcao();
  const updateOpcao = useUpdateSgqEscopoAnaliseOpcao();
  const deleteOpcao = useDeleteSgqEscopoAnaliseOpcao();

  const escopos = useMemo(
    () => (query.data ?? []).filter((item) => item.ativo),
    [query.data],
  );
  const [selectedId, setSelectedId] = useState('');
  const [novaOpcao, setNovaOpcao] = useState('');
  const [editingOpcaoId, setEditingOpcaoId] = useState<string | null>(null);
  const [editOpcaoLabel, setEditOpcaoLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!selectedId && escopos.length > 0) setSelectedId(escopos[0].id);
    if (selectedId && !escopos.some((item) => item.id === selectedId)) {
      setSelectedId(escopos[0]?.id ?? '');
    }
  }, [escopos, selectedId]);

  useEffect(() => {
    setNovaOpcao('');
    setEditingOpcaoId(null);
    setErrorMsg('');
  }, [selectedId]);

  const selected = useMemo(
    () => escopos.find((item) => item.id === selectedId) ?? null,
    [escopos, selectedId],
  );

  const busy = createOpcao.isPending || updateOpcao.isPending || deleteOpcao.isPending;

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setErrorMsg('');
    try {
      await fn();
    } catch (err) {
      setErrorMsg(errorMessage(err, fallback));
    }
  };

  const saveOpcaoLabel = (opcao: SgqEscopoAnaliseOpcaoCadastro) => {
    const label = editOpcaoLabel.trim();
    if (!label) return;
    if (label === opcao.label) {
      setEditingOpcaoId(null);
      return;
    }
    void run(
      () => updateOpcao.mutateAsync({ id: opcao.id, payload: { label } }).then(() => setEditingOpcaoId(null)),
      'Não foi possível alterar a opção.',
    );
  };

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', alignItems: 'center', padding: '24px 16px', zIndex: 3000 }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div className="search-modal-card sgq-escopos-modal">
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Escopos da análise</h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              Cadastro compartilhado entre <strong>Ibiporã</strong> e <strong>Rondonópolis</strong>.
            </p>
          </div>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>Fechar (X)</span>
        </div>

        <QueryDataPanel
          query={query}
          variant="compact"
          className="sgq-escopos-query"
          loadingMessage="Carregando escopos..."
        >
          <div className="compras-setores-layout">
            <aside className="compras-setores-panel">
              <h4 className="compras-setores-panel-title">Escopos</h4>
              <ul className="compras-setores-list">
                {escopos.length === 0 ? (
                  <li className="compras-setores-empty">Nenhum escopo cadastrado.</li>
                ) : (
                  escopos.map((escopo) => {
                    const isSelected = escopo.id === selectedId;
                    const ativas = escopo.opcoes.filter((opcao) => opcao.ativo).length;
                    return (
                      <li key={escopo.id} className={isSelected ? 'is-selected' : ''}>
                        <button
                          type="button"
                          className="compras-setores-list-btn"
                          onClick={() => setSelectedId(escopo.id)}
                        >
                          <span>{escopo.label}</span>
                          <small>{ativas}</small>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </aside>

            <section className="compras-colaboradores-panel">
              <h4 className="compras-setores-panel-title">
                Opções
                {selected ? ` — ${selected.label}` : ''}
              </h4>

              {!selected ? (
                <p className="compras-setores-empty">Selecione um escopo à esquerda.</p>
              ) : (
                <div className="sgq-escopos-opcoes">
                  <form
                    className="compras-setores-add-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const label = novaOpcao.trim();
                      if (!label) return;
                      void run(async () => {
                        await createOpcao.mutateAsync({ escopoId: selected.id, label });
                        setNovaOpcao('');
                      }, 'Não foi possível adicionar a opção.');
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Nova opção..."
                      value={novaOpcao}
                      onChange={(e) => setNovaOpcao(e.target.value)}
                      disabled={busy}
                    />
                    <button
                      type="submit"
                      className="reports-action-btn primary"
                      disabled={busy || !novaOpcao.trim()}
                    >
                      Adicionar
                    </button>
                  </form>

                  <div className="sgq-escopos-opcoes-list">
                    <table className="erp-table reports-table">
                    <tbody>
                      {selected.opcoes.length === 0 ? (
                        <tr>
                          <td style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontStyle: 'italic' }}>
                            Nenhuma opção neste escopo.
                          </td>
                        </tr>
                      ) : (
                        selected.opcoes.map((opcao) => {
                          const isEditing = editingOpcaoId === opcao.id;
                          return (
                            <tr key={opcao.id} className={opcao.ativo ? undefined : 'sgq-escopos-row-inactive'}>
                              <td>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    autoFocus
                                    value={editOpcaoLabel}
                                    onChange={(e) => setEditOpcaoLabel(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') { e.preventDefault(); saveOpcaoLabel(opcao); }
                                      if (e.key === 'Escape') setEditingOpcaoId(null);
                                    }}
                                    disabled={busy}
                                    style={{ width: '100%', border: '1px solid #118CC4', borderRadius: '6px', padding: '5px 8px' }}
                                  />
                                ) : (
                                  <>
                                    {opcao.label}
                                    {!opcao.ativo && <span className="sgq-escopos-inactive-tag">Inativo</span>}
                                  </>
                                )}
                              </td>
                              <td className="sgq-escopos-opcoes-actions">
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                  {isEditing ? (
                                    <>
                                      <button type="button" className="reports-action-btn-icon" title="Salvar" onClick={() => saveOpcaoLabel(opcao)} disabled={busy}>
                                        <CheckIcon />
                                      </button>
                                      <button type="button" className="reports-action-btn-icon" title="Cancelar" onClick={() => setEditingOpcaoId(null)}>
                                        <CloseIcon />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        className="reports-action-btn-icon"
                                        title="Renomear"
                                        onClick={() => {
                                          setEditingOpcaoId(opcao.id);
                                          setEditOpcaoLabel(opcao.label);
                                        }}
                                      >
                                        <PencilIcon />
                                      </button>
                                      <button
                                        type="button"
                                        className="reports-action-btn-icon"
                                        title={opcao.ativo ? 'Inativar' : 'Reativar'}
                                        onClick={() => void run(
                                          () => updateOpcao.mutateAsync({ id: opcao.id, payload: { ativo: !opcao.ativo } }),
                                          'Não foi possível atualizar a opção.',
                                        )}
                                      >
                                        <i className={opcao.ativo ? 'bi bi-eye' : 'bi bi-eye-slash'} />
                                      </button>
                                      <button
                                        type="button"
                                        className="reports-action-btn-icon"
                                        title="Excluir"
                                        onClick={() => {
                                          if (!window.confirm(`Excluir a opção "${opcao.label}" do cadastro? Pesquisas já gravadas continuam no indicador. Se a opção já foi usada, inative-a em vez de excluir.`)) return;
                                          void run(() => deleteOpcao.mutateAsync(opcao.id), 'Não foi possível excluir a opção.');
                                        }}
                                      >
                                        <i className="bi bi-trash" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </div>
        </QueryDataPanel>

        {errorMsg && (
          <div className="sgq-escopos-error">{errorMsg}</div>
        )}
      </div>
    </div>
  );
};

export default SGQEscoposAnaliseModal;
