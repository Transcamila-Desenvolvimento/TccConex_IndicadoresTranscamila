import React from 'react';
import type { SgqSatisfacaoRecorrenciaEscopo } from '../../types/domain';

type Props = {
  grupos: SgqSatisfacaoRecorrenciaEscopo[];
};

const SgqRecorrenciasEscopoTable: React.FC<Props> = ({ grupos }) => {
  if (!grupos.length) {
    return (
      <p className="cashflow-chart-empty">Nenhuma recorrência de escopo no período selecionado.</p>
    );
  }

  return (
    <div className="table-container">
      <table className="erp-table reports-table sgq-recorrencias-table">
        <thead>
          <tr>
            <th>Escopo</th>
            <th className="num">Recorrência</th>
            <th>Ocorrência</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((grupo) =>
            grupo.itens.map((item, index) => (
              <tr key={`${grupo.escopo}:${item.chave}`}>
                {index === 0 && (
                  <td className="sgq-recorrencias-escopo" rowSpan={grupo.itens.length}>
                    {grupo.label}
                  </td>
                )}
                <td className="num sgq-recorrencias-count">{item.total}</td>
                <td>{item.label}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
};

export default SgqRecorrenciasEscopoTable;
