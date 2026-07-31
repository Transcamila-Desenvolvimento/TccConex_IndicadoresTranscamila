import React, { useEffect, useMemo, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useMetasFaturamento, useSaveMetasFaturamento } from '../../hooks/useMetasFaturamento';

const MESES_PADRAO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function currentYear(): number {
  return new Date().getFullYear();
}

/** Janela de anos no seletor: passado e futuro, além dos já cadastrados. */
function buildAnoOptions(cadastrados: number[], selecionado: number): number[] {
  const agora = currentYear();
  const candidatos = [...cadastrados, selecionado, agora];
  const min = Math.min(agora - 10, ...candidatos);
  const max = Math.max(agora + 10, ...candidatos);
  const anos: number[] = [];
  for (let y = max; y >= min; y -= 1) anos.push(y);
  return anos;
}

/** Converte input pt-BR / número em valor numérico. */
function parseMoneyInput(raw: string): number {
  const cleaned = raw.replace(/\s/g, '').replace(/R\$/i, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatMoneyInput(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const FinanceiroMetaFaturamentoConfig: React.FC = () => {
  const [ano, setAno] = useState(String(currentYear()));
  const anoNum = Number(ano) || currentYear();

  const query = useMetasFaturamento(anoNum);
  const saveMutation = useSaveMetasFaturamento();
  const { data } = query;

  const [valores, setValores] = useState<string[]>(Array(12).fill('0,00'));
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!data || data.ano !== anoNum) return;
    setValores(data.meses.map((m) => formatMoneyInput(m.valor)));
    setDirty(false);
    setFeedback(null);
    setErrorMsg(null);
  }, [data, anoNum]);

  const anosDisponiveis = useMemo(
    () => buildAnoOptions(data?.anosDisponiveis ?? [], anoNum),
    [data?.anosDisponiveis, anoNum],
  );

  const anoMin = anosDisponiveis[anosDisponiveis.length - 1] ?? anoNum;
  const anoMax = anosDisponiveis[0] ?? anoNum;

  const total = useMemo(
    () => valores.reduce((acc, raw) => acc + parseMoneyInput(raw), 0),
    [valores],
  );

  const trocarAno = (proximo: number) => {
    if (proximo === anoNum) return;
    if (dirty && !window.confirm('Há alterações não salvas. Trocar de ano mesmo assim?')) return;
    setAno(String(proximo));
  };

  const handleValorChange = (index: number, value: string) => {
    setValores((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setDirty(true);
    setFeedback(null);
  };

  const handleBlur = (index: number) => {
    setValores((prev) => {
      const next = [...prev];
      next[index] = formatMoneyInput(parseMoneyInput(prev[index]));
      return next;
    });
  };

  const handleReset = () => {
    if (!data) return;
    setValores(data.meses.map((m) => formatMoneyInput(m.valor)));
    setDirty(false);
    setFeedback(null);
    setErrorMsg(null);
  };

  const handleSave = async () => {
    setErrorMsg(null);
    try {
      await saveMutation.mutateAsync({
        ano: anoNum,
        meses: valores.map((raw, i) => ({
          mes: i + 1,
          valor: parseMoneyInput(raw),
        })),
      });
      setDirty(false);
      setFeedback('Metas salvas com sucesso.');
    } catch {
      setErrorMsg('Não foi possível salvar as metas. Tente novamente.');
    }
  };

  return (
    <div className="cashflow-page">
      <header className="view-header cashflow-header">
        <div>
          <h1>Meta de Faturamento</h1>
          <p>Configure a meta mensal por ano — usada no indicador de Meta de Faturamento.</p>
        </div>
      </header>

      <div className="reports-filters-bar">
        <div className="reports-filter-left">
          <div className="reports-filter-icon-label">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
            </svg>
            <span>Ano</span>
          </div>

          <div className="meta-fat-ano-nav">
            <button
              type="button"
              className="reports-action-btn secondary meta-fat-ano-step"
              aria-label="Ano anterior"
              disabled={anoNum <= anoMin}
              onClick={() => trocarAno(anoNum - 1)}
            >
              ‹
            </button>
            <select
              className="rh-period-select"
              value={ano}
              onChange={(e) => trocarAno(Number(e.target.value))}
            >
              {anosDisponiveis.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
            <button
              type="button"
              className="reports-action-btn secondary meta-fat-ano-step"
              aria-label="Próximo ano"
              disabled={anoNum >= anoMax}
              onClick={() => trocarAno(anoNum + 1)}
            >
              ›
            </button>
          </div>
        </div>

        <div className="reports-filter-right" style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="reports-action-btn secondary"
            onClick={handleReset}
            disabled={!dirty || saveMutation.isPending}
          >
            Desfazer
          </button>
          <button
            type="button"
            className="reports-action-btn"
            onClick={handleSave}
            disabled={!dirty || saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Salvando…' : 'Salvar metas'}
          </button>
        </div>
      </div>

      <QueryDataPanel
        query={query}
        variant="compact"
        fullPageLoader
        refreshVariant="overlay"
        loadingMessage="Carregando metas..."
        refreshingMessage="Atualizando metas..."
        errorMessage="Não foi possível carregar as metas de faturamento."
      >
        {data && (
          <div className="erp-card reports-table-card cashflow-table-card meta-fat-config-card">
            <div className="meta-fat-config-summary">
              <div>
                <span className="meta-fat-config-summary-label">Meta anual {anoNum}</span>
                <strong className="meta-fat-config-summary-value">{formatCurrency(total)}</strong>
              </div>
              {feedback && <span className="meta-fat-config-feedback is-ok">{feedback}</span>}
              {errorMsg && <span className="meta-fat-config-feedback is-error">{errorMsg}</span>}
            </div>

            <div className="table-container">
              <table className="erp-table reports-table meta-fat-config-table">
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th className="num">Meta (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.meses.length ? data.meses : MESES_PADRAO.map((nome, i) => ({
                    id: null,
                    mes: i + 1,
                    nomeMes: nome,
                    valor: 0,
                  }))).map((mes, index) => (
                    <tr key={mes.mes}>
                      <td>{mes.nomeMes}</td>
                      <td className="num">
                        <input
                          type="text"
                          className="meta-fat-config-input"
                          inputMode="decimal"
                          value={valores[index] ?? '0,00'}
                          onChange={(e) => handleValorChange(index, e.target.value)}
                          onBlur={() => handleBlur(index)}
                          aria-label={`Meta de ${mes.nomeMes}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="meta-fat-config-total-row">
                    <td>Total anual</td>
                    <td className="num">{formatCurrency(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </QueryDataPanel>
    </div>
  );
};

export default FinanceiroMetaFaturamentoConfig;
