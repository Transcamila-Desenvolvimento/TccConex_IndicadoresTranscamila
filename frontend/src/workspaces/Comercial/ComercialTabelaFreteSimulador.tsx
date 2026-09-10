import React, { useState } from 'react';
import {
  getComercialErrorMessage,
  useCalcularRotaDistancia,
  useSimularTabelaFrete,
} from '../../hooks/useComercialClientes';
import { apiService } from '../../services/apiService';
import { UFS_BRASIL, type RotaDistanciaResult, type TabelaFreteSimulacaoResult } from '../../types/domain';
import ComercialEnderecoAutocomplete, { type EnderecoSelecionado } from './ComercialEnderecoAutocomplete';
import ComercialMapaEnderecosModal from './ComercialMapaEnderecosModal';
import { formatTabelaMoney, parseTabelaNumber } from './formatTabelaFrete';

type Props = {
  tabelaId: string | null;
  disabled?: boolean;
};

type ModoCotacao = 'simples' | 'avancada';
type ModoRota = 'cidade' | 'endereco';

function hasValorMoney(value?: string | null) {
  const amount = parseTabelaNumber(value);
  return amount != null && amount > 0;
}

function rotaResumoLabel(rota: RotaDistanciaResult) {
  if (rota.modo === 'endereco') {
    return `${rota.enderecoOrigem ?? 'Origem'} → ${rota.enderecoDestino ?? 'Destino'}`;
  }
  return `${rota.cidadeOrigem ?? 'Origem'} → ${rota.cidadeDestino ?? 'Destino'}`;
}

function resolveUfsFormulario(
  modo: ModoCotacao,
  ufs: {
    origemSimples: string;
    destinoSimples: string;
    origemAvancada: string;
    destinoAvancada: string;
  },
) {
  if (modo === 'simples') {
    return { ufOrigem: ufs.origemSimples.trim(), ufDestino: ufs.destinoSimples.trim() };
  }
  return { ufOrigem: ufs.origemAvancada.trim(), ufDestino: ufs.destinoAvancada.trim() };
}

function extrasIncluidosTotal(resultado: TabelaFreteSimulacaoResult) {
  return (resultado.extras ?? [])
    .filter((extra) => extra.incluirNoTotal !== false)
    .reduce((acc, extra) => acc + (parseTabelaNumber(extra.valor) ?? 0), 0);
}

async function aplicarIcmsSeNecessario(
  resultado: TabelaFreteSimulacaoResult,
  ufOrigem: string,
  ufDestino: string,
): Promise<TabelaFreteSimulacaoResult> {
  if (!ufOrigem || !ufDestino || resultado.icms) return resultado;
  try {
    const extras = extrasIncluidosTotal(resultado);
    const subtotalNum = (parseTabelaNumber(resultado.subtotal) ?? 0) + extras;
    const icms = await apiService.calcularIcmsFreteComercial({
      total: resultado.total,
      subtotal: subtotalNum.toFixed(2),
      pedagio: resultado.pedagio,
      ufOrigem,
      ufDestino,
    });
    return { ...resultado, icms };
  } catch {
    return resultado;
  }
}

function SimuladorResultado({
  resultado,
  rota,
}: {
  resultado: TabelaFreteSimulacaoResult;
  rota: RotaDistanciaResult | null;
}) {
  const grisAdvValor = resultado.grisAdvUnificado
    ? (resultado.grisAdv ?? resultado.gris)
    : null;
  const icms = resultado.icms;

  return (
    <>
      {rota ? (
        <p className="tabela-frete-simulador-rota-resumo">
          Distância calculada: <strong>{rota.km} km</strong>
          {rota.provedor === 'google' ? ' (Google Maps)' : null}
          <span className="tabela-frete-simulador-rota-trajeto">{rotaResumoLabel(rota)}</span>
        </p>
      ) : null}
      <div className="tabela-frete-simulador-total">
        <span>Frete total</span>
        <strong>{formatTabelaMoney(icms?.totalComIcms ?? resultado.total)}</strong>
      </div>
      {icms ? (
        <p className="tabela-frete-simulador-icms-resumo">
          {icms.incluiPedagioNaBase === false
            ? `Base (subtotal; pedágio fora — origem ${icms.ufOrigem}): ${formatTabelaMoney(resultado.subtotal)}`
            : `Base (subtotal + pedágio): ${formatTabelaMoney(resultado.total)}`}
          {' · '}
          ICMS {icms.aliquotaPercent}% por dentro ({icms.ufOrigem} → {icms.ufDestino}): {formatTabelaMoney(icms.valor)}
        </p>
      ) : null}
      <div className="tabela-frete-simulador-breakdown">
        <section className="tabela-frete-simulador-group">
          <h4 className="tabela-frete-simulador-group-title">Classificação</h4>
          <dl className="tabela-frete-simulador-group-dl">
            <div><dt>Faixa km</dt><dd>{resultado.faixaKm.de} – {resultado.faixaKm.ate}</dd></div>
            <div><dt>Banda peso</dt><dd>{resultado.bandaPeso.rotulo}</dd></div>
            <div><dt>Prazo</dt><dd>{resultado.prazoDias} dia{resultado.prazoDias === 1 ? '' : 's'}</dd></div>
            <div><dt>Frete mínimo</dt><dd>{formatTabelaMoney(resultado.freteMinimo)}</dd></div>
          </dl>
        </section>
        <section className="tabela-frete-simulador-group">
          <h4 className="tabela-frete-simulador-group-title">Cálculo</h4>
          <dl className="tabela-frete-simulador-group-dl">
            <div><dt>Vlr frete</dt><dd>{formatTabelaMoney(resultado.freteBase)}</dd></div>
            {resultado.grisAdvUnificado ? (
              hasValorMoney(grisAdvValor) ? (
                <div><dt>GRIS/ADV</dt><dd>{formatTabelaMoney(grisAdvValor)}</dd></div>
              ) : null
            ) : (
              <>
                {hasValorMoney(resultado.gris) ? (
                  <div><dt>GRIS</dt><dd>{formatTabelaMoney(resultado.gris)}</dd></div>
                ) : null}
                {hasValorMoney(resultado.adv) ? (
                  <div><dt>ADV</dt><dd>{formatTabelaMoney(resultado.adv)}</dd></div>
                ) : null}
              </>
            )}
            <div><dt>Vlr P/km</dt><dd>{formatTabelaMoney(resultado.valorPorKm)}</dd></div>
            <div className="is-highlight"><dt>Subtotal</dt><dd>{formatTabelaMoney(resultado.subtotal)}</dd></div>
            <div><dt>Pedágio</dt><dd>{formatTabelaMoney(resultado.pedagio)}</dd></div>
            {(resultado.extras ?? []).map((extra) => (
              hasValorMoney(extra.valor) ? (
                <div key={extra.key}><dt>{extra.rotulo}</dt><dd>{formatTabelaMoney(extra.valor)}</dd></div>
              ) : null
            ))}
            {icms ? (
              <>
                <div>
                  <dt>ICMS ({icms.aliquotaPercent}% · {icms.ufOrigem} → {icms.ufDestino})</dt>
                  <dd>{formatTabelaMoney(icms.valor)}</dd>
                </div>
                <div className="is-highlight">
                  <dt>Frete total</dt>
                  <dd>{formatTabelaMoney(icms.totalComIcms)}</dd>
                </div>
              </>
            ) : (
              <div className="is-highlight"><dt>Frete total</dt><dd>{formatTabelaMoney(resultado.total)}</dd></div>
            )}
          </dl>
        </section>
      </div>
    </>
  );
}

const ENDERECO_VAZIO: EnderecoSelecionado = { label: '' };

export default function ComercialTabelaFreteSimulador({ tabelaId, disabled }: Props) {
  const simular = useSimularTabelaFrete();
  const calcularRota = useCalcularRotaDistancia();
  const [modo, setModo] = useState<ModoCotacao>('simples');
  const [modoRota, setModoRota] = useState<ModoRota>('cidade');
  const [km, setKm] = useState('');
  const [ufOrigemSimples, setUfOrigemSimples] = useState('');
  const [ufDestinoSimples, setUfDestinoSimples] = useState('');
  const [cidadeOrigem, setCidadeOrigem] = useState('');
  const [ufOrigem, setUfOrigem] = useState('');
  const [cidadeDestino, setCidadeDestino] = useState('');
  const [ufDestino, setUfDestino] = useState('');
  const [enderecoOrigem, setEnderecoOrigem] = useState<EnderecoSelecionado>(ENDERECO_VAZIO);
  const [enderecoDestino, setEnderecoDestino] = useState<EnderecoSelecionado>(ENDERECO_VAZIO);
  const [mapaOpen, setMapaOpen] = useState(false);
  const [pesoKg, setPesoKg] = useState('');
  const [modalidade, setModalidade] = useState<'fracionado' | 'fechado'>('fracionado');
  const [valorNf, setValorNf] = useState('');
  const [rota, setRota] = useState<RotaDistanciaResult | null>(null);
  const [resultado, setResultado] = useState<TabelaFreteSimulacaoResult | null>(null);

  const isPending = simular.isPending || calcularRota.isPending;

  const resetResultado = () => {
    setRota(null);
    setResultado(null);
  };

  const ufsAtuais = resolveUfsFormulario(modo, {
    origemSimples: ufOrigemSimples,
    destinoSimples: ufDestinoSimples,
    origemAvancada: ufOrigem,
    destinoAvancada: ufDestino,
  });

  const handleModoChange = (next: ModoCotacao) => {
    setModo(next);
    resetResultado();
  };

  const handleModoRotaChange = (next: ModoRota) => {
    setModoRota(next);
    resetResultado();
  };

  const handleSimular = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tabelaId) {
      alert('Selecione o cliente ou a tabela para simular.');
      return;
    }
    const pesoNum = parseTabelaNumber(pesoKg);
    if (pesoNum == null || pesoNum <= 0) {
      alert('Informe um peso válido em kg (ex.: 1506,13).');
      return;
    }

    const { ufOrigem: ufO, ufDestino: ufD } = ufsAtuais;
    if ((ufO && !ufD) || (!ufO && ufD)) {
      alert('Informe UF de origem e destino para calcular o ICMS.');
      return;
    }

    let kmNum: number | null = null;
    let rotaCalculada: RotaDistanciaResult | null = null;

    if (modo === 'avancada') {
      try {
        if (modoRota === 'endereco') {
          if (!enderecoOrigem.label.trim() || !enderecoDestino.label.trim()) {
            alert('Informe endereço de origem e destino.');
            return;
          }
          rotaCalculada = await calcularRota.mutateAsync({
            modo: 'endereco',
            enderecoOrigem: enderecoOrigem.label.trim(),
            enderecoDestino: enderecoDestino.label.trim(),
            origemLat: enderecoOrigem.lat,
            origemLon: enderecoOrigem.lon,
            destinoLat: enderecoDestino.lat,
            destinoLon: enderecoDestino.lon,
          });
        } else {
          if (!cidadeOrigem.trim() || !cidadeDestino.trim()) {
            alert('Informe cidade de origem e destino.');
            return;
          }
          rotaCalculada = await calcularRota.mutateAsync({
            modo: 'cidade',
            cidadeOrigem: cidadeOrigem.trim(),
            cidadeDestino: cidadeDestino.trim(),
            ufOrigem: ufOrigem.trim() || undefined,
            ufDestino: ufDestino.trim() || undefined,
          });
        }
        kmNum = rotaCalculada.km;
        setRota(rotaCalculada);
      } catch (err) {
        alert(getComercialErrorMessage(err));
        return;
      }
    } else {
      kmNum = parseTabelaNumber(km);
      setRota(null);
      if (kmNum == null || kmNum <= 0) {
        alert('Informe uma distância válida em km.');
        return;
      }
    }

    simular.mutate(
      {
        id: tabelaId,
        payload: {
          km: kmNum,
          pesoKg: pesoNum,
          modalidade,
          valorNf: valorNf.trim() || null,
          ufOrigem: ufO,
          ufDestino: ufD,
        },
      },
      {
        onSuccess: async (data) => {
          const final = await aplicarIcmsSeNecessario(data, ufO, ufD);
          setResultado(final);
          if (rotaCalculada) setRota(rotaCalculada);
        },
        onError: (err) => alert(getComercialErrorMessage(err)),
      },
    );
  };

  const pendingLabel = calcularRota.isPending
    ? 'Calculando rota...'
    : simular.isPending
      ? 'Simulando...'
      : 'Simular';

  return (
    <div className="tabela-frete-simulador-inner">
      <div className="tabela-frete-simulador-modo-bar">
        <p className="tabela-frete-hint">
          Estime frete por km e peso antes de gerar proposta. Informe UF origem e destino para calcular ICMS.
        </p>
        <label className="tabela-frete-simulador-modo-toggle">
          <span>Cotação avançada</span>
          <input
            type="checkbox"
            role="switch"
            disabled={disabled}
            checked={modo === 'avancada'}
            onChange={(e) => handleModoChange(e.target.checked ? 'avancada' : 'simples')}
          />
        </label>
      </div>

      {modo === 'avancada' ? (
        <div className="tabela-frete-simulador-rota-modo">
          <span className="tabela-frete-simulador-rota-modo-label">Calcular por</span>
          <div className="tabela-frete-simulador-rota-modo-options">
            <button
              type="button"
              className={`tabela-frete-simulador-rota-modo-btn${modoRota === 'cidade' ? ' is-active' : ''}`}
              disabled={disabled}
              onClick={() => handleModoRotaChange('cidade')}
            >
              Cidade
            </button>
            <button
              type="button"
              className={`tabela-frete-simulador-rota-modo-btn${modoRota === 'endereco' ? ' is-active' : ''}`}
              disabled={disabled}
              onClick={() => handleModoRotaChange('endereco')}
            >
              Endereço
            </button>
          </div>
        </div>
      ) : null}

      <form className="tabela-frete-simulador-form" onSubmit={handleSimular}>
        {modo === 'simples' ? (
          <>
            <label className="tabela-frete-filter">
              <span>Distância (km)</span>
              <input type="number" min={1} step={1} disabled={disabled} value={km} onChange={(e) => setKm(e.target.value)} />
            </label>
            <label className="tabela-frete-filter tabela-frete-filter-uf">
              <span>UF origem</span>
              <select disabled={disabled} value={ufOrigemSimples} onChange={(e) => { setUfOrigemSimples(e.target.value); resetResultado(); }}>
                <option value="">—</option>
                {UFS_BRASIL.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </label>
            <label className="tabela-frete-filter tabela-frete-filter-uf">
              <span>UF destino</span>
              <select disabled={disabled} value={ufDestinoSimples} onChange={(e) => { setUfDestinoSimples(e.target.value); resetResultado(); }}>
                <option value="">—</option>
                {UFS_BRASIL.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </label>
          </>
        ) : modoRota === 'cidade' ? (
          <>
            <label className="tabela-frete-filter">
              <span>Cidade origem</span>
              <input
                type="text"
                disabled={disabled}
                value={cidadeOrigem}
                onChange={(e) => setCidadeOrigem(e.target.value)}
                placeholder="São Paulo"
              />
            </label>
            <label className="tabela-frete-filter tabela-frete-filter-uf">
              <span>UF</span>
              <input
                type="text"
                maxLength={2}
                disabled={disabled}
                value={ufOrigem}
                onChange={(e) => setUfOrigem(e.target.value.toUpperCase())}
                placeholder="SP"
              />
            </label>
            <label className="tabela-frete-filter">
              <span>Cidade destino</span>
              <input
                type="text"
                disabled={disabled}
                value={cidadeDestino}
                onChange={(e) => setCidadeDestino(e.target.value)}
                placeholder="Curitiba"
              />
            </label>
            <label className="tabela-frete-filter tabela-frete-filter-uf">
              <span>UF</span>
              <input
                type="text"
                maxLength={2}
                disabled={disabled}
                value={ufDestino}
                onChange={(e) => setUfDestino(e.target.value.toUpperCase())}
                placeholder="PR"
              />
            </label>
          </>
        ) : (
          <>
            <ComercialEnderecoAutocomplete
              label="Endereço origem"
              disabled={disabled}
              value={enderecoOrigem.label}
              placeholder="Rua, número, bairro, cidade"
              onChange={(label, coords) => setEnderecoOrigem({ label, ...coords })}
            />
            <ComercialEnderecoAutocomplete
              label="Endereço destino"
              disabled={disabled}
              value={enderecoDestino.label}
              placeholder="Rua, número, bairro, cidade"
              onChange={(label, coords) => setEnderecoDestino({ label, ...coords })}
            />
            <button
              type="button"
              className="reports-action-btn secondary cotar-mapa-abrir"
              disabled={disabled}
              onClick={() => setMapaOpen(true)}
            >
              <i className="bi bi-geo-alt" aria-hidden />
              Selecionar no mapa
            </button>
          </>
        )}
        <label className="tabela-frete-filter">
          <span>Peso (kg)</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            disabled={disabled}
            value={pesoKg}
            onChange={(e) => setPesoKg(e.target.value)}
            placeholder="1506,13"
          />
        </label>
        <label className="tabela-frete-filter">
          <span>Modalidade</span>
          <select disabled={disabled} value={modalidade} onChange={(e) => setModalidade(e.target.value as 'fracionado' | 'fechado')}>
            <option value="fracionado">Fracionado</option>
            <option value="fechado">Fechado</option>
          </select>
        </label>
        <label className="tabela-frete-filter">
          <span>Valor NF (opcional)</span>
          <input disabled={disabled} value={valorNf} onChange={(e) => setValorNf(e.target.value)} placeholder="GRIS / ADV" />
        </label>
        <button type="submit" className="reports-action-btn primary" disabled={disabled || isPending}>
          {pendingLabel}
        </button>
      </form>

      {modo === 'avancada' && rota && !resultado ? (
        <p className="tabela-frete-simulador-rota-resumo">
          Distância calculada: <strong>{rota.km} km</strong>
          {rota.provedor === 'google' ? ' (Google Maps)' : null}
        </p>
      ) : null}

      {resultado ? (
        <div className="tabela-frete-simulador-result">
          <SimuladorResultado
            resultado={resultado}
            rota={modo === 'avancada' ? rota : null}
          />
        </div>
      ) : null}

      <ComercialMapaEnderecosModal
        open={mapaOpen}
        origem={enderecoOrigem}
        destino={enderecoDestino}
        onClose={() => setMapaOpen(false)}
        onConfirm={(origemSel, destinoSel) => {
          setEnderecoOrigem(origemSel);
          setEnderecoDestino(destinoSel);
          if (origemSel.uf) setUfOrigem(origemSel.uf);
          if (destinoSel.uf) setUfDestino(destinoSel.uf);
          setMapaOpen(false);
          resetResultado();
        }}
      />
    </div>
  );
}
