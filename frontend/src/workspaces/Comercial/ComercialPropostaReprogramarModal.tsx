import React, { useMemo, useState } from 'react';
import {
  getComercialErrorMessage,
  useReprogramarValidadePropostas,
} from '../../hooks/useComercialClientes';
import type { ClienteComercial, PropostaComercial } from '../../types/domain';
import { generatePropostaComercialPdfBlob } from './printPropostaComercial';
import { addDaysISO, diasDoPrazo } from './validadeProposta';

interface ComercialPropostaReprogramarModalProps {
  propostas: PropostaComercial[];
  prazos: string[];
  clienteFor: (proposta: PropostaComercial) => ClienteComercial | null | undefined;
  onClose: (saved: boolean) => void;
}

const todayISO = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const formatDateBr = (value?: string | null) => {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const PDF_EMAIL_SAFE_BYTES = 5.5 * 1024 * 1024;

const vencimentoAtual = (proposta: PropostaComercial) => (proposta.dataVencimento || '').slice(0, 10);

const ComercialPropostaReprogramarModal: React.FC<ComercialPropostaReprogramarModalProps> = ({
  propostas,
  prazos,
  clienteFor,
  onClose,
}) => {
  const reprogramar = useReprogramarValidadePropostas();
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const hoje = todayISO();
  const opcoes = prazos.length ? prazos : ['5 dias', '7 dias', '15 dias', '30 dias', '45 dias', '60 dias'];
  const prazoInicial = opcoes.find((opcao) => {
    const dias = diasDoPrazo(opcao);
    if (dias == null) return false;
    return propostas.every((item) => {
      const atual = vencimentoAtual(item);
      return Boolean(atual && addDaysISO(atual, dias) >= hoje);
    });
  }) || opcoes[0];
  const [prazo, setPrazo] = useState(prazoInicial);
  const [modo, setModo] = useState<'prazo' | 'manual'>('prazo');
  const [dataManual, setDataManual] = useState('');
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const jaEnviada = propostas.some((item) => item.status !== 'rascunho');
  const numeros = propostas
    .map((item) => item.numeroIdentificacao)
    .filter(Boolean)
    .join(', ');
  const unica = propostas.length === 1 ? propostas[0] : null;
  const semVencimento = propostas.filter((item) => !vencimentoAtual(item));

  const minManual = useMemo(() => {
    let minimo = hoje;
    propostas.forEach((item) => {
      const atual = vencimentoAtual(item);
      if (!atual) return;
      const seguinte = addDaysISO(atual, 1);
      if (seguinte > minimo) minimo = seguinte;
    });
    return minimo;
  }, [propostas, hoje]);

  const projetarPrazo = (opcao: string) => {
    const dias = diasDoPrazo(opcao);
    if (dias == null) return [];
    return propostas.map((item) => {
      const atual = vencimentoAtual(item);
      return { item, atual, novo: atual ? addDaysISO(atual, dias) : '' };
    });
  };

  const prazoAlcancaVigencia = (opcao: string) => {
    const linhas = projetarPrazo(opcao);
    return linhas.length > 0 && linhas.every((linha) => linha.novo && linha.novo >= hoje);
  };

  const previsoes = useMemo(() => {
    if (modo === 'manual') {
      return propostas.map((item) => ({ item, atual: vencimentoAtual(item), novo: dataManual }));
    }
    return projetarPrazo(prazo);
  }, [modo, dataManual, prazo, propostas]);

  const previsaoUnica = unica ? (previsoes[0]?.novo || '') : '';
  const podeConfirmar = semVencimento.length === 0 && (
    modo === 'prazo'
      ? prazoAlcancaVigencia(prazo)
      : Boolean(dataManual) && dataManual >= minManual
  );
  const ocupado = gerandoPdf || reprogramar.isPending;

  const confirmar = async (enviarAviso: boolean) => {
    if (!podeConfirmar || ocupado) return;
    const enviadas = propostas.filter((item) => item.status !== 'rascunho');
    let pdfs: Blob[] | undefined;
    if (enviarAviso && enviadas.length > 0) {
      const porId = new Map(previsoes.map((linha) => [linha.item.id, linha.novo]));
      const atualizadas = enviadas.map((item) => ({
        ...item,
        dataVencimento: porId.get(item.id) || item.dataVencimento,
      }));
      const gerar = async (compact: boolean) => {
        const arquivos: Blob[] = [];
        for (const item of atualizadas) {
          arquivos.push(await generatePropostaComercialPdfBlob(item, clienteFor(item), { compact }));
        }
        return arquivos;
      };
      setGerandoPdf(true);
      try {
        pdfs = await gerar(false);
        if (pdfs.reduce((total, arquivo) => total + arquivo.size, 0) > PDF_EMAIL_SAFE_BYTES) {
          pdfs = await gerar(true);
        }
      } catch {
        alert('Não foi possível gerar o PDF da proposta.');
        setGerandoPdf(false);
        return;
      }
      setGerandoPdf(false);
    }
    try {
      const resultado = await reprogramar.mutateAsync({
        ids: propostas.map((item) => item.id),
        validade: modo === 'prazo' ? prazo : undefined,
        dataVencimento: modo === 'manual' ? dataManual : undefined,
        enviarAviso,
        pdfs,
      });
      const falhas = resultado.aviso?.falhas ?? [];
      const enviados = resultado.aviso?.enviados ?? 0;
      const data = resultado.dataVencimento || previsaoUnica;
      let mensagem = propostas.length === 1
        ? `Vencimento prorrogado para ${formatDateBr(data)}. A validade continua ${unica?.validade || 'a original'}.`
        : `Vencimento prorrogado em ${propostas.length} propostas. A validade original de cada uma foi mantida.`;
      if (enviarAviso && enviados > 0) {
        mensagem += enviados === 1
          ? ' A proposta foi reenviada ao cliente com o aviso de prorrogação.'
          : ` ${enviados} propostas foram reenviadas com o aviso de prorrogação.`;
      }
      if (falhas.length) {
        mensagem += ` ${falhas.join(' ')}`;
      }
      setSucesso(mensagem);
    } catch (err) {
      alert(getComercialErrorMessage(err));
    }
  };

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', zIndex: 3100 }}
      onClick={(e) => { if (e.target === e.currentTarget && !ocupado) onClose(Boolean(sucesso)); }}
    >
      <div className="search-modal-card" role="dialog" aria-modal="true" aria-labelledby="reprogramar-validade-titulo" style={{ width: '560px' }}>
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 id="reprogramar-validade-titulo" style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
            Prorrogar vencimento
          </h3>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={() => onClose(Boolean(sucesso))}>Fechar (X)</span>
        </div>

        {sucesso ? (
          <div style={{ padding: '20px 24px 24px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: 14 }}>
              {sucesso}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button type="button" className="reports-action-btn primary" onClick={() => onClose(true)}>Fechar</button>
            </div>
          </div>
        ) : confirmando ? (
          <div style={{ padding: '16px 24px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#1e293b', lineHeight: 1.5 }}>
              {propostas.length === 1
                ? `Tem certeza que deseja prorrogar o vencimento da proposta ${numeros || ''}?`
                : `Tem certeza que deseja prorrogar o vencimento das ${propostas.length} propostas selecionadas?`}
            </p>
            {unica && previsaoUnica ? (
              <p style={{ margin: 0, fontSize: 13, color: '#0f2744' }}>
                Vencimento atual {formatDateBr(vencimentoAtual(unica))} · passa a vencer em <strong>{formatDateBr(previsaoUnica)}</strong>.
                A validade continua <strong>{unica.validade || '—'}</strong>.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#0f2744', lineHeight: 1.5 }}>
                {previsoes.map((linha) => (
                  <li key={linha.item.id}>
                    {linha.item.numeroIdentificacao || linha.item.titulo}: {formatDateBr(linha.atual)} → <strong>{formatDateBr(linha.novo)}</strong>
                    {linha.item.validade ? ` · validade ${linha.item.validade}` : ''}
                  </li>
                ))}
              </ul>
            )}
            {jaEnviada ? (
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: '#9a3412', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 6, padding: '10px 12px' }}>
                {propostas.filter((item) => item.status !== 'rascunho').length === 1 && propostas.length === 1
                  ? 'A proposta será reenviada ao cliente com o aviso de prorrogação.'
                  : 'As propostas já enviadas serão reenviadas ao cliente com o aviso de prorrogação.'}
              </p>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="reports-action-btn secondary" disabled={ocupado} onClick={() => setConfirmando(false)}>
                Voltar
              </button>
              <button
                type="button"
                className="reports-action-btn primary"
                disabled={ocupado}
                onClick={() => { void confirmar(jaEnviada); }}
              >
                {gerandoPdf
                  ? 'Gerando PDF...'
                  : reprogramar.isPending
                    ? (jaEnviada ? 'Reenviando...' : 'Salvando...')
                    : 'Confirmar prorrogação'}
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (podeConfirmar) setConfirmando(true);
            }}
            style={{ padding: '16px 24px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
              {unica
                ? `A validade da proposta ${numeros || ''} continua ${unica.validade || 'a original'}, contada da data da proposta. O prazo abaixo soma dias ao vencimento atual (${formatDateBr(vencimentoAtual(unica))}).`
                : 'A validade original de cada proposta é mantida. O prazo soma dias ao vencimento atual de cada uma.'}
            </p>
            {semVencimento.length > 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: '#9a3412' }}>
                {semVencimento.length === 1
                  ? 'Esta proposta não tem data de vencimento para prorrogar.'
                  : 'Há propostas sem data de vencimento. A prorrogação vale só para quem já tem vencimento.'}
              </p>
            ) : null}

            <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <legend style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>Prazo a somar</legend>
              {opcoes.map((opcao) => {
                const linhas = projetarPrazo(opcao);
                const novo = unica ? linhas[0]?.novo : '';
                const alcanca = prazoAlcancaVigencia(opcao);
                return (
                  <label key={opcao} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: alcanca ? '#334155' : '#94a3b8', cursor: alcanca ? 'pointer' : 'not-allowed' }}>
                    <input
                      type="radio"
                      name="reprogramar-prazo"
                      checked={modo === 'prazo' && prazo === opcao}
                      disabled={ocupado || !alcanca}
                      onChange={() => { setModo('prazo'); setPrazo(opcao); }}
                    />
                    <span>
                      {opcao}
                      {unica && novo ? ` — vence em ${formatDateBr(novo)}` : ''}
                      {!alcanca ? ' · continua vencida' : ''}
                    </span>
                  </label>
                );
              })}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#334155', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="reprogramar-prazo"
                  checked={modo === 'manual'}
                  disabled={ocupado || semVencimento.length > 0}
                  onChange={() => setModo('manual')}
                />
                <span>Data manual</span>
              </label>
              {modo === 'manual' ? (
                <input
                  type="date"
                  className="form-input"
                  min={minManual}
                  value={dataManual}
                  disabled={ocupado}
                  onChange={(event) => setDataManual(event.target.value)}
                  required
                  aria-label="Nova data de vencimento"
                  style={{ maxWidth: 220 }}
                />
              ) : null}
            </fieldset>

            {modo === 'prazo' && unica && previsaoUnica ? (
              <p style={{ margin: 0, fontSize: 13, color: '#0f2744' }}>
                {prazo} a partir de {formatDateBr(vencimentoAtual(unica))} · vence em <strong>{formatDateBr(previsaoUnica)}</strong>
              </p>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="reports-action-btn secondary" disabled={ocupado} onClick={() => onClose(false)}>
                Cancelar
              </button>
              <button
                type="submit"
                className="reports-action-btn primary"
                disabled={ocupado || !podeConfirmar}
              >
                Prorrogar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ComercialPropostaReprogramarModal;
