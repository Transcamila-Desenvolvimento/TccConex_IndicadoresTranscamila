import React, { useMemo } from 'react';
import type { SgqAvaliacao, SgqCriterioStats } from '../../types/domain';

const AVALIACOES: SgqAvaliacao[] = ['otimo', 'bom', 'regular', 'ruim'];
const AVALIACAO_LABEL: Record<SgqAvaliacao, string> = {
  otimo: 'Ótimo',
  bom: 'Bom',
  regular: 'Regular',
  ruim: 'Ruim',
};

function formatInt(n: number): string {
  return n.toLocaleString('pt-BR');
}

function formatPct(n: number): string {
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function pctOf(count: number, total: number): number {
  if (!total) return 0;
  return (count / total) * 100;
}

interface Props {
  totalPesquisas: number;
  criterios: SgqCriterioStats[];
}

/**
 * Mesmos cálculos do relatório clássico de satisfação, com a estética das
 * tabelas dos indicadores (erp-table / reports-table).
 * - % por critério = quantidade / total de pesquisas
 * - Perfil geral = soma; % = soma / (total pesquisas × nº critérios)
 */
const SgqPerfilAvaliacoesTable: React.FC<Props> = ({ totalPesquisas, criterios }) => {
  const perfil = useMemo(() => {
    const totais: Record<SgqAvaliacao, number> = {
      otimo: 0,
      bom: 0,
      regular: 0,
      ruim: 0,
    };
    for (const c of criterios) {
      totais.otimo += c.otimo;
      totais.bom += c.bom;
      totais.regular += c.regular;
      totais.ruim += c.ruim;
    }
    return { totais, denomPerfil: totalPesquisas * criterios.length };
  }, [criterios, totalPesquisas]);

  return (
    <div className="sgq-perfil-block">
      <div className="sgq-perfil-meta">
        <span className="sgq-perfil-meta-label">Total de avaliações</span>
        <strong className="sgq-perfil-meta-value">{formatInt(totalPesquisas)}</strong>
      </div>

      <div className="table-container">
        <table className="erp-table reports-table sgq-perfil-table">
          <thead>
            <tr>
              <th style={{ width: '22%' }}>Critério</th>
              {AVALIACOES.map((aval) => (
                <th key={aval} colSpan={2} className={`sgq-perfil-col is-${aval} sgq-perfil-group-start`}>
                  {AVALIACAO_LABEL[aval]}
                </th>
              ))}
            </tr>
            <tr>
              <th aria-hidden="true" />
              {AVALIACOES.map((aval) => (
                <React.Fragment key={`${aval}-sub`}>
                  <th className={`sgq-perfil-col is-${aval} sgq-perfil-sub sgq-perfil-group-start`}>Qtd</th>
                  <th className={`sgq-perfil-col is-${aval} sgq-perfil-sub`}>%</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {criterios.map((criterio) => (
              <tr key={criterio.campo}>
                <td style={{ fontWeight: 600 }}>{criterio.label}</td>
                {AVALIACOES.map((aval) => {
                  const qtd = criterio[aval];
                  return (
                    <React.Fragment key={`${criterio.campo}-${aval}`}>
                      <td className="num sgq-perfil-group-start">{formatInt(qtd)}</td>
                      <td className="num sgq-perfil-pct">{formatPct(pctOf(qtd, totalPesquisas))}</td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
            <tr className="sgq-perfil-total-row">
              <td style={{ fontWeight: 700 }}>Perfil geral</td>
              {AVALIACOES.map((aval) => {
                const qtd = perfil.totais[aval];
                return (
                  <React.Fragment key={`geral-${aval}`}>
                    <td className="num sgq-perfil-group-start" style={{ fontWeight: 700 }}>{formatInt(qtd)}</td>
                    <td className="num sgq-perfil-pct" style={{ fontWeight: 700 }}>
                      {formatPct(pctOf(qtd, perfil.denomPerfil))}
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SgqPerfilAvaliacoesTable;
