import React, { useState } from 'react';
import QueryDataPanel from '../../../components/QueryDataPanel';
import { userOcultaObservacoesAjustesUniformes } from '../../../constants/funcoes';
import { useAuth } from '../../../contexts/AuthContext';
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
  const { user } = useAuth();
  const ocultarSensivel = userOcultaObservacoesAjustesUniformes(user);
  const tipos = TIPOS.filter(([valor]) => !ocultarSensivel || valor !== 'ajuste');
  const colunas = ocultarSensivel ? 6 : 7;
  const [filtros, setFiltros] = useState<MovimentacaoUniformeFiltros>({
    page: 1, pageSize: 20, q: buscaInicial, tipo: '', uniformeId: '', dataInicio: '', dataFim: '',
  });
  const uniformes = useUniformes().data ?? [];
  const query = useMovimentacoesUniforme(filtros);
  const { canShowEmpty } = useAsyncQueryState(query);
  const movimentacoes = query.data?.results ?? [];
  const filtrar = (patch: Partial<MovimentacaoUniformeFiltros>) => setFiltros((f) => ({ ...f, ...patch, page: 1 }));

  return (
    <div className="uniforme-lista-fixa">
      <div className="reports-filters-bar uniforme-historico-filtros" style={{ flexShrink: 0 }}>
        <div className="reports-filter-left">
          <Busca
            value={filtros.q ?? ''}
            placeholder={ocultarSensivel ? 'Item, colaborador, responsável...' : 'Item, colaborador, responsável, observação...'}
            onChange={(q) => filtrar({ q })}
          />
          <div className="reports-select-wrapper uniforme-filtro-tipo">
            <select value={filtros.tipo} onChange={(e) => filtrar({ tipo: e.target.value as MovimentacaoUniformeFiltros['tipo'] })}>
              <option value="">Tipo: Todos</option>
              {tipos.map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
            </select>
          </div>
          <div className="reports-select-wrapper uniforme-filtro-item">
            <select value={filtros.uniformeId} onChange={(e) => filtrar({ uniformeId: e.target.value })}>
              <option value="">Item: Todos</option>
              {uniformes.map((u) => <option key={u.id} value={u.id}>{u.nome} — {u.tamanho}</option>)}
            </select>
          </div>
          <label className="uniforme-filtro-data">
            <span>De</span>
            <input type="date" aria-label="Data inicial" value={filtros.dataInicio} onChange={(e) => filtrar({ dataInicio: e.target.value })} />
          </label>
          <label className="uniforme-filtro-data">
            <span>Até</span>
            <input type="date" aria-label="Data final" value={filtros.dataFim} onChange={(e) => filtrar({ dataFim: e.target.value })} />
          </label>
          {(filtros.q || filtros.tipo || filtros.uniformeId || filtros.dataInicio || filtros.dataFim) && (
            <button
              type="button"
              className="reports-action-btn secondary"
              onClick={() => filtrar({ q: '', tipo: '', uniformeId: '', dataInicio: '', dataFim: '' })}
            >
              Limpar
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
        <div className="table-container">
            <table className="reports-table uniforme-listagem">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>O que aconteceu</th>
                  <th>Uniforme</th>
                  <th className="num" style={{ textAlign: 'right' }} title="+ entrou no estoque, − saiu do estoque">Qtd.</th>
                  <th>Colaborador</th>
                  {!ocultarSensivel && <th>Observação</th>}
                  <th>Responsável</th>
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && movimentacoes.length === 0 ? (
                  <EmptyRow colSpan={colunas}>Nenhuma movimentação encontrada.</EmptyRow>
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
                      {!ocultarSensivel && (
                        <td style={{ color: '#475569', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                          {m.observacao || '—'}
                        </td>
                      )}
                      <td style={{ color: '#475569' }}>{m.usuarioNome || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
