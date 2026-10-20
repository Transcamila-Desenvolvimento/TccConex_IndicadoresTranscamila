import React, { useState } from 'react';
import QueryDataPanel from '../../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../../hooks/useAsyncQueryState';
import { useMovimentacoesUniforme, useUniformes } from '../../../hooks/useUniformes';
import type { MovimentacaoUniformeFiltros, TipoMovimentacaoUniforme } from '../../../types/domain';
import { formatDateBr, formatDateTimeBr } from './format';
import { BarraPaginacaoServidor, Busca, EmptyRow, TipoMovimentacaoBadge } from './shared';

const TIPOS: Array<[TipoMovimentacaoUniforme, string]> = [
  ['entrada', 'Entrada'],
  ['ajuste', 'Ajuste'],
  ['entrega', 'Entrega'],
  ['devolucao', 'Devolução'],
  ['descarte', 'Descarte'],
  ['perda', 'Perda'],
];

const HistoricoUniformesTab: React.FC<{ buscaInicial?: string }> = ({ buscaInicial = '' }) => {
  const [filtros, setFiltros] = useState<MovimentacaoUniformeFiltros>({
    page: 1, pageSize: 20, q: buscaInicial, tipo: '', uniformeId: '', dataInicio: '', dataFim: '',
  });
  const uniformes = useUniformes().data ?? [];
  const query = useMovimentacoesUniforme(filtros);
  const { canShowEmpty } = useAsyncQueryState(query);
  const movimentacoes = query.data?.results ?? [];
  const filtrar = (patch: Partial<MovimentacaoUniformeFiltros>) => setFiltros((f) => ({ ...f, ...patch, page: 1 }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="reports-filters-bar" style={{ flexShrink: 0 }}>
        <div className="reports-filter-left">
          <Busca value={filtros.q ?? ''} placeholder="Item, colaborador, responsável, observação..." onChange={(q) => filtrar({ q })} />
          <div className="reports-select-wrapper" style={{ minWidth: '150px' }}>
            <select value={filtros.tipo} onChange={(e) => filtrar({ tipo: e.target.value as MovimentacaoUniformeFiltros['tipo'] })}>
              <option value="">Tipo: Todos</option>
              {TIPOS.map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
            </select>
          </div>
          <div className="reports-select-wrapper" style={{ minWidth: '190px' }}>
            <select value={filtros.uniformeId} onChange={(e) => filtrar({ uniformeId: e.target.value })}>
              <option value="">Item: Todos</option>
              {uniformes.map((u) => <option key={u.id} value={u.id}>{u.nome} — {u.tamanho}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569' }}>
            <span>De</span>
            <input type="date" className="form-input" style={{ width: '145px', height: '38px' }} value={filtros.dataInicio} onChange={(e) => filtrar({ dataInicio: e.target.value })} />
            <span>até</span>
            <input type="date" className="form-input" style={{ width: '145px', height: '38px' }} value={filtros.dataFim} onChange={(e) => filtrar({ dataFim: e.target.value })} />
          </div>
          {(filtros.q || filtros.tipo || filtros.uniformeId || filtros.dataInicio || filtros.dataFim) && (
            <button
              type="button"
              className="reports-action-btn secondary"
              style={{ height: '38px' }}
              onClick={() => filtrar({ q: '', tipo: '', uniformeId: '', dataInicio: '', dataFim: '' })}
            >
              Limpar filtros
            </button>
          )}
        </div>
        <div className="reports-filter-right">
          <span className="reports-records-count"><strong>{query.data?.count ?? 0}</strong> Movimentações</span>
        </div>
      </div>

      <QueryDataPanel
        query={query}
        loadingMessage="Carregando histórico..."
        refreshingMessage="Atualizando histórico..."
        errorMessage="Não foi possível carregar o histórico. Tente novamente."
      >
        <div className="erp-card reports-table-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflow: 'auto' }}>
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>O que aconteceu</th>
                  <th>Uniforme</th>
                  <th className="num" style={{ textAlign: 'right' }} title="+ entrou no estoque, − saiu do estoque">Qtd.</th>
                  <th>Colaborador</th>
                  <th>Observação</th>
                  <th>Responsável</th>
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && movimentacoes.length === 0 ? (
                  <EmptyRow colSpan={7}>Nenhuma movimentação encontrada.</EmptyRow>
                ) : (
                  movimentacoes.map((m) => (
                    <tr key={m.id}>
                      <td style={{ color: '#64748b', whiteSpace: 'nowrap' }} title={`Registrado em ${formatDateTimeBr(m.criadoEm)}`}>
                        {formatDateBr(m.data)}
                      </td>
                      <td><TipoMovimentacaoBadge tipo={m.tipo} label={m.tipoLabel} /></td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{m.uniformeNome} — {m.uniformeTamanho}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {m.condicao === 'novo' ? 'Peça nova' : 'Peça usada'}
                        </div>
                      </td>
                      <td
                        className="num"
                        style={{
                          textAlign: 'right', fontWeight: 700,
                          color: m.variacaoEstoque > 0 ? '#10b981' : m.variacaoEstoque < 0 ? '#ef4444' : '#64748b',
                        }}
                        title={`Saldo após: ${m.saldoNovo} novas / ${m.saldoUsado} usadas${m.variacaoEstoque === 0 ? ' (não altera o estoque)' : ''}`}
                      >
                        {m.variacaoEstoque > 0 ? `+${m.quantidade}` : m.variacaoEstoque < 0 ? `−${m.quantidade}` : m.quantidade}
                      </td>
                      <td>{m.colaboradorNome || '—'}</td>
                      <td style={{ color: '#475569', minWidth: '220px', maxWidth: '360px', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                        {m.observacao || '—'}
                      </td>
                      <td style={{ color: '#475569' }}>{m.usuarioNome || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <BarraPaginacaoServidor
          id="uniformes-historico-page-size"
          page={filtros.page}
          pageSize={filtros.pageSize}
          count={query.data?.count ?? 0}
          onPage={(page) => setFiltros((f) => ({ ...f, page }))}
          onPageSize={(pageSize) => setFiltros((f) => ({ ...f, pageSize }))}
        />
      </QueryDataPanel>
    </div>
  );
};

export default HistoricoUniformesTab;
