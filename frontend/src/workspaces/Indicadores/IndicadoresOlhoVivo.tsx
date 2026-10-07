import React, { useMemo, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { branchesForModule } from '../../constants/filiais';
import { useIndicadorOlhoVivo } from '../../hooks/useIndicadores';
import type { OlhoVivoIndicadorFilial, OlhoVivoIndicadorMes } from '../../types/domain';
import IndicadoresOlhoVivoChart from './IndicadoresOlhoVivoChart';

const ANO_INICIAL = 2019;
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const formatRecorrencia = (value: number | null | undefined) =>
  value == null ? '—' : value.toLocaleString('pt-BR');

const celula = (mes: OlhoVivoIndicadorMes | undefined, comportamento: string) => {
  if (!mes?.respondido) return null;
  return mes.itens.find((item) => item.comportamento === comportamento)?.recorrencia ?? 0;
};

const IndicadoresOlhoVivo: React.FC = () => {
  const anoAtual = new Date().getFullYear();
  const anos = useMemo(
    () => Array.from({ length: anoAtual - ANO_INICIAL + 1 }, (_, index) => anoAtual - index),
    [anoAtual],
  );
  const [ano, setAno] = useState(anoAtual);
  const [filial, setFilial] = useState('');
  const filiaisFrota = branchesForModule('Frota');

  const query = useIndicadorOlhoVivo({
    ano,
    ...(filial ? { filial } : {}),
  });
  const data = query.data;
  const resumo = data?.resumo;
  const filiais = data?.filiais ?? [];
  const comportamentos = data?.comportamentos ?? [];

  return (
    <div className="cashflow-page">
      <header className="view-header cashflow-header">
        <div>
          <h1>Olho vivo na estrada</h1>
          <p>Quais comportamentos se repetem, em qual filial e em que mês.</p>
        </div>
      </header>

      <div className="reports-filters-bar">
        <div className="reports-filter-left" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="rh-period-select"
            value={ano}
            onChange={(event) => setAno(Number(event.target.value))}
            aria-label="Ano"
          >
            {anos.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <select
            className="rh-period-select"
            value={filial}
            onChange={(event) => setFilial(event.target.value)}
            aria-label="Filial"
          >
            <option value="">Todas as filiais</option>
            {filiaisFrota.map((nome) => (
              <option key={nome} value={nome}>{nome}</option>
            ))}
          </select>

          <button
            type="button"
            className="reports-action-btn secondary cashflow-filter-reset"
            onClick={() => {
              setAno(anoAtual);
              setFilial('');
            }}
          >
            Limpar
          </button>
        </div>
      </div>

      <QueryDataPanel
        query={query}
        variant="compact"
        fullPageLoader
        refreshVariant="overlay"
        loadingMessage="Carregando Olho vivo na estrada..."
        refreshingMessage="Atualizando indicador..."
        errorMessage="Não foi possível carregar o indicador. Tente novamente."
      >
        {resumo && (
          <>
            <div className="cashflow-kpi-grid rh-ind-kpi-grid">
              <div className="cashflow-kpi-card">
                <span className="cashflow-kpi-label">Recorrências no ano</span>
                <strong className="cashflow-kpi-value">{resumo.total.toLocaleString('pt-BR')}</strong>
                <span className="cashflow-kpi-hint">{ano}</span>
              </div>
              {filiais.map((item) => (
                <div className="cashflow-kpi-card" key={item.filial}>
                  <span className="cashflow-kpi-label">{item.filial}</span>
                  <strong className="cashflow-kpi-value">{item.total.toLocaleString('pt-BR')}</strong>
                  <span className="cashflow-kpi-hint">{item.mesesRespondidos} de 12 meses</span>
                </div>
              ))}
              {resumo.comportamentoDestaque && (
                <div className="cashflow-kpi-card">
                  <span className="cashflow-kpi-label">Mais recorrente</span>
                  <strong className="cashflow-kpi-value">
                    {resumo.comportamentoDestaque.recorrencia.toLocaleString('pt-BR')}
                  </strong>
                  <span className="cashflow-kpi-hint">{resumo.comportamentoDestaque.label}</span>
                </div>
              )}
            </div>

            <IndicadoresOlhoVivoChart comportamentos={comportamentos} filiais={filiais} />

            {filiais.map((item) => (
              <GradeFilial
                key={item.filial}
                filial={item}
                comportamentos={comportamentos}
              />
            ))}
          </>
        )}
      </QueryDataPanel>
    </div>
  );
};

const GradeFilial: React.FC<{
  filial: OlhoVivoIndicadorFilial;
  comportamentos: { key: string; label: string }[];
}> = ({ filial, comportamentos }) => {
  const meses = filial.meses;

  return (
    <div className="cashflow-chart-card">
      <h2 className="cashflow-section-title">{filial.filial}</h2>
      <div className="olho-vivo-ind-scroll">
        <table className="olho-vivo-ind-tabela">
          <thead>
            <tr>
              <th>Comportamento</th>
              {MESES_CURTOS.map((nome) => (
                <th key={nome}>{nome}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {comportamentos.map((comportamento) => {
              const anual = filial.itens.find((item) => item.comportamento === comportamento.key)?.recorrencia ?? 0;
              return (
                <tr key={comportamento.key}>
                  <td>{comportamento.label}</td>
                  {meses.map((mes) => {
                    const valor = celula(mes, comportamento.key);
                    return (
                      <td key={mes.mes} className={valor == null ? 'olho-vivo-ind-vazio' : undefined}>
                        {formatRecorrencia(valor)}
                      </td>
                    );
                  })}
                  <td>{formatRecorrencia(anual)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              {meses.map((mes) => (
                <td key={mes.mes} className={mes.respondido ? undefined : 'olho-vivo-ind-vazio'}>
                  {formatRecorrencia(mes.respondido ? mes.total : null)}
                </td>
              ))}
              <td>{formatRecorrencia(filial.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default IndicadoresOlhoVivo;
