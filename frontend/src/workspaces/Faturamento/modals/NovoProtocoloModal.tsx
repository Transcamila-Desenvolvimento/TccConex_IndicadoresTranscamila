import React, { useMemo, useState } from 'react';
import {
  getFaturamentoErrorMessage,
  useCreateProtocoloEnvio,
  useProtocoloClientes,
  useUpdateProtocoloEnvio,
} from '../../../hooks/useFaturamentoProtocolos';
import type { ProtocoloEnvio, ProtocoloExpedicao } from '../../../types/domain';
import { MAX_EXPEDICOES_POR_PROTOCOLO, MAX_NFS_POR_PROTOCOLO, PROTOCOLO_EXPEDICAO_OPTIONS } from '../../../types/domain';

interface NovoProtocoloModalProps {
  onClose: () => void;
  protocolo?: ProtocoloEnvio;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const MAX_NFS = MAX_NFS_POR_PROTOCOLO;

interface NotaItem {
  nf: string;
  filial?: string;
}

const NovoProtocoloModal: React.FC<NovoProtocoloModalProps> = ({ onClose, protocolo }) => {
  const isEditing = !!protocolo;
  const clientesQuery = useProtocoloClientes();
  const createProtocolo = useCreateProtocoloEnvio();
  const updateProtocolo = useUpdateProtocoloEnvio();

  const [data, setData] = useState(protocolo?.data ?? todayIso());
  const [clienteId, setClienteId] = useState(protocolo?.clienteId ?? '');
  const [expedicoes, setExpedicoes] = useState<ProtocoloExpedicao[]>(protocolo?.expedicoes ?? []);
  const [nfInput, setNfInput] = useState('');
  const [filialInput, setFilialInput] = useState('');
  const [notas, setNotas] = useState<NotaItem[]>(() => {
    if (!protocolo) return [];
    return protocolo.notasFiscais.map((nf) => ({
      nf,
      filial: protocolo.notasFiliais?.[nf],
    }));
  });

  const clientes = clientesQuery.data ?? [];
  const selectedCliente = useMemo(
    () => clientes.find((c) => c.id === clienteId),
    [clientes, clienteId],
  );
  const exigeFilial = selectedCliente?.exigeFilial ?? false;
  const filiaisDisponiveis = selectedCliente?.filiais ?? [];

  const addNota = () => {
    const value = nfInput.trim();
    if (!value) return;
    if (!/^\d+$/.test(value)) {
      alert('O número da nota fiscal deve conter apenas números.');
      return;
    }
    if (notas.length >= MAX_NFS) {
      alert(`O protocolo aceita no máximo ${MAX_NFS} notas fiscais.`);
      return;
    }
    if (notas.some((item) => item.nf === value)) {
      alert('Esta nota fiscal já foi adicionada.');
      return;
    }
    if (exigeFilial && !filialInput) {
      alert('Selecione a filial para esta nota fiscal.');
      return;
    }
    setNotas((prev) => [...prev, { nf: value, filial: filialInput || undefined }]);
    setNfInput('');
    setFilialInput('');
  };

  const removeNota = (nf: string) => setNotas((prev) => prev.filter((item) => item.nf !== nf));

  const toggleExpedicao = (valor: ProtocoloExpedicao) => {
    setExpedicoes((prev) => {
      if (prev.includes(valor)) return prev.filter((item) => item !== valor);
      if (prev.length >= MAX_EXPEDICOES_POR_PROTOCOLO) {
        alert(`Selecione no máximo ${MAX_EXPEDICOES_POR_PROTOCOLO} expedições.`);
        return prev;
      }
      return [...prev, valor];
    });
  };

  const buildNotasFiliais = (): Record<string, string> => {
    const map: Record<string, string> = {};
    notas.forEach(({ nf, filial }) => { if (filial) map[nf] = filial; });
    return map;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!clienteId) { alert('Selecione o cliente.'); return; }
    if (notas.length === 0) { alert('Adicione ao menos uma nota fiscal.'); return; }
    if (selectedCliente?.requerExpedicao && expedicoes.length === 0) { alert('Este cliente requer seleção de expedição.'); return; }
    if (exigeFilial) {
      const semFilial = notas.filter((item) => !item.filial).map((item) => item.nf);
      if (semFilial.length > 0) {
        alert(`As seguintes NFs não têm filial associada: ${semFilial.join(', ')}`);
        return;
      }
    }

    const notaFiscal = notas.map((item) => item.nf).join(', ');
    const notasFiliais = exigeFilial ? buildNotasFiliais() : {};
    const callbacks = {
      onSuccess: () => onClose(),
      onError: (error: unknown) => alert(getFaturamentoErrorMessage(error)),
    };

    const expedicoesSelecionadas = selectedCliente?.requerExpedicao ? expedicoes : [];

    if (isEditing) {
      updateProtocolo.mutate(
        {
          id: protocolo.id,
          payload: {
            data,
            clienteId,
            notaFiscal,
            notasFiliais,
            expedicoes: expedicoesSelecionadas,
          },
        },
        callbacks,
      );
    } else {
      createProtocolo.mutate({ data, clienteId, notaFiscal, notasFiliais, expedicoes: expedicoesSelecionadas }, callbacks);
    }
  };

  const isPending = createProtocolo.isPending || updateProtocolo.isPending;

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', alignItems: 'center', padding: '24px 16px', zIndex: 3000 }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="modal-card" style={{ width: 'min(720px, 100%)' }}>
        <div className="modal-header">
          <h3>{isEditing ? `Editar protocolo #${protocolo.protocoloNumero}` : 'Novo protocolo de envio'}</h3>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Fechar">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-grid two-cols">
            <label>
              Data de envio
              <input type="date" className="form-input" value={data} onChange={(e) => setData(e.target.value)} required />
            </label>
            <label>
              Cliente
              <select
                className="form-input"
                value={clienteId}
                onChange={(e) => { setClienteId(e.target.value); setNotas([]); setFilialInput(''); }}
                required
              >
                <option value="">Selecione...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </label>
          </div>

          {selectedCliente?.requerExpedicao && (
            <div style={{ marginTop: '12px' }}>
              <label>Expedição (selecione até {MAX_EXPEDICOES_POR_PROTOCOLO})</label>
              <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '6px', marginTop: '6px', width: '100%' }}>
                {PROTOCOLO_EXPEDICAO_OPTIONS.map((option) => {
                  const checked = expedicoes.includes(option);
                  const disabled = !checked && expedicoes.length >= MAX_EXPEDICOES_POR_PROTOCOLO;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleExpedicao(option)}
                      disabled={disabled}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        flex: '1 1 0',
                        minWidth: 0,
                        padding: '7px 8px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        border: checked ? '1px solid #118CC4' : '1px solid #cbd5e1',
                        background: checked ? '#118CC4' : '#fff',
                        color: checked ? '#fff' : '#475569',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        opacity: disabled ? 0.55 : 1,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {checked && <i className="bi bi-check-lg" style={{ fontSize: '11px' }} />}
                      {option}
                    </button>
                  );
                })}
              </div>
              {expedicoes.length === MAX_EXPEDICOES_POR_PROTOCOLO && (
                <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', marginBottom: 0 }}>
                  <i className="bi bi-info-circle" style={{ marginRight: '4px' }} />
                  Limite de {MAX_EXPEDICOES_POR_PROTOCOLO} expedições por protocolo atingido.
                </p>
              )}
            </div>
          )}

          {/* Seção de NFs */}
          <div style={{ marginTop: '16px' }}>
            <label>Notas fiscais ({notas.length}/{MAX_NFS})</label>

            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
              <input
                className="form-input"
                style={{ flex: 1, minWidth: '140px' }}
                value={nfInput}
                onChange={(e) => setNfInput(e.target.value.replace(/\D/g, ''))}
                placeholder="Número da NF (somente números)"
                inputMode="numeric"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNota(); } }}
              />
              {exigeFilial && (
                <select
                  className="form-input"
                  style={{ flex: 1, minWidth: '140px' }}
                  value={filialInput}
                  onChange={(e) => setFilialInput(e.target.value)}
                >
                  <option value="">Selecione a filial...</option>
                  {filiaisDisponiveis.map((f) => (
                    <option key={f.id} value={f.nome}>{f.nome}</option>
                  ))}
                </select>
              )}
              <button type="button" className="reports-action-btn secondary" style={{ flexShrink: 0 }} onClick={addNota}>
                Adicionar
              </button>
            </div>

            {notas.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                {notas.map((item) => (
                  <span
                    key={item.nf}
                    className="tag-chip"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    title={item.filial ? `Filial: ${item.filial}` : undefined}
                  >
                    <span>{item.nf}</span>
                    {item.filial && (
                      <span style={{ color: '#118CC4', fontSize: '10px', fontWeight: 700, background: 'rgba(17,140,196,0.12)', padding: '1px 5px', borderRadius: '8px' }}>
                        {item.filial}
                      </span>
                    )}
                    <button type="button" onClick={() => removeNota(item.nf)} aria-label={`Remover ${item.nf}`}>×</button>
                  </span>
                ))}
              </div>
            )}

            {exigeFilial && notas.length > 0 && (
              <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px', marginBottom: 0 }}>
                <i className="bi bi-info-circle" style={{ marginRight: '4px' }} />
                Cada NF deve ter uma filial associada.
              </p>
            )}
          </div>

          <div className="modal-footer" style={{ marginTop: '20px' }}>
            <button type="button" className="reports-action-btn secondary" onClick={onClose}>Cancelar</button>
            <button
              type="submit"
              className="reports-action-btn primary"
              style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
              disabled={isPending}
            >
              {isPending ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Registrar protocolo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NovoProtocoloModal;
