import React, { useEffect, useMemo, useState } from 'react';
import QueryDataPanel from '../../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../../hooks/useAsyncQueryState';
import {
  useSetoresCompras,
  useColaboradoresCompras,
  useCreateSetorCompras,
  useUpdateSetorCompras,
  useDeleteSetorCompras,
  useCreateColaboradorCompras,
  useUpdateColaboradorCompras,
  useDeleteColaboradorCompras,
  getComprasErrorMessage,
} from '../../../hooks/useCompras';
import type { Setor } from '../../../types/domain';

interface SetoresColaboradoresModalProps {
  onClose: () => void;
}

const SetoresColaboradoresModal: React.FC<SetoresColaboradoresModalProps> = ({ onClose }) => {
  const setoresQuery = useSetoresCompras();
  const createSetor = useCreateSetorCompras();
  const updateSetor = useUpdateSetorCompras();
  const deleteSetor = useDeleteSetorCompras();
  const createColaborador = useCreateColaboradorCompras();
  const updateColaborador = useUpdateColaboradorCompras();
  const deleteColaborador = useDeleteColaboradorCompras();

  const setores = setoresQuery.data ?? [];
  const [selectedSetorId, setSelectedSetorId] = useState<string>('');

  useEffect(() => {
    if (!selectedSetorId && setores.length > 0) {
      setSelectedSetorId(setores[0].id);
    }
    if (selectedSetorId && !setores.some((s) => s.id === selectedSetorId)) {
      setSelectedSetorId(setores[0]?.id ?? '');
    }
  }, [setores, selectedSetorId]);

  const colaboradoresQuery = useColaboradoresCompras(selectedSetorId || undefined);
  const { canShowEmpty: canShowEmptyColaboradores } = useAsyncQueryState(colaboradoresQuery);
  const colaboradores = colaboradoresQuery.data ?? [];

  const selectedSetor = useMemo(
    () => setores.find((s) => s.id === selectedSetorId) ?? null,
    [setores, selectedSetorId],
  );

  const [novoSetor, setNovoSetor] = useState('');
  const [editingSetorId, setEditingSetorId] = useState<string | null>(null);
  const [editSetorNome, setEditSetorNome] = useState('');

  const [novoColaborador, setNovoColaborador] = useState('');
  const [editingColaboradorId, setEditingColaboradorId] = useState<string | null>(null);
  const [editColaboradorNome, setEditColaboradorNome] = useState('');

  const handleAddSetor = (e: React.FormEvent) => {
    e.preventDefault();
    const nome = novoSetor.trim();
    if (!nome) return;
    if (setores.some((s) => s.nome.toLowerCase() === nome.toLowerCase())) {
      alert('Este setor já está cadastrado.');
      return;
    }
    createSetor.mutate(nome, {
      onSuccess: (created) => {
        setNovoSetor('');
        setSelectedSetorId(created.id);
      },
    });
  };

  const startEditSetor = (setor: Setor) => {
    setEditingSetorId(setor.id);
    setEditSetorNome(setor.nome);
  };

  const saveEditSetor = () => {
    if (!editingSetorId) return;
    const nome = editSetorNome.trim();
    if (!nome) {
      alert('Informe um nome válido para o setor.');
      return;
    }
    updateSetor.mutate({ id: editingSetorId, nome }, { onSuccess: () => setEditingSetorId(null) });
  };

  const handleRemoveSetor = (setor: Setor) => {
    const count = setor.colaboradoresCount ?? 0;
    const msg = count > 0
      ? `O setor "${setor.nome}" possui ${count} colaborador(es). Remova ou mova os colaboradores antes de excluir o setor.`
      : `Excluir o setor "${setor.nome}"?`;
    if (count > 0) {
      alert(msg);
      return;
    }
    if (window.confirm(msg)) {
      deleteSetor.mutate(setor.id);
    }
  };

  const handleAddColaborador = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSetorId) {
      alert('Selecione um setor antes de cadastrar colaboradores.');
      return;
    }
    const nome = novoColaborador.trim();
    if (!nome) return;
    if (colaboradores.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) {
      alert('Já existe um colaborador com este nome neste setor.');
      return;
    }
    createColaborador.mutate(
      { nome, setorId: selectedSetorId },
      { onSuccess: () => setNovoColaborador('') },
    );
  };

  const startEditColaborador = (id: string, nome: string) => {
    setEditingColaboradorId(id);
    setEditColaboradorNome(nome);
  };

  const saveEditColaborador = () => {
    if (!editingColaboradorId) return;
    const nome = editColaboradorNome.trim();
    if (!nome) {
      alert('Informe um nome válido.');
      return;
    }
    updateColaborador.mutate(
      { id: editingColaboradorId, nome },
      { onSuccess: () => setEditingColaboradorId(null) },
    );
  };

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', alignItems: 'center', padding: '24px 16px', zIndex: 3000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="search-modal-card compras-setores-modal" style={{ width: '820px', maxWidth: '94vw', maxHeight: '86vh', display: 'flex', flexDirection: 'column' }}>
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Setores e Colaboradores</h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              Cadastre colaboradores vinculados a cada setor para o protocolo de saída.
            </p>
          </div>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>Fechar (X)</span>
        </div>

        <div className="compras-setores-layout">
          <aside className="compras-setores-panel">
            <h4 className="compras-setores-panel-title">Setores</h4>
            <form onSubmit={handleAddSetor} className="compras-setores-add-form">
              <input
                type="text"
                placeholder="Ex: Logística, Frota..."
                value={novoSetor}
                onChange={(e) => setNovoSetor(e.target.value)}
                disabled={createSetor.isPending}
              />
              <button type="submit" className="reports-action-btn primary" disabled={createSetor.isPending}>
                {createSetor.isPending ? '...' : '+'}
              </button>
            </form>

            <QueryDataPanel
              query={setoresQuery}
              variant="compact"
              loadingMessage="Carregando setores..."
              errorMessage="Não foi possível carregar os setores."
            >
              <ul className="compras-setores-list">
                {setores.length === 0 ? (
                  <li className="compras-setores-empty">Nenhum setor cadastrado.</li>
                ) : (
                  setores.map((setor) => {
                    const isSelected = setor.id === selectedSetorId;
                    const isEditing = editingSetorId === setor.id;
                    return (
                      <li key={setor.id} className={isSelected ? 'is-selected' : ''}>
                        {isEditing ? (
                          <div className="compras-setores-edit-row">
                            <input
                              type="text"
                              autoFocus
                              value={editSetorNome}
                              onChange={(e) => setEditSetorNome(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); saveEditSetor(); }
                                if (e.key === 'Escape') setEditingSetorId(null);
                              }}
                            />
                            <button type="button" className="reports-action-btn-icon" title="Salvar" onClick={saveEditSetor} disabled={updateSetor.isPending}>
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                            </button>
                            <button type="button" className="reports-action-btn-icon" title="Cancelar" onClick={() => setEditingSetorId(null)}>
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="compras-setores-list-btn"
                            onClick={() => setSelectedSetorId(setor.id)}
                          >
                            <span>{setor.nome}</span>
                            <small>{setor.colaboradoresCount ?? 0}</small>
                          </button>
                        )}
                        {!isEditing && isSelected && (
                          <div className="compras-setores-list-actions">
                            <button type="button" className="reports-action-btn-icon" title="Editar setor" onClick={() => startEditSetor(setor)}>
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                            </button>
                            <button type="button" className="reports-action-btn-icon" title="Excluir setor" onClick={() => handleRemoveSetor(setor)}>
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            </QueryDataPanel>
            {createSetor.isError && (
              <span style={{ color: '#ef4444', fontSize: '12px' }}>
                {getComprasErrorMessage(createSetor.error, 'Não foi possível adicionar o setor.')}
              </span>
            )}
          </aside>

          <section className="compras-colaboradores-panel">
            <h4 className="compras-setores-panel-title">
              Colaboradores
              {selectedSetor ? ` — ${selectedSetor.nome}` : ''}
            </h4>

            {!selectedSetorId ? (
              <p className="compras-setores-empty">Selecione ou cadastre um setor.</p>
            ) : (
              <>
                <form onSubmit={handleAddColaborador} className="compras-setores-add-form">
                  <input
                    type="text"
                    placeholder="Nome do colaborador..."
                    value={novoColaborador}
                    onChange={(e) => setNovoColaborador(e.target.value)}
                    disabled={createColaborador.isPending}
                  />
                  <button type="submit" className="reports-action-btn primary" disabled={createColaborador.isPending}>
                    {createColaborador.isPending ? 'Adicionando...' : 'Adicionar'}
                  </button>
                </form>

                <QueryDataPanel
                  query={colaboradoresQuery}
                  variant="compact"
                  loadingMessage="Carregando colaboradores..."
                  errorMessage="Não foi possível carregar os colaboradores."
                >
                  <table className="erp-table reports-table">
                    <tbody>
                      {canShowEmptyColaboradores && colaboradores.length === 0 ? (
                        <tr>
                          <td colSpan={2} style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontStyle: 'italic' }}>
                            Nenhum colaborador neste setor.
                          </td>
                        </tr>
                      ) : (
                        colaboradores.map((colab) => {
                          const isEditing = editingColaboradorId === colab.id;
                          return (
                            <tr key={colab.id}>
                              <td>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    autoFocus
                                    value={editColaboradorNome}
                                    onChange={(e) => setEditColaboradorNome(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') { e.preventDefault(); saveEditColaborador(); }
                                      if (e.key === 'Escape') setEditingColaboradorId(null);
                                    }}
                                    style={{ width: '100%', border: '1px solid #118CC4', borderRadius: '6px', padding: '5px 8px' }}
                                  />
                                ) : (
                                  colab.nome
                                )}
                              </td>
                              <td style={{ textAlign: 'right', width: '76px' }}>
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                  {isEditing ? (
                                    <>
                                      <button type="button" className="reports-action-btn-icon" title="Salvar" onClick={saveEditColaborador}>
                                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                      </button>
                                      <button type="button" className="reports-action-btn-icon" title="Cancelar" onClick={() => setEditingColaboradorId(null)}>
                                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button type="button" className="reports-action-btn-icon" title="Editar" onClick={() => startEditColaborador(colab.id, colab.nome)}>
                                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                                      </button>
                                      <button
                                        type="button"
                                        className="reports-action-btn-icon"
                                        title="Remover"
                                        onClick={() => {
                                          if (window.confirm(`Remover "${colab.nome}" do setor ${selectedSetor?.nome}?`)) {
                                            deleteColaborador.mutate(colab.id);
                                          }
                                        }}
                                      >
                                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
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
                </QueryDataPanel>
                {createColaborador.isError && (
                  <span style={{ color: '#ef4444', fontSize: '12px' }}>
                    {getComprasErrorMessage(createColaborador.error, 'Não foi possível adicionar o colaborador.')}
                  </span>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default SetoresColaboradoresModal;
