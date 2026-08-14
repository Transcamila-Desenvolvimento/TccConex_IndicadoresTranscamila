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

function buildAnoOptions(cadastrados: number[], selecionado: number): number[] {
  const agora = currentYear();
  const candidatos = [...cadastrados, selecionado, agora];
  const min = Math.min(agora - 10, ...candidatos);
  const max = Math.max(agora + 10, ...candidatos);
  const anos: number[] = [];
  for (let y = max; y >= min; y -= 1) anos.push(y);
  return anos;
}

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

const LogisticaMetaFaturamentoConfigSection: React.FC = () => {
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
      setFeedback('Salvo');
    } catch {
      setErrorMsg('Erro ao salvar');
    }
  };

  const meses = data?.meses.length
    ? data.meses
    : MESES_PADRAO.map((nome, i) => ({
        id: null,
        mes: i + 1,
        nomeMes: nome,
        valor: 0,
      }));

  return (
    <QueryDataPanel
      query={query}
      variant="compact"
      refreshVariant="overlay"
      loadingMessage="Carregando metas..."
      refreshingMessage="Atualizando..."
      errorMessage="Não foi possível carregar as metas."
    >
      {data && (
        <div className="logistica-settings-panel-inner">
          <div className="logistica-settings-toolbar">
            <span className="logistica-settings-panel-meta">
              Ano {anoNum} · Total <strong>{formatCurrency(total)}</strong>
            </span>

            <div className="logistica-settings-panel-actions">
              <div className="logistica-settings-year-nav" aria-label="Selecionar ano">
                <button
                  type="button"
                  className="logistica-settings-icon-btn"
                  aria-label="Ano anterior"
                  disabled={anoNum <= anoMin}
                  onClick={() => trocarAno(anoNum - 1)}
                >
                  ‹
                </button>
                <select
                  className="logistica-settings-year-select"
                  value={ano}
                  onChange={(e) => trocarAno(Number(e.target.value))}
                  aria-label="Ano"
                >
                  {anosDisponiveis.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="logistica-settings-icon-btn"
                  aria-label="Próximo ano"
                  disabled={anoNum >= anoMax}
                  onClick={() => trocarAno(anoNum + 1)}
                >
                  ›
                </button>
              </div>

              {feedback && <span className="logistica-settings-feedback is-ok">{feedback}</span>}
              {errorMsg && <span className="logistica-settings-feedback is-error">{errorMsg}</span>}

              <button
                type="button"
                className="logistica-settings-btn secondary"
                onClick={handleReset}
                disabled={!dirty || saveMutation.isPending}
              >
                Desfazer
              </button>
              <button
                type="button"
                className="logistica-settings-btn"
                onClick={handleSave}
                disabled={!dirty || saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>

          <div className="logistica-meta-grid">
            {meses.map((mes, index) => (
              <label key={mes.mes} className="logistica-meta-row">
                <span>{mes.nomeMes}</span>
                <input
                  type="text"
                  className="logistica-meta-input"
                  inputMode="decimal"
                  value={valores[index] ?? '0,00'}
                  onChange={(e) => handleValorChange(index, e.target.value)}
                  onBlur={() => handleBlur(index)}
                  aria-label={`Meta de ${mes.nomeMes}`}
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </QueryDataPanel>
  );
};

export default LogisticaMetaFaturamentoConfigSection;
