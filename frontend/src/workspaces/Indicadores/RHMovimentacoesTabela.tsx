import React, { useMemo, useState } from 'react';
import type { RHIndicadorMovimentacao } from '../../types/domain';

type FiltroTipo = '' | RHIndicadorMovimentacao['tipo'];

interface RHMovimentacoesTabelaProps {
  movimentacoes: RHIndicadorMovimentacao[];
}

const formatData = (iso: string | null) => {
  if (!iso) return '—';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
};

const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const RHMovimentacoesTabela: React.FC<RHMovimentacoesTabelaProps> = ({ movimentacoes }) => {
  const [tipo, setTipo] = useState<FiltroTipo>('');
  const [busca, setBusca] = useState('');

  const totais = useMemo(() => ({
    admitidos: movimentacoes.filter((m) => m.tipo === 'ADMITIDO').length,
    desligados: movimentacoes.filter((m) => m.tipo === 'DESLIGADO').length,
  }), [movimentacoes]);

  const linhas = useMemo(() => {
    const termo = normalizar(busca.trim());
    return movimentacoes.filter((m) => (
      (!tipo || m.tipo === tipo)
      && (!termo || normalizar(`${m.nome} ${m.cargo} ${m.filial}`).includes(termo))
    ));
  }, [movimentacoes, tipo, busca]);

  return (
    <div className="erp-card cashflow-chart-card rh-ind-chart-card--wide rh-mov-quadro">
      <div className="rh-mov-quadro-header">
        <h2 className="cashflow-section-title">Admitidos e Desligados</h2>
        <div className="rh-mov-quadro-filtros">
          <select
            className="rh-period-select"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as FiltroTipo)}
            aria-label="Filtrar por tipo de movimentação"
          >
            <option value="">Todos ({movimentacoes.length})</option>
            <option value="ADMITIDO">Admitidos ({totais.admitidos})</option>
            <option value="DESLIGADO">Desligados ({totais.desligados})</option>
          </select>
          <div className="reports-search-wrapper">
            <i className="bi bi-search search-icon" aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar colaborador..."
              title="Busca por nome, cargo ou filial"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar colaborador"
            />
          </div>
        </div>
      </div>

      <div className="reports-table-card sgq-lista-card rh-mov-quadro-card">
        <div className="table-container rh-mov-quadro-scroll">
          <table className="erp-table reports-table">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Movimentação</th>
                <th>Colaborador</th>
                <th>Cargo</th>
                <th>Filial</th>
                <th>Categoria</th>
                <th>Admissão</th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="comercial-browse-empty">
                    {movimentacoes.length
                      ? 'Nenhuma movimentação encontrada para os filtros aplicados.'
                      : 'Não há admissões ou desligamentos no período.'}
                  </td>
                </tr>
              ) : (
                linhas.map((m) => (
                  <tr key={`${m.ano}-${m.mes}-${m.tipo}-${m.nome}-${m.cargo}`}>
                    <td>{m.label}</td>
                    <td>
                      <span className={`rh-mov-badge ${m.tipo === 'ADMITIDO' ? 'is-admitido' : 'is-desligado'}`}>
                        <i className={`bi ${m.tipo === 'ADMITIDO' ? 'bi-arrow-up-right' : 'bi-arrow-down-right'}`} aria-hidden="true" />
                        {m.tipo === 'ADMITIDO' ? 'Admitido' : 'Desligado'}
                      </span>
                    </td>
                    <td className="rh-mov-quadro-nome">{m.nome}</td>
                    <td>{m.cargo || '—'}</td>
                    <td>{m.filial || '—'}</td>
                    <td>{m.categoria || '—'}</td>
                    <td>{formatData(m.dataAdmissao)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RHMovimentacoesTabela;
