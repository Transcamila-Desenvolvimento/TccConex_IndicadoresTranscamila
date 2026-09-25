import { useId, useState } from 'react';
import type { PropostaMargemVeiculo } from '../../types/domain';

const VEICULOS_PADRAO: PropostaMargemVeiculo[] = [
  { bandaKey: 'de9000', rotulo: 'Truck', margem: '0.33' },
  { bandaKey: 'de14001', rotulo: 'Carreta 6 eixos', margem: '0.25' },
  { bandaKey: 'acima26001', rotulo: 'Carreta 7 eixos', margem: '0.25' },
];

type Props = {
  margensVeiculo: PropostaMargemVeiculo[];
  veiculosTarifa?: PropostaMargemVeiculo[] | null;
  canEdit: boolean;
  onChange: (margens: PropostaMargemVeiculo[]) => void;
};

/** Fator (0.335) → percentual exibido (33,5). Até 2 casas decimais. */
const fatorParaPct = (fator?: string | null) => {
  const texto = String(fator ?? '').trim().replace(',', '.');
  if (!texto) return '';
  const num = Number(texto);
  if (!Number.isFinite(num)) return '';
  const pct = Math.round(num * 10000) / 100;
  return pct
    .toFixed(2)
    .replace(/\.?0+$/, '')
    .replace('.', ',');
};

const pctParaFator = (pctTexto: string): string | null => {
  const raw = pctTexto.replace(',', '.').trim();
  if (!raw || raw === '.') return null;
  if (!/^\d+(\.\d+)?$/.test(raw)) return null;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  // Evita float feio (ex.: 33,5 / 100 → 0.33500000000000002)
  return String(Math.round(num * 10000) / 1000000);
};

export default function PropostaCondicoesEspeciais({
  margensVeiculo,
  veiculosTarifa,
  canEdit,
  onChange,
}: Props) {
  const [aberta, setAberta] = useState(false);
  /** Texto digitado (com vírgula) enquanto o campo está em edição — evita perder a vírgula no meio da digitação. */
  const [rascunhos, setRascunhos] = useState<Record<string, string>>({});
  const painelId = useId();
  const base = (veiculosTarifa?.length ? veiculosTarifa : VEICULOS_PADRAO).map((item) => ({
    bandaKey: item.bandaKey,
    rotulo: item.rotulo || item.bandaKey,
    margem: (item.margem || '').trim() || '0.33',
  }));

  const aplicarMargens = (bandaKey: string, fator: string) => {
    const next = base.map((veiculo) => {
      const previa = margensVeiculo.find((m) => m.bandaKey === veiculo.bandaKey)?.margem;
      return {
        bandaKey: veiculo.bandaKey,
        rotulo: veiculo.rotulo,
        margem: veiculo.bandaKey === bandaKey
          ? fator
          : ((previa || '').trim() || veiculo.margem),
      };
    });
    // Só persiste override: igual à tabela oficial não entra na proposta nem na trilha.
    onChange(next.filter((veiculo) => {
      const padrao = base.find((itemBase) => itemBase.bandaKey === veiculo.bandaKey)?.margem;
      return String(veiculo.margem || '').trim() !== String(padrao || '').trim();
    }));
  };

  return (
    <div className={`proposta-condicoes-especiais${aberta ? ' is-open' : ''}`}>
      <button
        type="button"
        className="proposta-condicoes-especiais-toggle"
        aria-expanded={aberta}
        aria-controls={painelId}
        onClick={() => setAberta((atual) => !atual)}
      >
        <span>
          <i className="bi bi-sliders" aria-hidden="true" />
          Condições especiais
        </span>
        <i className={`bi ${aberta ? 'bi-chevron-up' : 'bi-chevron-down'}`} aria-hidden="true" />
      </button>
      {aberta ? (
        <div id={painelId} className="proposta-condicoes-especiais-painel">
          <p className="proposta-condicoes-especiais-hint">
            Ajuste as margens só nesta proposta (aceita decimais, ex.: 33,5). A tabela de frete cadastrada permanece igual.
          </p>
          <div className="proposta-condicoes-especiais-grid">
            {base.map((item) => {
              const salva = margensVeiculo.find((m) => m.bandaKey === item.bandaKey)?.margem;
              const atual = (salva || '').trim() || item.margem;
              const valorExibido = rascunhos[item.bandaKey] ?? fatorParaPct(atual);
              return (
                <label key={item.bandaKey} className="proposta-condicoes-especiais-campo">
                  <span className="proposta-condicoes-especiais-label">Margem {item.rotulo} %</span>
                  <div className="proposta-condicoes-especiais-input-wrap">
                    <input
                      type="text"
                      className="proposta-condicoes-especiais-input"
                      inputMode="decimal"
                      placeholder="0"
                      disabled={!canEdit}
                      value={valorExibido}
                      onChange={(e) => {
                        if (!canEdit) return;
                        // Normaliza ponto para vírgula (teclado numérico / locale)
                        const typed = String(e.target.value).replace('.', ',');
                        if (typed !== '' && !/^\d*,?\d*$/.test(typed)) return;
                        setRascunhos((prev) => ({ ...prev, [item.bandaKey]: typed }));
                        // Ainda digitando a vírgula (ex.: "33,") — não recalcula o fator
                        if (typed.endsWith(',') || typed === '') return;
                        const fator = pctParaFator(typed);
                        if (fator == null) return;
                        aplicarMargens(item.bandaKey, fator);
                      }}
                      onBlur={() => {
                        const rascunho = rascunhos[item.bandaKey];
                        setRascunhos((prev) => {
                          const next = { ...prev };
                          delete next[item.bandaKey];
                          return next;
                        });
                        if (rascunho == null) return;
                        const fator = pctParaFator(rascunho);
                        if (fator == null) return;
                        aplicarMargens(item.bandaKey, fator);
                      }}
                    />
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
