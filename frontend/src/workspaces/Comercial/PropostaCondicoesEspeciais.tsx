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

const fatorParaPct = (fator?: string | null) => {
  const num = Number(String(fator ?? '').trim());
  if (!Number.isFinite(num) || String(fator ?? '').trim() === '') return '';
  return String(Math.round(num * 1000) / 10).replace(/\.0$/, '');
};

export default function PropostaCondicoesEspeciais({
  margensVeiculo,
  veiculosTarifa,
  canEdit,
  onChange,
}: Props) {
  const [aberta, setAberta] = useState(false);
  const painelId = useId();
  const base = (veiculosTarifa?.length ? veiculosTarifa : VEICULOS_PADRAO).map((item) => ({
    bandaKey: item.bandaKey,
    rotulo: item.rotulo || item.bandaKey,
    margem: (item.margem || '').trim() || '0.33',
  }));

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
            Ajuste as margens só nesta proposta. A tabela de frete cadastrada permanece igual.
          </p>
          <div className="proposta-condicoes-especiais-grid">
            {base.map((item) => {
              const salva = margensVeiculo.find((m) => m.bandaKey === item.bandaKey)?.margem;
              const atual = (salva || '').trim() || item.margem;
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
                      value={fatorParaPct(atual)}
                        onChange={(e) => {
                        if (!canEdit) return;
                        const raw = String(e.target.value).replace(',', '.').trim();
                        if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return;
                        const num = Number(raw);
                        const fator = raw === '' || !Number.isFinite(num)
                          ? atual
                          : String(num / 100);
                        const next = base.map((veiculo) => {
                          const previa = margensVeiculo.find((m) => m.bandaKey === veiculo.bandaKey)?.margem;
                          return {
                            bandaKey: veiculo.bandaKey,
                            rotulo: veiculo.rotulo,
                            margem: veiculo.bandaKey === item.bandaKey
                              ? fator
                              : ((previa || '').trim() || veiculo.margem),
                          };
                        });
                        // Só persiste override: igual à tabela oficial não entra na proposta nem na trilha.
                        onChange(next.filter((veiculo) => {
                          const padrao = base.find((itemBase) => itemBase.bandaKey === veiculo.bandaKey)?.margem;
                          return String(veiculo.margem || '').trim() !== String(padrao || '').trim();
                        }));
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
