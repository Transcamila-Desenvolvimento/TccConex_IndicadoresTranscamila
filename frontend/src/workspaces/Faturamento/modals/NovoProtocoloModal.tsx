import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  getFaturamentoErrorMessage,
  useCreateProtocoloEnvio,
  useDeleteProtocoloEnvioDraft,
  useProtocoloClientes,
  useProtocoloEnvioDraft,
  useSaveProtocoloEnvioDraft,
  useUpdateProtocoloEnvio,
} from '../../../hooks/useFaturamentoProtocolos';
import type { ProtocoloEnvio, ProtocoloExpedicao, ProtocoloNotaDraft } from '../../../types/domain';
import { MAX_EXPEDICOES_POR_PROTOCOLO, MAX_NFS_POR_PROTOCOLO, PROTOCOLO_EXPEDICAO_OPTIONS } from '../../../types/domain';

interface NovoProtocoloModalProps {
  onClose: () => void;
  protocolo?: ProtocoloEnvio;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const MAX_NFS = MAX_NFS_POR_PROTOCOLO;

type NotaItem = ProtocoloNotaDraft;

function formatDraftTime(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

const NovoProtocoloModal: React.FC<NovoProtocoloModalProps> = ({ onClose, protocolo }) => {
  const isEditing = !!protocolo;
  const clientesQuery = useProtocoloClientes();
  const createProtocolo = useCreateProtocoloEnvio();
  const updateProtocolo = useUpdateProtocoloEnvio();
  const draftQuery = useProtocoloEnvioDraft(!isEditing);
  const saveDraft = useSaveProtocoloEnvioDraft();
  const deleteDraft = useDeleteProtocoloEnvioDraft();

  const [data, setData] = useState(protocolo?.data ?? todayIso());
  const [clienteId, setClienteId] = useState(protocolo?.clienteId ?? '');
  const [expedicoes, setExpedicoes] = useState<ProtocoloExpedicao[]>(protocolo?.expedicoes ?? []);
  const [nfInput, setNfInput] = useState('');
  const [filialInput, setFilialInput] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  /** Índice de inserção (0 = antes da 1ª, notas.length = depois da última). */
  const [dropInsertIndex, setDropInsertIndex] = useState<number | null>(null);
  const [notas, setNotas] = useState<NotaItem[]>(() => {
    if (!protocolo) return [];
    return protocolo.notasFiscais.map((nf) => ({
      nf,
      filial: protocolo.notasFiliais?.[nf],
    }));
  });
  const [hydrated, setHydrated] = useState(isEditing);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [draftUnavailable, setDraftUnavailable] = useState(false);
  const skipNextSave = useRef(true);

  const clientes = clientesQuery.data ?? [];
  const selectedCliente = useMemo(
    () => clientes.find((c) => c.id === clienteId),
    [clientes, clienteId],
  );
  const exigeFilial = selectedCliente?.exigeFilial ?? false;
  const filiaisDisponiveis = selectedCliente?.filiais ?? [];

  useEffect(() => {
    if (isEditing || hydrated || draftQuery.isLoading) return;

    if (draftQuery.isError) {
      setDraftUnavailable(true);
      setHydrated(true);
      skipNextSave.current = true;
      return;
    }

    const draft = draftQuery.data;
    if (draft?.hasDraft) {
      setData(draft.data || todayIso());
      setClienteId(draft.clienteId || '');
      setExpedicoes((draft.expedicoes ?? []).filter((item): item is ProtocoloExpedicao =>
        (PROTOCOLO_EXPEDICAO_OPTIONS as readonly string[]).includes(item),
      ));
      setNotas(draft.notas ?? []);
      setNfInput(draft.nfInput || '');
      setFilialInput(draft.filialInput || '');
      setDraftUpdatedAt(draft.updatedAt);
      setRestoredDraft(true);
      setDraftUnavailable(false);
    }
    setHydrated(true);
    skipNextSave.current = true;
  }, [isEditing, draftQuery.data, draftQuery.isError, draftQuery.isLoading, hydrated]);

  useEffect(() => {
    if (isEditing || !hydrated || draftUnavailable) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      saveDraft.mutate(
        {
          data,
          clienteId,
          expedicoes,
          notas,
          nfInput,
          filialInput,
        },
        {
          onSuccess: (result) => {
            setDraftUpdatedAt(result.hasDraft ? result.updatedAt : null);
            if (!result.hasDraft) setRestoredDraft(false);
            setDraftUnavailable(false);
          },
          onError: () => {
            setDraftUnavailable(true);
          },
        },
      );
    }, 500);
    return () => window.clearTimeout(timer);
  }, [isEditing, hydrated, data, clienteId, expedicoes, notas, nfInput, filialInput]); // eslint-disable-line react-hooks/exhaustive-deps -- debounce saveDraft

  const addNota = () => {
    const value = nfInput.trim();
    if (!value) return;
    if (!/^\d+([/-]\d+)*$/.test(value)) {
      alert('O número da nota fiscal deve conter apenas números, podendo usar "/" ou "-" para indicar a série (ex.: 3455-3).');
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

  const reorderNotaToInsert = (from: number, insertAt: number) => {
    setNotas((prev) => {
      if (from < 0 || from >= prev.length) return prev;
      let to = Math.max(0, Math.min(insertAt, prev.length));
      // Ao remover o item, índices à direita recuam 1.
      if (to > from) to -= 1;
      if (to === from) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const clearDragState = () => {
    setDragIndex(null);
    setDropInsertIndex(null);
  };

  const updateDropInsertFromChip = (event: React.DragEvent<HTMLElement>, index: number) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const rect = event.currentTarget.getBoundingClientRect();
    const insertAt = event.clientX < rect.left + rect.width / 2 ? index : index + 1;
    if (dropInsertIndex !== insertAt) setDropInsertIndex(insertAt);
  };

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

  const clearDraftThenClose = () => {
    if (isEditing) {
      onClose();
      return;
    }
    deleteDraft.mutate(undefined, {
      onSettled: () => onClose(),
    });
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
      onSuccess: () => {
        if (isEditing) onClose();
        else clearDraftThenClose();
      },
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

  const isPending = createProtocolo.isPending || updateProtocolo.isPending || deleteDraft.isPending;

  const hasUnsavedEdit = (() => {
    if (!isEditing || !protocolo) return false;
    const nfsOriginais = protocolo.notasFiscais;
    const nfsAtuais = notas.map((item) => item.nf);
    if (
      data !== protocolo.data
      || clienteId !== protocolo.clienteId
      || nfsAtuais.length !== nfsOriginais.length
      || nfsAtuais.some((nf, i) => nf !== nfsOriginais[i])
    ) {
      return true;
    }
    const expedicoesOriginais = protocolo.expedicoes ?? [];
    if (
      expedicoes.length !== expedicoesOriginais.length
      || expedicoes.some((item, i) => item !== expedicoesOriginais[i])
    ) {
      return true;
    }
    const filiaisOriginais = protocolo.notasFiliais ?? {};
    return notas.some(({ nf, filial }) => (filial || '') !== (filiaisOriginais[nf] || ''));
  })();

  const requestClose = () => {
    if (isPending) return;
    // Novo protocolo: o rascunho já está na conta — fecha sem descartar.
    if (!isEditing) {
      onClose();
      return;
    }
    if (hasUnsavedEdit) {
      if (!window.confirm('Há alterações não salvas neste protocolo. Deseja fechar e descartar?')) return;
    }
    onClose();
  };

  const discardDraft = () => {
    if (!window.confirm('Descartar o rascunho deste protocolo? As NFs e dados salvos serão apagados.')) return;
    deleteDraft.mutate(undefined, {
      onSuccess: () => onClose(),
      onError: (error) => alert(getFaturamentoErrorMessage(error) || 'Não foi possível descartar o rascunho.'),
    });
  };

  if (!isEditing && !hydrated) {
    return (
      <div
        className="search-backdrop"
        style={{ display: 'flex', alignItems: 'center', padding: '24px 16px', zIndex: 3000 }}
      >
        <div className="modal-card" style={{ width: 'min(720px, 100%)', padding: '32px', textAlign: 'center' }}>
          Carregando rascunho...
        </div>
      </div>
    );
  }

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', alignItems: 'center', padding: '24px 16px', zIndex: 3000 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div className="modal-card" style={{ width: 'min(720px, 100%)' }} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <h3>{isEditing ? `Editar protocolo #${protocolo.protocoloNumero}` : 'Novo protocolo de envio'}</h3>
            {!isEditing && draftUnavailable && (
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#b45309' }}>
                Rascunho indisponível no servidor — você pode preencher normalmente, mas nada será salvo automaticamente.
              </p>
            )}
            {!isEditing && !draftUnavailable && (restoredDraft || draftUpdatedAt) && (
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                Rascunho na sua conta
                {draftUpdatedAt ? ` · ${formatDraftTime(draftUpdatedAt)}` : ''}
                {saveDraft.isPending ? ' · salvando…' : ''}
              </p>
            )}
          </div>
          <button type="button" className="btn-icon" onClick={requestClose} aria-label="Fechar" disabled={isPending}>
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

          <div style={{ marginTop: '16px' }}>
            <label>Notas fiscais ({notas.length}/{MAX_NFS})</label>

            <div className="protocolo-nf-row">
              <input
                className="form-input"
                style={{ flex: 1, minWidth: '140px' }}
                value={nfInput}
                onChange={(e) => setNfInput(e.target.value.replace(/[^\d/-]/g, ''))}
                placeholder="Número da NF (ex.: 3455 ou 3455-3)"
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
              <button
                type="button"
                className="protocolo-add-nf-btn"
                onClick={addNota}
              >
                <i className="bi bi-plus-lg" aria-hidden="true" />
                Adicionar
              </button>
            </div>

            {notas.length > 0 && (
              <div
                className={`tag-chip-list${dragIndex !== null ? ' is-dragging' : ''}`}
                onDragOver={(e) => {
                  if (dragIndex === null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromRaw = e.dataTransfer.getData('text/plain');
                  const from = Number.parseInt(fromRaw, 10);
                  if (Number.isFinite(from) && dropInsertIndex !== null) {
                    reorderNotaToInsert(from, dropInsertIndex);
                  }
                  clearDragState();
                }}
              >
                {notas.map((item, index) => {
                  const showMarkerBefore =
                    dragIndex !== null
                    && dropInsertIndex === index
                    && dragIndex !== index
                    && dragIndex + 1 !== index;

                  const chipClass = [
                    'tag-chip',
                    'tag-chip--draggable',
                    dragIndex === index ? 'tag-chip--dragging' : '',
                  ].filter(Boolean).join(' ');

                  return (
                    <React.Fragment key={item.nf}>
                      {showMarkerBefore && (
                        <span className="tag-chip-insert-marker" aria-hidden="true" />
                      )}
                      <span
                        className={chipClass}
                        draggable
                        onDragStart={(e) => {
                          setDragIndex(index);
                          setDropInsertIndex(index);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', String(index));
                        }}
                        onDragEnd={clearDragState}
                        onDragOver={(e) => updateDropInsertFromChip(e, index)}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const fromRaw = e.dataTransfer.getData('text/plain');
                          const from = Number.parseInt(fromRaw, 10);
                          const rect = e.currentTarget.getBoundingClientRect();
                          const insertAt = e.clientX < rect.left + rect.width / 2 ? index : index + 1;
                          if (Number.isFinite(from)) reorderNotaToInsert(from, insertAt);
                          clearDragState();
                        }}
                        title={
                          item.filial
                            ? `Filial: ${item.filial} — arraste para antes, entre ou depois`
                            : 'Arraste para antes, entre ou depois'
                        }
                      >
                        <span>{item.nf}</span>
                        {item.filial && (
                          <span className="tag-chip__filial">{item.filial}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeNota(item.nf)}
                          onMouseDown={(e) => e.stopPropagation()}
                          aria-label={`Remover ${item.nf}`}
                        >
                          ×
                        </button>
                      </span>
                    </React.Fragment>
                  );
                })}
                {dragIndex !== null
                  && dropInsertIndex === notas.length
                  && dragIndex !== notas.length - 1 && (
                  <span className="tag-chip-insert-marker" aria-hidden="true" />
                )}
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
            {!isEditing && (restoredDraft || draftUpdatedAt) && (
              <button
                type="button"
                className="reports-action-btn secondary"
                onClick={discardDraft}
                disabled={isPending}
                title="Apaga o rascunho da sua conta"
              >
                Descartar rascunho
              </button>
            )}
            <button type="button" className="reports-action-btn secondary" onClick={requestClose} disabled={isPending}>
              {isEditing ? 'Cancelar' : 'Fechar'}
            </button>
            <button
              type="submit"
              className="reports-action-btn primary"
              style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
              disabled={isPending}
            >
              {isPending && !deleteDraft.isPending
                ? 'Salvando...'
                : isEditing
                  ? 'Salvar alterações'
                  : 'Registrar protocolo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NovoProtocoloModal;
