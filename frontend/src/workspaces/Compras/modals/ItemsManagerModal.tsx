import React, { useState } from 'react';
import QueryDataPanel from '../../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../../hooks/useAsyncQueryState';
import {
  useItensEstoque,
  useUnidadesMedida,
  useCreateItemEstoque,
  useUpdateItemEstoque,
  useDeleteItemEstoque,
  getComprasErrorMessage,
} from '../../../hooks/useCompras';
import type { ItemEstoque } from '../../../types/domain';

interface ItemFormState {
  nome: string;
  unidade: string;
  qtdAtual: number;
  qtdMinima: number;
}

interface ItemsManagerModalProps {
  onClose: () => void;
}

const ItemsManagerModal: React.FC<ItemsManagerModalProps> = ({ onClose }) => {
  const itemsQuery = useItensEstoque();
  const unidadesQuery = useUnidadesMedida();
  const createItem = useCreateItemEstoque();
  const updateItem = useUpdateItemEstoque();
  const deleteItem = useDeleteItemEstoque();

  const { canShowEmpty } = useAsyncQueryState(itemsQuery);
  const items = itemsQuery.data ?? [];
  const unidades = (unidadesQuery.data ?? []).map((u) => u.nome);

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formQty, setFormQty] = useState<number>(0);
  const [formMinQty, setFormMinQty] = useState<number>(2);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ItemFormState>({ nome: '', unidade: '', qtdAtual: 0, qtdMinima: 0 });

  const filtered = items.filter((item) => item.nome.toLowerCase().includes(search.toLowerCase()));

  const resetForm = () => {
    setFormName('');
    setFormUnit(unidades[0] ?? 'Un');
    setFormQty(0);
    setFormMinQty(2);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Informe o nome do item.');
      return;
    }
    createItem.mutate(
      { nome: formName.trim(), unidade: formUnit || 'Un', qtdAtual: Math.max(0, formQty), qtdMinima: Math.max(0, formMinQty) },
      { onSuccess: () => { resetForm(); setShowForm(false); } },
    );
  };

  const startEditing = (item: ItemEstoque) => {
    setEditingId(item.id);
    setEditForm({ nome: item.nome, unidade: item.unidade, qtdAtual: item.qtdAtual, qtdMinima: item.qtdMinima });
  };

  const cancelEditing = () => setEditingId(null);

  const saveEditing = () => {
    if (!editingId) return;
    if (!editForm.nome.trim()) {
      alert('Informe o nome do item.');
      return;
    }
    updateItem.mutate(
      { id: editingId, item: { ...editForm, nome: editForm.nome.trim() } },
      { onSuccess: () => setEditingId(null) },
    );
  };

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', alignItems: 'center', padding: '24px 16px', zIndex: 3000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="search-modal-card" style={{ width: '760px', maxWidth: '92vw', maxHeight: '84vh', display: 'flex', flexDirection: 'column' }}>
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Gerenciar Itens Cadastrados</h3>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>Fechar (X)</span>
        </div>

        <div style={{ padding: '16px 24px 0 24px', display: 'flex', gap: '10px' }}>
          <div className="reports-search-wrapper" style={{ flex: 1 }}>
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <input type="text" placeholder="Buscar item..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button
            type="button"
            className="reports-action-btn primary"
            style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
            onClick={() => { setShowForm((v) => !v); if (showForm) resetForm(); else resetForm(); }}
          >
            {showForm ? 'Cancelar' : '+ Novo Item'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} style={{ padding: '16px 24px 0 24px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <div className="login-group" style={{ flex: 2, marginBottom: 0 }}>
                <label htmlFor="items-manager-nome">Nome do Item</label>
                <input id="items-manager-nome" type="text" placeholder="Ex: Caneta Marca Texto Amarela" value={formName} onChange={(e) => setFormName(e.target.value)} required />
              </div>
              <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                <label htmlFor="items-manager-unidade">Unidade</label>
                <select id="items-manager-unidade" value={formUnit} onChange={(e) => setFormUnit(e.target.value)}>
                  {formUnit && !unidades.includes(formUnit) && <option value={formUnit}>{formUnit}</option>}
                  {unidades.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                <label htmlFor="items-manager-qtd">Quantidade Inicial</label>
                <input id="items-manager-qtd" type="number" min="0" value={formQty} onChange={(e) => setFormQty(parseInt(e.target.value) || 0)} />
              </div>
              <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                <label htmlFor="items-manager-min">Mínimo de Segurança</label>
                <input id="items-manager-min" type="number" min="0" value={formMinQty} onChange={(e) => setFormMinQty(parseInt(e.target.value) || 0)} />
              </div>
            </div>
            {createItem.isError && (
              <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '-6px', marginBottom: '10px' }}>
                {getComprasErrorMessage(createItem.error, 'Não foi possível cadastrar o item.')}
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
              <button type="submit" className="reports-action-btn primary" style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }} disabled={createItem.isPending}>
                {createItem.isPending ? 'Salvando...' : 'Salvar Item'}
              </button>
            </div>
          </form>
        )}

        <div style={{ padding: '16px 24px 24px 24px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <QueryDataPanel
            query={itemsQuery}
            variant="compact"
            loadingMessage="Carregando itens..."
            errorMessage="Não foi possível carregar os itens. Tente novamente."
          >
            <table className="erp-table reports-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ width: '120px' }}>Unidade</th>
                  <th className="num" style={{ width: '110px' }}>Qtd Atual</th>
                  <th className="num" style={{ width: '110px' }}>Qtd Mínima</th>
                  <th style={{ width: '76px' }}></th>
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontStyle: 'italic' }}>
                      Nenhum item encontrado.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => {
                    const isEditing = editingId === item.id;
                    const isDeleting = deleteItem.isPending && deleteItem.variables === item.id;
                    return (
                      <tr key={item.id}>
                        <td>
                          {isEditing ? (
                            <input
                              type="text"
                              autoFocus
                              value={editForm.nome}
                              onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                              style={{ width: '100%', border: '1px solid #118CC4', borderRadius: '6px', padding: '6px 8px', fontSize: '13px' }}
                            />
                          ) : (
                            item.nome
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <select
                              value={editForm.unidade}
                              onChange={(e) => setEditForm({ ...editForm, unidade: e.target.value })}
                              style={{ width: '100%', border: '1px solid #118CC4', borderRadius: '6px', padding: '6px 8px', fontSize: '13px' }}
                            >
                              {!unidades.includes(editForm.unidade) && <option value={editForm.unidade}>{editForm.unidade}</option>}
                              {unidades.map((u) => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          ) : (
                            item.unidade
                          )}
                        </td>
                        <td className="num">
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              value={editForm.qtdAtual}
                              onChange={(e) => setEditForm({ ...editForm, qtdAtual: Math.max(0, parseInt(e.target.value) || 0) })}
                              style={{ width: '100%', border: '1px solid #118CC4', borderRadius: '6px', padding: '6px 8px', fontSize: '13px', textAlign: 'right' }}
                            />
                          ) : (
                            item.qtdAtual
                          )}
                        </td>
                        <td className="num">
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              value={editForm.qtdMinima}
                              onChange={(e) => setEditForm({ ...editForm, qtdMinima: Math.max(0, parseInt(e.target.value) || 0) })}
                              style={{ width: '100%', border: '1px solid #118CC4', borderRadius: '6px', padding: '6px 8px', fontSize: '13px', textAlign: 'right' }}
                            />
                          ) : (
                            item.qtdMinima
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  className="reports-action-btn-icon"
                                  title="Salvar"
                                  onClick={saveEditing}
                                  disabled={updateItem.isPending}
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
                                  disabled={updateItem.isPending}
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
                                  title="Editar item"
                                  onClick={() => startEditing(item)}
                                >
                                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="reports-action-btn-icon"
                                  title="Excluir item"
                                  disabled={isDeleting}
                                  onClick={() => { if (window.confirm(`Excluir o item "${item.nome}"? Esta ação não pode ser desfeita.`)) deleteItem.mutate(item.id); }}
                                >
                                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
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

export default ItemsManagerModal;
