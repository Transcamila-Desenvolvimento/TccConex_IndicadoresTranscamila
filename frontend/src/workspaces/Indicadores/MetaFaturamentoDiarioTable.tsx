import React from 'react';
import type { MetaFaturamentoSerieDiariaPayload } from '../../types/domain';

interface MetaFaturamentoDiarioTableProps {
  payload: MetaFaturamentoSerieDiariaPayload;
  ano: number;
  titulo: string;
}

/** Valores densos: sem "R$" para caber melhor; zero vira célula vazia. */
const formatMoney = (value: number, dashZero = true) => {
  if (dashZero && value === 0) return '';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '';
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
};

const gapClass = (value: number) => (value > 0 ? 'is-up' : value < 0 ? 'is-down' : '');

const obsLabel = (obs: string) => {
  if (obs === 'ACIMA DA META') return 'Acima';
  if (obs === 'ABAIXO DA META') return 'Abaixo';
  return '';
};

const MetaFaturamentoDiarioTable: React.FC<MetaFaturamentoDiarioTableProps> = ({
  payload,
  ano,
  titulo,
}) => {
  const { dias, totais } = payload;
  const anoAnt = ano - 1;

  if (!dias.length) {
    return (
      <div className="erp-card reports-table-card cashflow-table-card meta-fat-daily-card">
        <h2 className="cashflow-section-title cashflow-section-title--table">{titulo}</h2>
        <p className="cashflow-chart-empty">Sem lançamentos diários neste mês.</p>
      </div>
    );
  }

  return (
    <div className="erp-card reports-table-card cashflow-table-card meta-fat-daily-card">
      <div className="meta-fat-daily-head">
        <h2 className="cashflow-section-title cashflow-section-title--table">{titulo}</h2>
        <span className="meta-fat-daily-unit">Valores em R$</span>
      </div>
      <div className="table-container meta-fat-daily-scroll">
        <table className="erp-table reports-table meta-fat-daily-table">
          <thead>
            <tr>
              <th className="meta-fat-col-dia">Dia</th>
              <th className="num">Ibiporã</th>
              <th className="num">Rondonópolis</th>
              <th className="num">Barueri</th>
              <th className="num">Paranaguá</th>
              <th className="num meta-fat-group-start">Fretes</th>
              <th className="num">Armazém</th>
              <th className="num">Receita</th>
              <th className="num meta-fat-group-start">Acum. {ano}</th>
              <th className="num">Acum. {anoAnt}</th>
              <th className="num meta-fat-group-start">Meta até o dia</th>
              <th className="num">Real {ano}</th>
              <th className="num">Real {anoAnt}</th>
              <th className="num meta-fat-group-start">vs Meta</th>
              <th className="num">%</th>
              <th>Obs.</th>
            </tr>
          </thead>
          <tbody>
            {dias.map((dia) => {
              const obs = obsLabel(dia.observacao);
              return (
                <tr key={dia.data} className={!dia.isDiaUtil ? 'is-weekend' : undefined}>
                  <td className="meta-fat-col-dia">{dia.dia}</td>
                  <td className="num">{formatMoney(dia.ibipora)}</td>
                  <td className="num">{formatMoney(dia.rondonopolis)}</td>
                  <td className="num">{formatMoney(dia.barueri)}</td>
                  <td className="num">{formatMoney(dia.paranagua)}</td>
                  <td className="num meta-fat-group-start">{formatMoney(dia.totalFretes)}</td>
                  <td className="num">{formatMoney(dia.armazem)}</td>
                  <td className="num">{formatMoney(dia.receitaDia)}</td>
                  <td className="num meta-fat-group-start">{formatMoney(dia.acumuladoMes, false)}</td>
                  <td className="num">{formatMoney(dia.acumuladoMesAnoAnterior)}</td>
                  <td className="num meta-fat-group-start">{formatMoney(dia.metaAnoAteDia, false)}</td>
                  <td className="num">{formatMoney(dia.realizadoAno, false)}</td>
                  <td className="num">{formatMoney(dia.realizadoAnoAnteriorAcumulado)}</td>
                  <td className={`num meta-fat-group-start ${gapClass(dia.gapMetaAnoAteDia)}`}>
                    {formatMoney(dia.gapMetaAnoAteDia, false)}
                  </td>
                  <td className={`num ${gapClass(dia.percentualVsMetaAnoAteDia ?? 0)}`}>
                    {formatPercent(dia.percentualVsMetaAnoAteDia)}
                  </td>
                  <td>
                    {obs ? (
                      <span className={`meta-fat-obs-badge ${gapClass(dia.gapMetaAnoAteDia)}`}>{obs}</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {totais && (
            <tfoot>
              <tr className="meta-fat-total-row">
                <td className="meta-fat-col-dia">Total</td>
                <td className="num">{formatMoney(totais.ibipora, false)}</td>
                <td className="num">{formatMoney(totais.rondonopolis, false)}</td>
                <td className="num">{formatMoney(totais.barueri, false)}</td>
                <td className="num">{formatMoney(totais.paranagua, false)}</td>
                <td className="num meta-fat-group-start">{formatMoney(totais.totalFretes, false)}</td>
                <td className="num">{formatMoney(totais.armazem, false)}</td>
                <td className="num">{formatMoney(totais.receitaDia, false)}</td>
                <td className="num meta-fat-group-start">{formatMoney(totais.acumuladoMes, false)}</td>
                <td className="num">{formatMoney(totais.acumuladoMesAnoAnterior, false)}</td>
                <td className="num meta-fat-group-start">{formatMoney(totais.metaAnoAteDia, false)}</td>
                <td className="num">{formatMoney(totais.realizadoAno, false)}</td>
                <td className="num">{formatMoney(totais.realizadoAnoAnteriorAcumulado, false)}</td>
                <td className={`num meta-fat-group-start ${gapClass(totais.gapMetaAnoAteDia)}`}>
                  {formatMoney(totais.gapMetaAnoAteDia, false)}
                </td>
                <td className={`num ${gapClass(totais.percentualVsMetaAnoAteDia ?? 0)}`}>
                  {formatPercent(totais.percentualVsMetaAnoAteDia)}
                </td>
                <td>
                  {obsLabel(totais.observacao) ? (
                    <span className={`meta-fat-obs-badge ${gapClass(totais.gapMetaAnoAteDia)}`}>
                      {obsLabel(totais.observacao)}
                    </span>
                  ) : null}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default MetaFaturamentoDiarioTable;
