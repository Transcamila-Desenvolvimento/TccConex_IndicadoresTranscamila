import React, { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useBuscarCompararRH, useComparacaoDadosRH } from '../../../hooks/useRH';
import QueryDataPanel from '../../../components/QueryDataPanel';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const CHART_COLORS = ['#118CC4', '#f59e0b'];

interface SelectedColaborador {
  cpf: string;
  nome: string;
  cargo: string;
  filial: string;
}

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface CompararSalariosModalProps {
  onClose: () => void;
}

const CompararSalariosModal: React.FC<CompararSalariosModalProps> = ({ onClose }) => {
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<SelectedColaborador[]>([]);

  const buscaQuery = useBuscarCompararRH(term, selected.length < 2);
  const results = (buscaQuery.data?.results ?? []).filter(
    (r) => !selected.some((s) => s.cpf === r.cpf),
  );

  const cpfs = useMemo(() => selected.map((s) => s.cpf), [selected]);
  const comparacaoQuery = useComparacaoDadosRH(cpfs, selected.length === 2);
  const comparacaoData = comparacaoQuery.data;

  const chartData = useMemo(() => {
    if (!comparacaoData) return null;
    const allLabels = new Set<string>();
    Object.values(comparacaoData).forEach((c) => c.labels.forEach((l) => allLabels.add(l)));
    const labels = Array.from(allLabels).sort((a, b) => {
      const [ma, ya] = a.split('/').map(Number);
      const [mb, yb] = b.split('/').map(Number);
      return ya === yb ? ma - mb : ya - yb;
    });

    const datasets = cpfs.map((cpf, idx) => {
      const info = comparacaoData[cpf];
      const valueByLabel = new Map(info.labels.map((l, i) => [l, info.valores[i]]));
      return {
        label: info.nome,
        data: labels.map((l) => valueByLabel.get(l) ?? null),
        borderColor: CHART_COLORS[idx % CHART_COLORS.length],
        backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
        spanGaps: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
      };
    });

    return { labels, datasets };
  }, [comparacaoData, cpfs]);

  const handleSelect = (colaborador: SelectedColaborador) => {
    if (selected.length >= 2) return;
    setSelected((current) => [...current, colaborador]);
    setTerm('');
  };

  const handleRemove = (cpf: string) => {
    setSelected((current) => current.filter((c) => c.cpf !== cpf));
  };

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', zIndex: 3000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="search-modal-card" style={{ width: '640px', maxWidth: '92vw' }}>
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Comparar Evolução Salarial</h3>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>Fechar (X)</span>
        </div>

        <div style={{ padding: '20px 24px 24px 24px' }}>
          <p style={{ fontSize: '12.5px', color: '#64748b', marginTop: 0, marginBottom: '12px' }}>
            Selecione exatamente dois colaboradores para visualizar a evolução salarial mês a mês.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            {selected.map((c) => (
              <span key={c.cpf} className="adjustment-suggestion-chip active" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {c.nome}
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ cursor: 'pointer' }} onClick={() => handleRemove(c.cpf)}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            ))}
          </div>

          {selected.length < 2 && (
            <div className="reports-search-wrapper" style={{ marginBottom: '8px' }}>
              <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por nome, cargo ou filial (mín. 2 caracteres)..."
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
            </div>
          )}

          {selected.length < 2 && term.trim().length >= 2 && (
            <div className="rh-compare-results">
              {results.length === 0 ? (
                <div style={{ padding: '10px', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Nenhum colaborador encontrado.</div>
              ) : (
                results.map((r) => (
                  <button type="button" key={r.cpf} className="rh-compare-result-item" onClick={() => handleSelect(r)}>
                    <strong>{r.nome}</strong>
                    <span>{r.cargo} · {r.filial}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {selected.length === 2 && (
            <QueryDataPanel
              query={comparacaoQuery}
              variant="compact"
              className="rh-compare-chart-panel"
              loadingMessage="Carregando histórico salarial..."
              refreshingMessage="Atualizando histórico..."
              errorMessage="Não foi possível carregar o histórico salarial."
            >
              <div style={{ marginTop: '16px' }}>
                {chartData && chartData.labels.length > 0 ? (
                  <div style={{ height: '320px' }}>
                    <Line
                      data={chartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle' } },
                          tooltip: {
                            callbacks: {
                              label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(Number(ctx.parsed.y ?? 0))}`,
                            },
                          },
                        },
                        scales: {
                          y: {
                            ticks: { callback: (val) => formatCurrency(Number(val)) },
                          },
                        },
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '32px', color: '#64748b', fontStyle: 'italic' }}>
                    Nenhum histórico salarial encontrado para os colaboradores selecionados.
                  </div>
                )}
              </div>
            </QueryDataPanel>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompararSalariosModal;
