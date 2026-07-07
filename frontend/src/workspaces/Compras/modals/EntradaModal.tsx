import React, { useState } from 'react';
import { useItensEstoque, useFornecedores, useRegistrarCompra, getComprasErrorMessage } from '../../../hooks/useCompras';

interface EntradaLineForm {
  itemId: string;
  qty: number;
  unitValue: number;
}

interface EntradaModalProps {
  initialItemId?: string;
  onClose: () => void;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const EntradaModal: React.FC<EntradaModalProps> = ({ initialItemId, onClose }) => {
  const itensQuery = useItensEstoque();
  const fornecedoresQuery = useFornecedores();
  const registrarCompra = useRegistrarCompra();

  const stockItems = itensQuery.data ?? [];
  const fornecedores = fornecedoresQuery.data ?? [];
  const isLoadingOptions = itensQuery.isLoading || fornecedoresQuery.isLoading;

  const [date, setDate] = useState(todayIso());
  const [fornecedorId, setFornecedorId] = useState('');
  const [lines, setLines] = useState<EntradaLineForm[]>(() =>
    initialItemId ? [{ itemId: initialItemId, qty: 1, unitValue: 0 }] : [{ itemId: '', qty: 1, unitValue: 0 }],
  );

  const usedIds = (excludeIndex: number) => lines.filter((_, i) => i !== excludeIndex).map((l) => l.itemId);

  const addLine = () => {
    const currentlyUsed = new Set(lines.map((l) => l.itemId));
    const nextItem = stockItems.find((item) => !currentlyUsed.has(item.id));
    if (!nextItem) {
      alert('Todos os itens do estoque já foram adicionados a esta compra.');
      return;
    }
    setLines([...lines, { itemId: nextItem.id, qty: 1, unitValue: 0 }]);
  };

  const updateLine = (index: number, patch: Partial<EntradaLineForm>) => {
    setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const total = lines.reduce((sum, line) => sum + line.qty * line.unitValue, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fornecedorId) {
      alert('Selecione o fornecedor da compra.');
      return;
    }
    if (lines.length === 0) {
      alert('Adicione ao menos um item à compra.');
      return;
    }
    if (lines.some((line) => !line.itemId || line.qty <= 0)) {
      alert('Verifique se todos os itens têm uma quantidade maior que zero.');
      return;
    }

    registrarCompra.mutate(
      {
        data: date || todayIso(),
        fornecedorId,
        linhas: lines.map((line) => ({ itemId: line.itemId, quantidade: line.qty, valorUnitario: line.unitValue })),
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', alignItems: 'center', padding: '24px 16px', zIndex: 3000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="search-modal-card" style={{ width: '680px', maxWidth: '94vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Registrar Entrada / Nova Compra</h3>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>Fechar (X)</span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ padding: '20px 24px 0 24px' }}>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '14px' }}>
              <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                <label htmlFor="estoque-entrada-data">Data da Compra *</label>
                <input id="estoque-entrada-data" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                <label htmlFor="estoque-entrada-fornecedor">Fornecedor *</label>
                <select
                  id="estoque-entrada-fornecedor"
                  value={fornecedorId}
                  onChange={(e) => setFornecedorId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    {fornecedoresQuery.isLoading ? 'Carregando...' : fornecedores.length === 0 ? 'Nenhum fornecedor cadastrado' : 'Selecione um fornecedor'}
                  </option>
                  {fornecedores.map((f) => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Itens da Compra
              </label>
              <button
                type="button"
                className="reports-action-btn secondary"
                style={{ height: '30px', fontSize: '12px', padding: '0 12px' }}
                onClick={addLine}
                disabled={isLoadingOptions}
              >
                + Adicionar Item
              </button>
            </div>
          </div>

          <div style={{ padding: '0 24px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
            <table className="erp-table reports-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num" style={{ width: '90px' }}>Qtd.</th>
                  <th className="num" style={{ width: '120px' }}>Valor Unit. (R$)</th>
                  <th className="num" style={{ width: '110px' }}>Subtotal</th>
                  <th style={{ width: '44px' }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontStyle: 'italic' }}>
                      Nenhum item adicionado.
                    </td>
                  </tr>
                ) : (
                  lines.map((line, index) => {
                    const excluded = usedIds(index);
                    return (
                      <tr key={index}>
                        <td>
                          <select
                            value={line.itemId}
                            onChange={(e) => updateLine(index, { itemId: e.target.value })}
                            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 8px', fontSize: '13px' }}
                          >
                            <option value="" disabled>{itensQuery.isLoading ? 'Carregando...' : 'Selecione um item'}</option>
                            {stockItems
                              .filter((i) => !excluded.includes(i.id))
                              .map((i) => (
                                <option key={i.id} value={i.id}>{i.nome}</option>
                              ))}
                          </select>
                        </td>
                        <td className="num">
                          <input
                            type="number"
                            min="1"
                            value={line.qty}
                            onChange={(e) => updateLine(index, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
                            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 8px', fontSize: '13px', textAlign: 'right' }}
                          />
                        </td>
                        <td className="num">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitValue}
                            onChange={(e) => updateLine(index, { unitValue: Math.max(0, parseFloat(e.target.value) || 0) })}
                            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 8px', fontSize: '13px', textAlign: 'right' }}
                          />
                        </td>
                        <td className="num" style={{ fontWeight: 600, color: '#334155' }}>
                          {(line.qty * line.unitValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="reports-action-btn-icon"
                            title="Remover item"
                            disabled={lines.length === 1}
                            style={{ opacity: lines.length === 1 ? 0.4 : 1, cursor: lines.length === 1 ? 'not-allowed' : 'pointer' }}
                            onClick={() => removeLine(index)}
                          >
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '14px 24px 20px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
            {registrarCompra.isError && (
              <span style={{ color: '#ef4444', fontSize: '12px' }}>
                {getComprasErrorMessage(registrarCompra.error, 'Não foi possível registrar a compra. Tente novamente.')}
              </span>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Total da compra: <strong style={{ color: '#1e293b' }}>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </span>
              <button
                type="submit"
                className="reports-action-btn primary"
                style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
                disabled={registrarCompra.isPending || isLoadingOptions}
              >
                {registrarCompra.isPending ? 'Registrando...' : 'Registrar Entrada de Compra'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EntradaModal;
