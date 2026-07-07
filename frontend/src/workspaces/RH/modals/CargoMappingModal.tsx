import React, { useState } from 'react';
import type { CargoMapping } from '../../../types/domain';
import { useCargosRH, useUpdateCargoRH, useDeleteCargoMappingRH } from '../../../hooks/useRH';
import { useAsyncQueryState } from '../../../hooks/useAsyncQueryState';
import QueryDataPanel from '../../../components/QueryDataPanel';

const CATEGORIA_OPTIONS: Array<{ value: CargoMapping['categoria'] | ''; label: string }> = [
  { value: '', label: 'Pendente' },
  { value: 'ADMINISTRATIVO', label: 'Administrativo' },
  { value: 'OPERACIONAL', label: 'Operacional' },
  { value: 'MOTORISTA', label: 'Motorista' },
];

interface CargoMappingModalProps {
  onClose: () => void;
}

const CargoMappingModal: React.FC<CargoMappingModalProps> = ({ onClose }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'pendente' | 'definido'>('');

  const cargosQuery = useCargosRH({ search: search.trim() || undefined, status: statusFilter || undefined });
  const { canShowEmpty } = useAsyncQueryState(cargosQuery);
  const updateCargo = useUpdateCargoRH();
  const deleteCargo = useDeleteCargoMappingRH();

  const cargos = cargosQuery.data ?? [];

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', zIndex: 3000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="search-modal-card" style={{ width: '620px', maxWidth: '92vw', maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}>
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Mapeamento de Cargos</h3>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>Fechar (X)</span>
        </div>

        <div style={{ padding: '16px 24px 0 24px', display: 'flex', gap: '10px' }}>
          <div className="reports-search-wrapper" style={{ flex: 1 }}>
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <input type="text" placeholder="Buscar cargo..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select
            className="rh-period-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | 'pendente' | 'definido')}
          >
            <option value="">Todos</option>
            <option value="pendente">Pendentes</option>
            <option value="definido">Definidos</option>
          </select>
        </div>

        <div style={{ padding: '16px 24px 24px 24px', overflowY: 'auto', flex: 1 }}>
        <QueryDataPanel
          query={cargosQuery}
          variant="compact"
          className="table-container"
          loadingMessage="Carregando cargos..."
          refreshingMessage="Atualizando cargos..."
          errorMessage="Não foi possível carregar os cargos. Tente novamente."
        >
            <table className="erp-table reports-table">
              <thead>
                <tr>
                  <th>Cargo</th>
                  <th>Categoria</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && cargos.length === 0 ? (
                  <tr><td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontStyle: 'italic' }}>Nenhum cargo encontrado.</td></tr>
                ) : (
                  cargos.map((cargo) => (
                    <tr key={cargo.id}>
                      <td>{cargo.cargo}</td>
                      <td>
                        <select
                          className="rh-period-select"
                          value={cargo.categoria ?? ''}
                          onChange={(e) => updateCargo.mutate({ id: cargo.id, categoria: (e.target.value || undefined) as CargoMapping['categoria'] })}
                        >
                          {CATEGORIA_OPTIONS.map((opt) => (
                            <option key={opt.value || 'pendente'} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="reports-action-btn-icon"
                          title="Excluir mapeamento"
                          onClick={() => {
                            if (window.confirm(`Remover o mapeamento do cargo "${cargo.cargo}"?`)) {
                              deleteCargo.mutate(cargo.id);
                            }
                          }}
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
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

export default CargoMappingModal;
