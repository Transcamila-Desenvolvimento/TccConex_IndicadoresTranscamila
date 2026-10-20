import React, { useEffect, useState } from 'react';
import QueryDataPanel from '../../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../../hooks/useAsyncQueryState';
import { useColaboradoresUniformes } from '../../../hooks/useUniformes';
import type { ColaboradorUniformes } from '../../../types/domain';
import { formatDateBr } from './format';
import { BarraPaginacaoServidor, Busca, EmptyRow } from './shared';

const ColaboradoresUniformesTab: React.FC<{ onAbrir: (colaborador: ColaboradorUniformes) => void }> = ({ onAbrir }) => {
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [somenteEmPosse, setSomenteEmPosse] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const timer = setTimeout(() => { setBuscaAplicada(busca.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  const query = useColaboradoresUniformes({ page, pageSize, q: buscaAplicada || undefined, somenteEmPosse });
  const { canShowEmpty } = useAsyncQueryState(query);
  const linhas = query.data?.results ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="reports-filters-bar" style={{ flexShrink: 0 }}>
        <div className="reports-filter-left">
          <Busca value={busca} placeholder="Buscar nome, CPF, setor ou nº do termo (TRU-...)" onChange={setBusca} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={somenteEmPosse}
              onChange={(e) => { setSomenteEmPosse(e.target.checked); setPage(1); }}
            />
            Só quem está com uniformes
          </label>
        </div>
        <div className="reports-filter-right">
          <span className="reports-records-count"><strong>{query.data?.count ?? 0}</strong> Colaboradores</span>
        </div>
      </div>

      <QueryDataPanel
        query={query}
        loadingMessage="Carregando colaboradores..."
        refreshingMessage="Atualizando colaboradores..."
        errorMessage="Não foi possível carregar os colaboradores. Tente novamente."
      >
        <div className="erp-card reports-table-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Setor</th>
                  <th className="num" style={{ textAlign: 'right' }}>Peças com ele</th>
                  <th className="num" style={{ textAlign: 'right' }}>Entregas</th>
                  <th>Última entrega</th>
                  <th style={{ width: '110px' }} />
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && linhas.length === 0 ? (
                  <EmptyRow colSpan={6}>
                    {somenteEmPosse && !buscaAplicada
                      ? 'Nenhum colaborador está com uniformes no momento. Use "Nova entrega" para registrar a primeira.'
                      : 'Nenhum colaborador encontrado.'}
                  </EmptyRow>
                ) : (
                  linhas.map((c) => (
                    <tr key={c.colaboradorId} onClick={() => onAbrir(c)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{c.nome}</div>
                        {c.cargo && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{c.cargo}</div>}
                      </td>
                      <td style={{ color: '#475569' }}>{c.setorNome || '—'}</td>
                      <td className="num" style={{ textAlign: 'right', fontWeight: 700, color: c.pecasEmPosse ? '#0f85c1' : '#94a3b8' }}>
                        {c.pecasEmPosse}
                      </td>
                      <td className="num" style={{ textAlign: 'right' }}>{c.totalEntregas}</td>
                      <td style={{ color: '#64748b' }}>{c.ultimaEntrega ? formatDateBr(c.ultimaEntrega) : '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button type="button" className="btn-table-action" onClick={(e) => { e.stopPropagation(); onAbrir(c); }}>
                          Ver uniformes
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <BarraPaginacaoServidor
          id="uniformes-colaboradores-page-size"
          page={page}
          pageSize={pageSize}
          count={query.data?.count ?? 0}
          onPage={setPage}
          onPageSize={setPageSize}
        />
      </QueryDataPanel>
    </div>
  );
};

export default ColaboradoresUniformesTab;
