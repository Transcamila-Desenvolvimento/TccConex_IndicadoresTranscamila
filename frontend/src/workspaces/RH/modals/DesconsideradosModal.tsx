import React, { useState } from 'react';
import { useColaboradoresRH, useToggleDesconsiderarRH } from '../../../hooks/useRH';
import { useAsyncQueryState } from '../../../hooks/useAsyncQueryState';
import QueryDataPanel from '../../../components/QueryDataPanel';

interface DesconsideradosModalProps {
  onClose: () => void;
}

const DesconsideradosModal: React.FC<DesconsideradosModalProps> = ({ onClose }) => {
  const [search, setSearch] = useState('');
  const [onlyDesconsiderados, setOnlyDesconsiderados] = useState(false);

  const colaboradoresQuery = useColaboradoresRH({
    search: search.trim() || undefined,
    desconsiderados: onlyDesconsiderados,
  });
  const { canShowEmpty } = useAsyncQueryState(colaboradoresQuery);
  const toggleDesconsiderar = useToggleDesconsiderarRH();

  const colaboradores = colaboradoresQuery.data ?? [];

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', zIndex: 3000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="search-modal-card" style={{ width: '980px', maxWidth: '95vw', maxHeight: '84vh', display: 'flex', flexDirection: 'column' }}>
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Colaboradores Desconsiderados</h3>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>Fechar (X)</span>
        </div>

        <p style={{ fontSize: '12.5px', color: '#64748b', padding: '16px 24px 0 24px', margin: 0, lineHeight: 1.6 }}>
          Colaboradores marcados como desconsiderados são excluídos de todos os cálculos e listagens de movimentações e indicadores de RH.
        </p>

        <div style={{ padding: '12px 24px 0 24px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div className="reports-search-wrapper" style={{ flex: 1 }}>
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <input type="text" placeholder="Buscar por nome, CPF ou matrícula..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#475569', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={onlyDesconsiderados} onChange={(e) => setOnlyDesconsiderados(e.target.checked)} />
            Somente desconsiderados
          </label>
        </div>

        <div style={{ padding: '16px 24px 24px 24px', overflowY: 'auto', flex: 1 }}>
        <QueryDataPanel
          query={colaboradoresQuery}
          variant="compact"
          className="table-container"
          loadingMessage="Carregando colaboradores..."
          refreshingMessage="Atualizando colaboradores..."
          errorMessage="Não foi possível carregar os colaboradores. Tente novamente."
        >
            <table className="erp-table reports-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '220px' }}>Nome</th>
                  <th style={{ minWidth: '110px' }}>CPF</th>
                  <th style={{ minWidth: '200px' }}>Cargo</th>
                  <th style={{ minWidth: '140px' }}>Filial</th>
                  <th style={{ minWidth: '120px' }}>Status</th>
                  <th style={{ minWidth: '110px' }}></th>
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && colaboradores.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontStyle: 'italic' }}>Nenhum colaborador encontrado.</td></tr>
                ) : (
                  colaboradores.map((colab) => (
                    <tr key={colab.id}>
                      <td><strong>{colab.nomeCompleto}</strong></td>
                      <td>{colab.cpf}</td>
                      <td>{colab.cargo || '—'}</td>
                      <td>{colab.filial || '—'}</td>
                      <td>
                        <span className={`status-badge ${colab.desconsiderado ? 'inativo' : 'success'}`}>
                          {colab.desconsiderado ? 'Desconsiderado' : 'Considerado'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="reports-action-btn secondary"
                          style={{ height: '28px', fontSize: '11.5px', padding: '0 10px' }}
                          onClick={() => toggleDesconsiderar.mutate(colab.id)}
                        >
                          {colab.desconsiderado ? 'Reconsiderar' : 'Desconsiderar'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
        </QueryDataPanel>
        </div>
      </div>
    </div>
  );
};

export default DesconsideradosModal;
