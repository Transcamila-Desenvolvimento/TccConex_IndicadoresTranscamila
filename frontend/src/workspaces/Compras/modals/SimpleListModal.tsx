import React, { useState } from 'react';
import QueryDataPanel from '../../../components/QueryDataPanel';
import { useAsyncQueryState, type QueryResultLike } from '../../../hooks/useAsyncQueryState';

export interface SimpleListItem {
  id: string;
  nome: string;
}

interface SimpleListModalProps {
  title: string;
  placeholder: string;
  query: QueryResultLike<SimpleListItem[]>;
  onAdd: (nome: string) => void;
  onEdit: (id: string, nome: string) => void;
  onRemove: (id: string) => void;
  isAdding?: boolean;
  isSaving?: boolean;
  isRemoving?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
}

const SimpleListModal: React.FC<SimpleListModalProps> = ({
  title,
  placeholder,
  query,
  onAdd,
  onEdit,
  onRemove,
  isAdding = false,
  isSaving = false,
  isRemoving = false,
  errorMessage,
  onClose,
}) => {
  const [value, setValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const { canShowEmpty } = useAsyncQueryState(query);
  const items = query.data ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    if (items.some((item) => item.nome.toLowerCase() === trimmed.toLowerCase())) {
      alert('Este item já está cadastrado.');
      return;
    }
    onAdd(trimmed);
    setValue('');
  };

  const startEditing = (item: SimpleListItem) => {
    setEditingId(item.id);
    setEditValue(item.nome);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValue('');
  };

  const confirmEditing = () => {
    if (editingId === null) return;
    const trimmed = editValue.trim();
    if (!trimmed) {
      alert('Informe um nome válido.');
      return;
    }
    const current = items.find((item) => item.id === editingId);
    const duplicated = items.some(
      (item) => item.id !== editingId && item.nome.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicated) {
      alert('Já existe um item cadastrado com este nome.');
      return;
    }
    if (current && trimmed !== current.nome) {
      onEdit(editingId, trimmed);
    }
    cancelEditing();
  };

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', alignItems: 'center', padding: '24px 16px', zIndex: 3000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="search-modal-card" style={{ width: '420px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>{title}</h3>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>Fechar (X)</span>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '16px 24px 0 24px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={isAdding}
              style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', outline: 'none' }}
            />
            <button type="submit" className="reports-action-btn primary" style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }} disabled={isAdding}>
              {isAdding ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
          {errorMessage && (
            <span style={{ display: 'block', marginTop: '8px', color: '#ef4444', fontSize: '12px' }}>{errorMessage}</span>
          )}
        </form>

        <div style={{ padding: '16px 24px 24px 24px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <QueryDataPanel
            query={query}
            variant="compact"
            loadingMessage="Carregando..."
            errorMessage="Não foi possível carregar a lista. Tente novamente."
          >
            <table className="erp-table reports-table">
              <tbody>
                {canShowEmpty && items.length === 0 ? (
                  <tr>
                    <td style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontStyle: 'italic' }}>
                      Nenhum item cadastrado.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const isEditing = editingId === item.id;
                    return (
                      <tr key={item.id}>
                        <td>
                          {isEditing ? (
                            <input
                              type="text"
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); confirmEditing(); }
                                if (e.key === 'Escape') cancelEditing();
                              }}
                              style={{ width: '100%', border: '1px solid #118CC4', borderRadius: '6px', padding: '5px 8px', fontSize: '13px', outline: 'none' }}
                            />
                          ) : (
                            item.nome
                          )}
                        </td>
                        <td style={{ textAlign: 'right', width: isEditing ? '88px' : '76px' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  className="reports-action-btn-icon"
                                  title="Salvar"
                                  onClick={confirmEditing}
                                  disabled={isSaving}
                                  style={{ color: '#118CC4' }}
                                >
                                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="reports-action-btn-icon"
                                  title="Cancelar"
                                  onClick={cancelEditing}
                                  disabled={isSaving}
                                >
                                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="reports-action-btn-icon"
                                  title="Editar"
                                  onClick={() => startEditing(item)}
                                >
                                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="reports-action-btn-icon"
                                  title="Remover"
                                  disabled={isRemoving}
                                  onClick={() => { if (window.confirm(`Remover "${item.nome}"?`)) onRemove(item.id); }}
                                >
                                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
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
        </div>
      </div>
    </div>
  );
};

export default SimpleListModal;
