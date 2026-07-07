import React, { useState } from 'react';
import {
  useItensEstoque,
  useSetoresCompras,
  useColaboradoresCompras,
  useRegistrarSaida,
  getComprasErrorMessage,
} from '../../../hooks/useCompras';

interface SaidaLineForm {
  itemId: string;
  qty: number;
}

interface SaidaModalProps {
  initialItemId?: string;
  onClose: () => void;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const SaidaModal: React.FC<SaidaModalProps> = ({ initialItemId, onClose }) => {
  const itensQuery = useItensEstoque();
  const setoresQuery = useSetoresCompras();
  const colaboradoresQuery = useColaboradoresCompras();
  const registrarSaida = useRegistrarSaida();

  const stockItems = itensQuery.data ?? [];
  const setores = setoresQuery.data ?? [];
  const colaboradores = colaboradoresQuery.data ?? [];
  const isLoadingOptions = itensQuery.isLoading || setoresQuery.isLoading || colaboradoresQuery.isLoading;

  const [date, setDate] = useState(todayIso());
  const [setorId, setSetorId] = useState('');
  const [colaboradorId, setColaboradorId] = useState('');
  const [lines, setLines] = useState<SaidaLineForm[]>(() =>
    initialItemId ? [{ itemId: initialItemId, qty: 1 }] : [{ itemId: '', qty: 1 }],
  );

  const usedIds = (excludeIndex: number) => lines.filter((_, i) => i !== excludeIndex).map((l) => l.itemId);

  const addLine = () => {
    const currentlyUsed = new Set(lines.map((l) => l.itemId));
    const nextItem = stockItems.find((item) => !currentlyUsed.has(item.id));
    if (!nextItem) {
      alert('Todos os itens do estoque já foram adicionados a este protocolo.');
      return;
    }
    setLines([...lines, { itemId: nextItem.id, qty: 1 }]);
  };

  const updateLine = (index: number, patch: Partial<SaidaLineForm>) => {
    setLines(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!setorId || !colaboradorId) {
      alert('Informe o setor e o colaborador responsável pela retirada.');
      return;
    }
    if (lines.length === 0) {
      alert('Adicione ao menos um item ao protocolo.');
      return;
    }
    if (lines.some((line) => !line.itemId || line.qty <= 0)) {
      alert('Verifique se todos os itens têm uma quantidade maior que zero.');
      return;
    }

    for (const line of lines) {
      const item = stockItems.find((i) => i.id === line.itemId);
      if (item && item.qtdAtual < line.qty) {
        alert(`Quantidade indisponível para "${item.nome}"! Saldo atual de ${item.qtdAtual} ${item.unidade}.`);
        return;
      }
    }

    registrarSaida.mutate(
      {
        data: date || todayIso(),
        setorId,
        colaboradorId,
        linhas: lines.map((line) => ({ itemId: line.itemId, quantidade: line.qty })),
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
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Protocolo de Saída de Materiais</h3>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>Fechar (X)</span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ padding: '20px 24px 0 24px' }}>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '14px' }}>
              <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                <label htmlFor="estoque-saida-data">Data *</label>
                <input id="estoque-saida-data" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                <label htmlFor="estoque-saida-setor">Setor *</label>
                <select id="estoque-saida-setor" value={setorId} onChange={(e) => setSetorId(e.target.value)} required>
                  <option value="" disabled>
                    {setoresQuery.isLoading ? 'Carregando...' : setores.length === 0 ? 'Nenhum setor cadastrado' : 'Selecione um setor'}
                  </option>
                  {setores.map((s) => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </div>
              <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                <label htmlFor="estoque-saida-colaborador">Colaborador *</label>
                <select id="estoque-saida-colaborador" value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)} required>
                  <option value="" disabled>
                    {colaboradoresQuery.isLoading ? 'Carregando...' : colaboradores.length === 0 ? 'Nenhum colaborador cadastrado' : 'Selecione um colaborador'}
                  </option>
                  {colaboradores.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Itens da Saída
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
                  <th className="num" style={{ width: '100px' }}>Saldo Atual</th>
                  <th className="num" style={{ width: '90px' }}>Qtd. a Retirar</th>
                  <th style={{ width: '44px' }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontStyle: 'italic' }}>
                      Nenhum item adicionado.
                    </td>
                  </tr>
                ) : (
                  lines.map((line, index) => {
                    const item = stockItems.find((i) => i.id === line.itemId);
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
                        <td className="num" style={{ color: '#64748b' }}>
                          {item ? `${item.qtdAtual} ${item.unidade}` : '—'}
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
            {registrarSaida.isError && (
              <span style={{ color: '#ef4444', fontSize: '12px' }}>
                {getComprasErrorMessage(registrarSaida.error, 'Não foi possível registrar a saída. Tente novamente.')}
              </span>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="reports-action-btn primary"
                style={{ backgroundColor: '#ef4444', borderColor: '#ef4444' }}
                disabled={registrarSaida.isPending || isLoadingOptions}
              >
                {registrarSaida.isPending ? 'Registrando...' : 'Registrar Saída'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SaidaModal;
