import { useEffect, useRef, useState } from 'react';
import ComercialEnderecoAutocomplete from './ComercialEnderecoAutocomplete';
import { useCalcularTrechoProposta } from '../../hooks/useComercialClientes';
import type { PropostaMargemVeiculo } from '../../types/domain';

export type TrechoLinha = {
  origem: string;
  entrega: string;
  veiculo: string;
  veiculoKey?: string;
  modalidade?: string;
  km?: string;
  devolucaoContainer: string;
  observacoes: string;
  peso: string;
  tarifaFrete: string;
  pedagio: string;
  retiradaCtnt: string;
  desovaCtnt: string;
  adValorem: string;
  gris: string;
  icms: string;
  prazoDias: string;
  outrosValores?: string;
};

const VEICULOS = [
  { bandaKey: 'de9000', rotulo: 'Truck' },
  { bandaKey: 'de14001', rotulo: 'Carreta 6 eixos' },
  { bandaKey: 'acima26001', rotulo: 'Carreta 7 eixos' },
];

type VeiculoOpcao = { bandaKey: string; rotulo: string };

function catalogoVeiculos(veiculosTarifa?: { bandaKey?: string; rotulo?: string }[] | null): VeiculoOpcao[] {
  const fonte = (veiculosTarifa ?? []).filter((item) => (item.bandaKey || '').trim());
  const base = (fonte.length ? fonte : VEICULOS).map((item) => ({
    bandaKey: (item.bandaKey || '').trim(),
    rotulo: (item.rotulo || item.bandaKey || '').trim(),
  }));
  const vistos = new Set<string>();
  return base.filter((item) => {
    if (!item.bandaKey || vistos.has(item.bandaKey)) return false;
    vistos.add(item.bandaKey);
    return true;
  });
}

/** Normaliza número vindo da API ("15551.80") ou digitado ("R$ 15.551,80"). */
const parseMoneyInput = (value: string): number | null => {
  const raw = String(value || '').trim();
  if (!raw || raw === '-' || raw === '—') return null;
  const limpo = raw
    .replace(/R\$\s?/gi, '')
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const amount = Number(limpo);
  return Number.isFinite(amount) ? amount : null;
};

export const formatMoneyInput = (value: string): string => {
  const amount = parseMoneyInput(value);
  if (amount == null) return (value || '').trim();
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

type Props = {
  titulo: string;
  linhas: TrechoLinha[];
  canEdit: boolean;
  /** Tarifas/percentuais — só na revisão de valores (ou rascunho). Default: igual a canEdit. */
  canEditValores?: boolean;
  clienteId: string;
  margensVeiculo: PropostaMargemVeiculo[];
  /** Veículos da tabela de frete do cliente. Sem isso, ficam só os três tipos oficiais. */
  veiculosTarifa?: { bandaKey?: string; rotulo?: string }[] | null;
  portuaria?: boolean;
  spot?: boolean;
  grisAdvUnificado?: boolean;
  onChange: (linhas: TrechoLinha[]) => void;
};

const emptyLinha = (modalidade: string, veiculo: VeiculoOpcao = VEICULOS[0]): TrechoLinha => ({
  origem: '',
  entrega: '',
  veiculo: veiculo.rotulo,
  veiculoKey: veiculo.bandaKey,
  modalidade,
  km: '',
  devolucaoContainer: '',
  observacoes: '',
  peso: '',
  tarifaFrete: '',
  pedagio: '',
  retiradaCtnt: '',
  desovaCtnt: '',
  adValorem: '',
  gris: '',
  icms: '',
  prazoDias: '',
  outrosValores: '',
});

export default function PropostaTrechosOperacao({
  titulo,
  linhas,
  canEdit,
  canEditValores = canEdit,
  clienteId,
  margensVeiculo,
  veiculosTarifa,
  portuaria = false,
  spot = false,
  grisAdvUnificado = false,
  onChange,
}: Props) {
  const calcular = useCalcularTrechoProposta();
  const timer = useRef<number | null>(null);
  const margemTimer = useRef<number | null>(null);
  const linhasRef = useRef(linhas);
  linhasRef.current = linhas;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const calcularRef = useRef(calcular);
  calcularRef.current = calcular;
  const margensRef = useRef(margensVeiculo);
  margensRef.current = margensVeiculo;
  const modalidade = spot ? 'spot' : portuaria ? 'op_portuaria' : 'transferencia';
  const veiculos = catalogoVeiculos(veiculosTarifa);
  const veiculoPadrao = veiculos.find((item) => item.bandaKey === 'de9000') ?? veiculos[0] ?? VEICULOS[0];
  const lista = linhas.length ? linhas : [emptyLinha(modalidade, veiculoPadrao)];
  const margensKey = JSON.stringify(margensVeiculo ?? []);
  const prevMargensKey = useRef(margensKey);

  const aplicarCalculo = (
    index: number,
    res: {
      veiculo?: string;
      veiculoKey?: string;
      tarifaFrete?: string | number | null;
      gris?: string;
      adValorem?: string;
      grisAdvUnificado?: boolean;
      icms?: string;
      prazoDias?: string;
    },
    base: TrechoLinha[],
  ) => {
    onChangeRef.current(base.map((linha, i) => (
      i === index
        ? {
            ...linha,
            veiculo: res.veiculo || linha.veiculo,
            veiculoKey: res.veiculoKey || linha.veiculoKey,
            tarifaFrete: res.tarifaFrete != null && String(res.tarifaFrete).trim()
              ? formatMoneyInput(String(res.tarifaFrete))
              : linha.tarifaFrete,
            gris: res.gris || linha.gris,
            adValorem: res.grisAdvUnificado ? (res.gris || linha.gris) : (res.adValorem || linha.adValorem),
            icms: res.icms || linha.icms,
            prazoDias: res.prazoDias || linha.prazoDias,
          }
        : linha
    )));
  };

  const [recalculando, setRecalculando] = useState(false);

  /** Recalcula frete, GRIS/ADV, ICMS e prazo de todos os trechos com km e veículo. */
  const recalcularTodos = async (isCancelled: () => boolean = () => false) => {
    const atuais = linhasRef.current.length ? linhasRef.current : [emptyLinha(modalidade, veiculoPadrao)];
    const elegiveis = atuais
      .map((linha, index) => ({ linha, index }))
      .filter(({ linha }) => (
        Boolean((linha.km ?? '').trim() && (linha.veiculoKey || linha.veiculo))
      ));
    if (!elegiveis.length) return 0;

    let working = [...atuais];
    for (const { linha, index } of elegiveis) {
      try {
        const res = await calcularRef.current.mutateAsync({
          clienteId,
          origem: linha.origem,
          destino: linha.entrega,
          veiculoKey: linha.veiculoKey || linha.veiculo,
          km: linha.km || '',
          margensVeiculo: margensRef.current,
        });
        if (isCancelled()) return 0;
        working = working.map((item, i) => (
          i === index
            ? {
                ...item,
                veiculo: res.veiculo || item.veiculo,
                veiculoKey: res.veiculoKey || item.veiculoKey,
                tarifaFrete: res.tarifaFrete != null && String(res.tarifaFrete).trim()
                  ? formatMoneyInput(String(res.tarifaFrete))
                  : item.tarifaFrete,
                gris: res.gris || item.gris,
                adValorem: res.grisAdvUnificado ? (res.gris || item.gris) : (res.adValorem || item.adValorem),
                icms: res.icms || item.icms,
                prazoDias: res.prazoDias || item.prazoDias,
              }
            : item
        ));
      } catch {
        /* ignora trecho que falhou no recálculo */
      }
    }
    if (!isCancelled()) onChangeRef.current(working);
    return elegiveis.length;
  };

  const handleRecalcular = async () => {
    if (!clienteId || recalculando) return;
    const confirmado = window.confirm(
      'Recalcular frete, GRIS/ADV, ICMS e prazo de todos os trechos com a tabela de frete e os cadastros atuais?\n\n'
      + 'Valores digitados manualmente nessas colunas serão substituídos. Pedágio, retirada e desova são mantidos.',
    );
    if (!confirmado) return;
    setRecalculando(true);
    try {
      const total = await recalcularTodos();
      if (!total) alert('Nenhum trecho com km e veículo preenchidos para recalcular.');
    } finally {
      setRecalculando(false);
    }
  };

  useEffect(() => {
    if (prevMargensKey.current === margensKey) return;
    prevMargensKey.current = margensKey;
    if (!canEditValores || !clienteId) return;

    if (margemTimer.current) window.clearTimeout(margemTimer.current);
    let cancelled = false;
    margemTimer.current = window.setTimeout(() => {
      void recalcularTodos(() => cancelled);
    }, 350);

    return () => {
      cancelled = true;
      if (margemTimer.current) window.clearTimeout(margemTimer.current);
    };
  }, [margensKey, canEditValores, clienteId, modalidade]);

  const patch = (index: number, changes: Partial<TrechoLinha>) => {
    const next = lista.map((linha, i) => (i === index ? { ...linha, modalidade, ...changes } : linha));
    onChange(next);
    const atual = next[index];
    // Só recalcula frete quando mudam rota/km/veículo — pedágio é manual (não apagar ao digitar).
    const afetaFrete = ['origem', 'entrega', 'km', 'veiculo', 'veiculoKey'].some((chave) => chave in changes);
    if (
      !afetaFrete
      || !canEditValores
      || !atual.origem.trim()
      || !atual.entrega.trim()
      || !atual.km?.trim()
      || !(atual.veiculoKey || atual.veiculo)
    ) {
      return;
    }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      calcular.mutate(
        {
          clienteId,
          origem: atual.origem,
          destino: atual.entrega,
          veiculoKey: atual.veiculoKey || atual.veiculo,
          km: atual.km || '',
          margensVeiculo,
        },
        {
          onSuccess: (res) => {
            const atuais = linhasRef.current.length ? linhasRef.current : next;
            aplicarCalculo(index, res, atuais);
          },
        },
      );
    }, 450);
  };

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
    if (margemTimer.current) window.clearTimeout(margemTimer.current);
  }, []);

  return (
    <section className="proposta-destinos-card">
      <div className="proposta-destinos-head">
        <h4>{titulo}</h4>
        <div className="proposta-destinos-head-actions">
          {canEditValores && clienteId ? (
            <button
              type="button"
              className="proposta-secao-add"
              disabled={recalculando}
              title="Atualiza frete, GRIS/ADV, ICMS e prazo com a tabela de frete e os cadastros atuais"
              onClick={() => { void handleRecalcular(); }}
            >
              <i className={`bi ${recalculando ? 'bi-hourglass-split' : 'bi-arrow-repeat'}`} aria-hidden="true" />
              {recalculando ? 'Recalculando...' : 'Recalcular'}
            </button>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              className="proposta-secao-add"
              onClick={() => onChange([...lista, emptyLinha(modalidade, veiculoPadrao)])}
            >
              <i className="bi bi-plus-lg" aria-hidden="true" />
              Adicionar
            </button>
          ) : null}
        </div>
      </div>
      <div className="table-container proposta-destinos-wrap">
        <table className={`erp-table reports-table comercial-browse-table proposta-destinos-table${portuaria ? ' proposta-destinos-table--portuaria' : ''}${spot ? ' proposta-destinos-table--spot' : ''}`}>
          <thead>
            <tr>
              <th className="col-trecho">Origem</th>
              <th className="col-trecho">Destino</th>
              <th className="col-veiculo">Veículo</th>
              <th className="col-km">Km</th>
              <th className="col-money">Frete</th>
              <th className="col-money">Pedágio</th>
              {portuaria ? <th className="col-money" title="Retirada CTNT">Retirada CTNT</th> : null}
              {portuaria ? <th className="col-money" title="Desova CTNT">Desova CTNT</th> : null}
              {grisAdvUnificado ? (
                <th className="col-pct">GRIS/ADV</th>
              ) : (
                <>
                  <th className="col-pct">GRIS</th>
                  <th className="col-pct">Ad-VL</th>
                </>
              )}
              <th className="col-icms">ICMS</th>
              <th className="col-prazo">Prazo entrega</th>
              {spot ? <th className="col-outros">Outros valores</th> : null}
              {canEdit ? <th className="col-actions" aria-label="Ações" /> : null}
            </tr>
          </thead>
          <tbody>
            {lista.map((linha, index) => (
              <tr key={`${modalidade}-${index}`}>
                <td className="col-trecho">
                  <ComercialEnderecoAutocomplete
                    compact
                    variant="cidade"
                    value={linha.origem}
                    disabled={!canEdit}
                    placeholder="Ibiporã-PR"
                    inputClassName="proposta-destinos-input"
                    onChange={(origem) => patch(index, { origem })}
                  />
                </td>
                <td className="col-trecho">
                  <ComercialEnderecoAutocomplete
                    compact
                    variant="cidade"
                    value={linha.entrega}
                    disabled={!canEdit}
                    placeholder="Santos-SP"
                    inputClassName="proposta-destinos-input"
                    onChange={(entrega) => patch(index, { entrega })}
                  />
                </td>
                <td>
                  <select
                    className="proposta-destinos-input"
                    disabled={!canEditValores}
                    value={linha.veiculoKey || ''}
                    onChange={(e) => {
                      const tipo = veiculos.find((item) => item.bandaKey === e.target.value);
                      patch(index, { veiculoKey: e.target.value, veiculo: tipo?.rotulo || linha.veiculo || e.target.value });
                    }}
                  >
                    {(linha.veiculoKey && !veiculos.some((item) => item.bandaKey === linha.veiculoKey)
                      ? [{ bandaKey: linha.veiculoKey, rotulo: linha.veiculo || linha.veiculoKey }, ...veiculos]
                      : veiculos
                    ).map((item) => (
                      <option key={item.bandaKey} value={item.bandaKey}>{item.rotulo}</option>
                    ))}
                  </select>
                </td>
                <td className="col-km">
                  <input className="proposta-destinos-input" value={linha.km ?? ''} disabled={!canEditValores} placeholder="120" onChange={(e) => patch(index, { km: e.target.value })} />
                </td>
                <td className="col-money">
                  <input
                    className="proposta-destinos-input proposta-destinos-input--money"
                    value={linha.tarifaFrete}
                    disabled={!canEditValores}
                    placeholder="R$ 0,00"
                    onChange={(e) => patch(index, { tarifaFrete: e.target.value })}
                    onBlur={() => {
                      if (!linha.tarifaFrete.trim()) return;
                      patch(index, { tarifaFrete: formatMoneyInput(linha.tarifaFrete) });
                    }}
                  />
                </td>
                <td className="col-money">
                  <input
                    className="proposta-destinos-input proposta-destinos-input--money"
                    value={linha.pedagio}
                    disabled={!canEditValores}
                    placeholder="R$ 0,00"
                    onChange={(e) => patch(index, { pedagio: e.target.value })}
                    onBlur={() => {
                      if (!linha.pedagio.trim()) return;
                      patch(index, { pedagio: formatMoneyInput(linha.pedagio) });
                    }}
                  />
                </td>
                {portuaria ? (
                  <td className="col-money">
                    <input
                      className="proposta-destinos-input proposta-destinos-input--money"
                      value={linha.retiradaCtnt}
                      disabled={!canEditValores}
                      placeholder="R$ 0,00"
                      onChange={(e) => patch(index, { retiradaCtnt: e.target.value })}
                      onBlur={() => {
                        if (!linha.retiradaCtnt.trim()) return;
                        patch(index, { retiradaCtnt: formatMoneyInput(linha.retiradaCtnt) });
                      }}
                    />
                  </td>
                ) : null}
                {portuaria ? (
                  <td className="col-money">
                    <input
                      className="proposta-destinos-input proposta-destinos-input--money"
                      value={linha.desovaCtnt}
                      disabled={!canEditValores}
                      placeholder="R$ 0,00"
                      onChange={(e) => patch(index, { desovaCtnt: e.target.value })}
                      onBlur={() => {
                        if (!linha.desovaCtnt.trim()) return;
                        patch(index, { desovaCtnt: formatMoneyInput(linha.desovaCtnt) });
                      }}
                    />
                  </td>
                ) : null}
                {grisAdvUnificado ? (
                  <td className="col-pct">
                    <input
                      className="proposta-destinos-input"
                      value={linha.gris || linha.adValorem}
                      disabled={!canEditValores}
                      placeholder="0,15%"
                      onChange={(e) => patch(index, { gris: e.target.value, adValorem: e.target.value })}
                    />
                  </td>
                ) : (
                  <>
                    <td className="col-pct">
                      <input className="proposta-destinos-input" value={linha.gris} disabled={!canEditValores} placeholder="0,15%" onChange={(e) => patch(index, { gris: e.target.value })} />
                    </td>
                    <td className="col-pct">
                      <input className="proposta-destinos-input" value={linha.adValorem} disabled={!canEditValores} placeholder="0,00%" onChange={(e) => patch(index, { adValorem: e.target.value })} />
                    </td>
                  </>
                )}
                <td className="col-icms">
                  <input className="proposta-destinos-input" value={linha.icms} disabled={!canEditValores} onChange={(e) => patch(index, { icms: e.target.value })} />
                </td>
                <td className="col-prazo">
                  <input className="proposta-destinos-input" value={linha.prazoDias} disabled={!canEditValores} placeholder="3 dias úteis" onChange={(e) => patch(index, { prazoDias: e.target.value })} />
                </td>
                {spot ? (
                  <td className="col-outros">
                    <input
                      className="proposta-destinos-input"
                      value={linha.outrosValores ?? ''}
                      disabled={!canEdit}
                      placeholder="Informação adicional"
                      onChange={(e) => patch(index, { outrosValores: e.target.value })}
                    />
                  </td>
                ) : null}
                {canEdit ? (
                  <td className="col-actions">
                    <button
                      type="button"
                      className="btn-icon proposta-destinos-remove"
                      title="Remover"
                      disabled={lista.length <= 1}
                      onClick={() => onChange(lista.filter((_, i) => i !== index))}
                    >
                      <i className="bi bi-trash" aria-hidden="true" />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
