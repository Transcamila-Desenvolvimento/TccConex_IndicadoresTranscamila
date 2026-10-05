import React, { useEffect, useMemo, useRef, useState } from 'react';
import camiloLogo from '../../assets/camilo-logo.png';
import { useAuth } from '../../contexts/AuthContext';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  useCamiloAgentes,
  useCamiloChatPadrao,
  useCamiloPartes,
  useConsultarCamiloAgente,
  useConversarCamilo,
  useCreateCamiloAgente,
  useDeleteCamiloAgente,
  useUpdateCamiloAgente,
} from '../../hooks/useCamiloAgentes';
import type { CamiloAgente } from '../../types/domain';
import CamiloTexto from './CamiloTexto';

const STORAGE_PREFIX = 'tccconex.agente-camilo.threads';

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}.${userId}`;
}
const LIMITE_CONTEXTO = 24000;

const SUGGESTIONS = [
  { icon: 'bi-pencil', label: 'Escreva ou edite', prompt: 'Escreva um texto curto para comunicação interna.' },
  { icon: 'bi-card-text', label: 'Resuma um assunto', prompt: 'Resuma os pontos principais de um processo interno.' },
  { icon: 'bi-list-check', label: 'Organize uma pauta', prompt: 'Ajude a organizar a pauta de uma reunião.' },
] as const;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
  agentId?: string;
  agentName?: string;
  contextoUsado?: number;
  contextoLimite?: number;
}

function newId() {
  return crypto.randomUUID();
}

function isThread(value: unknown): value is ChatThread {
  if (!value || typeof value !== 'object') return false;
  const thread = value as ChatThread;
  if (thread.agentId != null && typeof thread.agentId !== 'string') return false;
  if (thread.agentName != null && typeof thread.agentName !== 'string') return false;
  if (thread.contextoUsado != null && typeof thread.contextoUsado !== 'number') return false;
  if (thread.contextoLimite != null && typeof thread.contextoLimite !== 'number') return false;
  return typeof thread.id === 'string'
    && typeof thread.title === 'string'
    && typeof thread.updatedAt === 'number'
    && Array.isArray(thread.messages);
}

function contextoDoChat(thread: ChatThread) {
  const limite = thread.contextoLimite || LIMITE_CONTEXTO;
  const usado = thread.contextoUsado ?? thread.messages.reduce((total, message) => total + message.text.length, 0);
  const percentual = limite > 0 ? Math.min(100, Math.round((usado / limite) * 100)) : 0;
  return { usado, limite, percentual };
}

function RodinhaContexto({ usado, limite }: { usado: number; limite: number }) {
  const percentual = limite > 0 ? Math.min(100, (usado / limite) * 100) : 0;
  const raio = 7.5;
  const volta = 2 * Math.PI * raio;
  const preenchido = (percentual / 100) * volta;
  const faixa = percentual >= 90 ? ' is-full' : percentual >= 70 ? ' is-high' : '';
  return (
    <span
      className={`camilo-context-ring${faixa}`}
      role="img"
      aria-label={`Contexto ${Math.round(percentual)}%`}
      title="Contexto da conversa"
    >
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
        <circle className="camilo-context-ring-track" cx="10" cy="10" r={raio} />
        <circle
          className="camilo-context-ring-fill"
          cx="10"
          cy="10"
          r={raio}
          strokeDasharray={`${preenchido} ${volta}`}
          transform="rotate(-90 10 10)"
        />
      </svg>
    </span>
  );
}

function rememberThread(
  current: ChatThread[],
  threadId: string,
  message: ChatMessage,
  agent?: { id: string; nome: string },
  titulo?: string,
  contexto?: { usado: number; limite: number },
): ChatThread[] {
  const now = Date.now();
  const existing = current.find((thread) => thread.id === threadId);
  const tituloLimpo = titulo?.trim();
  const next: ChatThread = existing
    ? {
      ...existing,
      agentName: agent?.nome ?? existing.agentName,
      title: tituloLimpo || (existing.messages.length === 0 ? threadTitle(message.text) : existing.title),
      messages: [...existing.messages, message],
      updatedAt: now,
      ...(contexto ? { contextoUsado: contexto.usado, contextoLimite: contexto.limite } : {}),
    }
    : {
      id: threadId,
      title: tituloLimpo || threadTitle(message.text),
      messages: [message],
      updatedAt: now,
      ...(agent ? { agentId: agent.id, agentName: agent.nome } : {}),
    };
  return [next, ...current.filter((thread) => thread.id !== threadId)];
}

function erroApi(error: unknown): string {
  const data = (error as { response?: { data?: { detail?: unknown; escopos?: unknown } } })?.response?.data;
  if (typeof data?.detail === 'string' && data.detail.trim()) return data.detail;
  if (Array.isArray(data?.escopos) && typeof data.escopos[0] === 'string') return data.escopos[0];
  return 'Não foi possível concluir a operação.';
}

function escopoKey(ambiente: string, parte: string) {
  return `${ambiente}::${parte}`;
}

function loadThreads(userId: string): ChatThread[] {
  try {
    const raw = sessionStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isThread);
  } catch {
    return [];
  }
}

function threadTitle(text: string) {
  const line = text.trim().split('\n')[0] ?? 'Nova conversa';
  return line.length > 42 ? `${line.slice(0, 42)}…` : line;
}

const AgenteCamiloChat: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [hydratedFor, setHydratedFor] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [panel, setPanel] = useState<'chat' | 'agentes'>('chat');
  const [formMode, setFormMode] = useState<'create' | string | null>(null);
  const [agentName, setAgentName] = useState('');
  const [agentInstruction, setAgentInstruction] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [draftAgentId, setDraftAgentId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const partesQuery = useCamiloPartes();
  const chatPadraoQuery = useCamiloChatPadrao();
  const agentesQuery = useCamiloAgentes();
  const agentesState = useAsyncQueryState(agentesQuery);
  const createAgent = useCreateCamiloAgente();
  const updateAgent = useUpdateCamiloAgente();
  const deleteAgent = useDeleteCamiloAgente();
  const consultarAgent = useConsultarCamiloAgente();
  const conversarCamilo = useConversarCamilo();
  const agents = agentesQuery.data ?? [];
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const active = useMemo(
    () => threads.find((thread) => thread.id === activeId) ?? null,
    [threads, activeId],
  );
  const conversationAgentId = active?.agentId ?? draftAgentId;
  const activeAgent = agents.find((agent) => agent.id === conversationAgentId) ?? null;
  const agentGone = Boolean(active?.agentId) && agentesQuery.isSuccess && !activeAgent;
  const chatNome = chatPadraoQuery.data?.nome?.trim() || 'Camilo';
  const authorName = activeAgent?.nome ?? active?.agentName ?? chatNome;

  useEffect(() => {
    if (!userId) {
      setThreads([]);
      setHydratedFor('');
      setActiveId(null);
      return;
    }
    setThreads(loadThreads(userId));
    setHydratedFor(userId);
    setActiveId(null);
    setDraftAgentId(null);
  }, [userId]);

  useEffect(() => {
    if (!userId || hydratedFor !== userId) return;
    sessionStorage.setItem(storageKey(userId), JSON.stringify(threads));
  }, [threads, userId, hydratedFor]);

  useEffect(() => {
    const node = threadRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [active?.messages.length, pendingId]);

  useEffect(() => {
    if (!pickerOpen) return undefined;
    const close = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);

  const chooseChat = (agent: CamiloAgente | null) => {
    setPickerOpen(false);
    setPanel('chat');
    setActiveId(null);
    setDraftAgentId(agent?.id ?? null);
    inputRef.current?.focus();
  };

  const startNewChat = () => {
    setPickerOpen(false);
    setPanel('chat');
    setDraftAgentId(null);
    setActiveId(null);
    setDraft('');
    inputRef.current?.focus();
  };

  const openThread = (thread: ChatThread) => {
    setPanel('chat');
    setDraftAgentId(null);
    setActiveId(thread.id);
  };

  const closeAgentForm = () => {
    setFormMode(null);
    setFormError('');
    setAgentName('');
    setAgentInstruction('');
    setSelectedScopes([]);
  };

  const openCreateAgent = () => {
    setConfirmDeleteId(null);
    setFormError('');
    setAgentName('');
    setAgentInstruction('');
    setSelectedScopes([]);
    setFormMode('create');
  };

  const openEditAgent = (agent: CamiloAgente) => {
    const liberadas = new Set(
      (partesQuery.data ?? []).flatMap((grupo) => (
        grupo.partes.map((parte) => escopoKey(parte.ambiente, parte.parte))
      )),
    );
    const atuais = agent.escopos.map((item) => escopoKey(item.ambiente, item.parte));
    const mantidos = liberadas.size > 0 ? atuais.filter((key) => liberadas.has(key)) : atuais;
    setConfirmDeleteId(null);
    setFormError('');
    setAgentName(agent.nome);
    setAgentInstruction(agent.instrucao);
    setSelectedScopes(mantidos);
    setFormMode(agent.id);
  };

  const agentPayload = () => ({
    nome: agentName.trim(),
    instrucao: agentInstruction.trim(),
    escopos: selectedScopes.map((key) => {
      const [ambiente, parte] = key.split('::');
      return { ambiente, parte };
    }),
  });

  const toggleScope = (ambiente: string, parte: string) => {
    const key = escopoKey(ambiente, parte);
    setSelectedScopes((current) => (
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    ));
  };

  const toggleGrupo = (partes: { ambiente: string; parte: string }[]) => {
    const keys = partes.map((parte) => escopoKey(parte.ambiente, parte.parte));
    setSelectedScopes((current) => {
      const todas = keys.every((key) => current.includes(key));
      if (todas) return current.filter((key) => !keys.includes(key));
      return [...current, ...keys.filter((key) => !current.includes(key))];
    });
  };

  const removeThread = (id: string) => {
    setThreads((current) => current.filter((thread) => thread.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pendingId || agentGone) return;

    const speakingAgent = activeAgent;
    const continua = speakingAgent
      ? active?.agentId === speakingAgent.id
      : Boolean(active && !active.agentId);
    const threadId = continua && active ? active.id : (speakingAgent ? newId() : (activeId ?? newId()));
    const anteriores = continua && active ? active.messages : [];
    const historico = anteriores.slice(-24).map((message) => ({
      papel: message.role,
      texto: message.text,
    }));
    const userMessage: ChatMessage = { id: newId(), role: 'user', text: trimmed };
    const guardarResposta = (
      texto: string,
      titulo?: string,
      contexto?: { usado: number; limite: number },
    ) => {
      const reply: ChatMessage = { id: newId(), role: 'assistant', text: texto };
      setThreads((current) => rememberThread(current, threadId, reply, undefined, titulo, contexto));
      setPendingId((current) => (current === threadId ? null : current));
    };
    const contextoDaResposta = (data: { contextoUsado?: number; contextoLimite?: number }) => (
      typeof data.contextoUsado === 'number'
        ? { usado: data.contextoUsado, limite: data.contextoLimite || LIMITE_CONTEXTO }
        : undefined
    );

    setThreads((current) => rememberThread(
      current,
      threadId,
      userMessage,
      speakingAgent ? { id: speakingAgent.id, nome: speakingAgent.nome } : undefined,
    ));
    setActiveId(threadId);
    setDraftAgentId(null);
    setDraft('');
    setPendingId(threadId);

    if (speakingAgent) {
      consultarAgent.mutate(
        { id: speakingAgent.id, pergunta: trimmed, historico },
        {
          onSuccess: (data) => guardarResposta(data.resposta, data.titulo, contextoDaResposta(data)),
          onError: (error) => guardarResposta(erroApi(error)),
        },
      );
      return;
    }

    conversarCamilo.mutate(
      { pergunta: trimmed, historico },
      {
        onSuccess: (data) => guardarResposta(data.resposta, data.titulo, contextoDaResposta(data)),
        onError: (error) => guardarResposta(erroApi(error)),
      },
    );
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    send(draft);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send(draft);
    }
  };

  const openingChat = (!active || active.messages.length === 0) && !agentGone;

  const chatPicker = (
    <div className="camilo-picker" ref={pickerRef}>
      <button
        type="button"
        className="camilo-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={pickerOpen}
        onClick={() => setPickerOpen((open) => !open)}
      >
        <span>{activeAgent ? activeAgent.nome : chatNome}</span>
        <i className="bi bi-chevron-down" aria-hidden="true" />
      </button>
      {pickerOpen && (
        <ul className="camilo-picker-menu" role="listbox" aria-label="Escolher chat">
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!activeAgent}
              className={!activeAgent ? 'is-selected' : undefined}
              onClick={() => chooseChat(null)}
            >
              <strong>{chatNome}</strong>
              <small>Chat padrão</small>
            </button>
          </li>
          {agents.map((agent) => (
            <li key={agent.id}>
              <button
                type="button"
                role="option"
                aria-selected={activeAgent?.id === agent.id}
                className={activeAgent?.id === agent.id ? 'is-selected' : undefined}
                onClick={() => chooseChat(agent)}
              >
                <strong>{agent.nome}</strong>
              </button>
            </li>
          ))}
          {agentesQuery.isSuccess && agents.length === 0 && (
            <li className="camilo-picker-empty">Nenhum agente criado</li>
          )}
        </ul>
      )}
    </div>
  );

  const composer = (
    <form className="camilo-composer" onSubmit={onSubmit}>
      <textarea
        ref={inputRef}
        rows={1}
        value={draft}
        placeholder={activeAgent ? `Pergunte ao ${activeAgent.nome}` : `Pergunte ao ${chatNome}`}
        aria-label={activeAgent ? `Mensagem para ${activeAgent.nome}` : `Mensagem para ${chatNome}`}
        disabled={agentGone}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <RodinhaContexto
        usado={(active ? contextoDoChat(active).usado : 0) + draft.length}
        limite={active?.contextoLimite || LIMITE_CONTEXTO}
      />
      {chatPicker}
      <button
        type="submit"
        className="camilo-send"
        aria-label="Enviar mensagem"
        disabled={!draft.trim() || Boolean(pendingId) || agentGone}
      >
        <i className="bi bi-arrow-up" aria-hidden="true" />
      </button>
    </form>
  );

  return (
    <div className="camilo-chat">
      <aside className="camilo-chat-side">
        <div className="camilo-side-logo">
          <img src={camiloLogo} alt="Camilo" />
        </div>
        <button type="button" className="camilo-new-chat" onClick={startNewChat}>
          <i className="bi bi-plus-lg" aria-hidden="true" />
          Novo chat
        </button>
        <button
          type="button"
          className={`camilo-side-menu${panel === 'agentes' ? ' is-active' : ''}`}
          onClick={() => setPanel('agentes')}
        >
          Meus agentes
        </button>
        <p className="camilo-side-label">Recentes</p>
        <div className="camilo-thread-list">
          {threads.length === 0 ? (
            <p className="camilo-side-empty">Nenhuma conversa ainda.</p>
          ) : (
            threads.map((thread) => {
              const threadAgent = thread.agentId
                ? (agents.find((agent) => agent.id === thread.agentId)?.nome ?? thread.agentName)
                : null;
              return (
                <div key={thread.id} className={`camilo-thread${thread.id === activeId && panel === 'chat' ? ' is-active' : ''}`}>
                  <button type="button" className="camilo-thread-open" onClick={() => openThread(thread)}>
                    <span>{thread.title}</span>
                    {threadAgent && <small>{threadAgent}</small>}
                  </button>
                  <button
                    type="button"
                    className="camilo-thread-delete"
                    aria-label={`Excluir conversa ${thread.title}`}
                    onClick={() => removeThread(thread.id)}
                  >
                    <i className="bi bi-x-lg" aria-hidden="true" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      <section className="camilo-chat-main">
        {panel === 'agentes' ? (
          <div className="camilo-agents">
            <div className="camilo-agents-head">
              <div>
                <h1>Meus agentes</h1>
                <p>Edite o que cada agente pode consultar ou exclua quando não for mais usar.</p>
              </div>
              {formMode !== 'create' && (
                <button type="button" className="camilo-agent-new" onClick={openCreateAgent}>
                  Novo agente
                </button>
              )}
            </div>
            {formMode && (
              <form
                className="camilo-agent-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const payload = agentPayload();
                  const saving = createAgent.isPending || updateAgent.isPending;
                  if (!payload.nome || payload.escopos.length === 0 || saving) return;
                  setFormError('');
                  const onSuccess = () => closeAgentForm();
                  const onError = (error: unknown) => setFormError(erroApi(error));
                  if (formMode === 'create') {
                    createAgent.mutate(payload, { onSuccess, onError });
                    return;
                  }
                  updateAgent.mutate({ id: formMode, payload }, { onSuccess, onError });
                }}
              >
                <h2>{formMode === 'create' ? 'Novo agente' : 'Editar agente'}</h2>
                <label>
                  Nome
                  <input
                    value={agentName}
                    onChange={(event) => setAgentName(event.target.value)}
                    placeholder="Ex.: Analista de frete"
                    autoFocus
                  />
                </label>
                <label>
                  Instrução
                  <textarea
                    rows={3}
                    value={agentInstruction}
                    onChange={(event) => setAgentInstruction(event.target.value)}
                    placeholder="O que esse agente deve fazer"
                  />
                </label>
                <fieldset className="camilo-scope">
                  <legend>Pode consultar</legend>
                  <p>Só aparecem ambientes e rotinas que você já acessa. A consulta é só de leitura.</p>
                  <QueryDataPanel
                    query={partesQuery}
                    variant="compact"
                    loadingMessage="Carregando o que você pode liberar..."
                    errorMessage="Não foi possível carregar as partes do seu acesso."
                  >
                    {(partesQuery.data ?? []).length === 0 ? (
                      <p className="camilo-agents-empty">Nenhuma rotina liberada no seu usuário.</p>
                    ) : (
                      (partesQuery.data ?? []).map((grupo) => {
                        const marcadas = grupo.partes.filter((parte) => (
                          selectedScopes.includes(escopoKey(parte.ambiente, parte.parte))
                        )).length;
                        const todas = marcadas === grupo.partes.length;
                        return (
                          <div key={grupo.ambiente} className={`camilo-scope-group${marcadas > 0 ? ' has-selection' : ''}`}>
                            <div className="camilo-scope-head">
                              <strong>{grupo.ambiente}</strong>
                              <span>{marcadas} de {grupo.partes.length}</span>
                              <button type="button" className="camilo-scope-all" onClick={() => toggleGrupo(grupo.partes)}>
                                {todas ? 'Limpar' : 'Todas'}
                              </button>
                            </div>
                            <div className="camilo-scope-items">
                              {grupo.partes.map((parte) => {
                                const key = escopoKey(parte.ambiente, parte.parte);
                                return (
                                  <label key={key}>
                                    <input
                                      type="checkbox"
                                      checked={selectedScopes.includes(key)}
                                      onChange={() => toggleScope(parte.ambiente, parte.parte)}
                                    />
                                    {parte.rotulo}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </QueryDataPanel>
                </fieldset>
                {formError && <p className="camilo-form-error">{formError}</p>}
                <div className="camilo-agent-form-actions">
                  <button type="button" className="camilo-agent-cancel" onClick={closeAgentForm}>
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="camilo-agent-save"
                    disabled={!agentName.trim() || selectedScopes.length === 0 || createAgent.isPending || updateAgent.isPending}
                  >
                    {createAgent.isPending || updateAgent.isPending
                      ? 'Salvando...'
                      : formMode === 'create' ? 'Criar agente' : 'Salvar'}
                  </button>
                </div>
              </form>
            )}
            <QueryDataPanel
              query={agentesQuery}
              variant="compact"
              loadingMessage="Carregando seus agentes..."
              errorMessage="Não foi possível carregar os agentes."
            >
              {agentesState.canShowEmpty && agents.length === 0 && !formMode ? (
                <p className="camilo-agents-empty">Nenhum agente criado. O Camilo continua sendo o chat padrão.</p>
              ) : agents.length > 0 ? (
                <ul className="camilo-agent-list">
                  {agents.map((agent) => (
                    <li
                      key={agent.id}
                      className={`camilo-agent-card${formMode === agent.id ? ' is-editing' : ''}`}
                    >
                      <div className="camilo-agent-card-body">
                        <strong>{agent.nome}</strong>
                        {agent.instrucao && <p>{agent.instrucao}</p>}
                        <ul className="camilo-agent-tags">
                          {agent.escopos.map((item) => (
                            <li key={escopoKey(item.ambiente, item.parte)}>
                              {item.ambiente} / {item.rotulo}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {confirmDeleteId === agent.id ? (
                        <div className="camilo-agent-confirm">
                          <span>Excluir {agent.nome}?</span>
                          <button type="button" className="camilo-agent-cancel" onClick={() => setConfirmDeleteId(null)}>
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className="camilo-agent-delete"
                            disabled={deleteAgent.isPending}
                            onClick={() => {
                              if (draftAgentId === agent.id) setDraftAgentId(null);
                              if (formMode === agent.id) closeAgentForm();
                              deleteAgent.mutate(agent.id, {
                                onSettled: () => setConfirmDeleteId(null),
                              });
                            }}
                          >
                            {deleteAgent.isPending ? 'Excluindo...' : 'Excluir'}
                          </button>
                        </div>
                      ) : (
                        <div className="camilo-agent-actions">
                          <button type="button" className="camilo-agent-edit" onClick={() => openEditAgent(agent)}>
                            Editar
                          </button>
                          <button
                            type="button"
                            className="camilo-agent-delete"
                            onClick={() => {
                              setConfirmDeleteId(agent.id);
                              if (formMode === agent.id) closeAgentForm();
                            }}
                          >
                            Excluir
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </QueryDataPanel>
          </div>
        ) : openingChat ? (
          <div className="camilo-hero">
            <h1>Por onde devemos começar?</h1>
            {composer}
            {!activeAgent && (
              <div className="camilo-suggestions">
                {SUGGESTIONS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="camilo-suggestion"
                    onClick={() => {
                      setDraft(item.prompt);
                      inputRef.current?.focus();
                    }}
                  >
                    <i className={`bi ${item.icon}`} aria-hidden="true" />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : active ? (
          <>
            <header className="camilo-thread-title">
              <h1>{active.title}</h1>
            </header>
            <div className="camilo-messages" ref={threadRef}>
              <div className="camilo-messages-inner">
                {agentGone && (
                  <p className="camilo-form-error">Este agente não está mais disponível.</p>
                )}
                {active.messages.map((message) => (
                  <article key={message.id} className={`camilo-message is-${message.role}`}>
                    {message.role === 'assistant' && <span className="camilo-message-author">{authorName}</span>}
                    {message.role === 'assistant' ? <CamiloTexto texto={message.text} /> : <p>{message.text}</p>}
                  </article>
                ))}
                {pendingId === active.id && (
                  <article className="camilo-message is-assistant">
                    <span className="camilo-message-author">{authorName}</span>
                    <div className="camilo-thinking" role="status" aria-label="Camilo está respondendo">
                      <span className="camilo-thinking-dots" aria-hidden="true">
                        <i /><i /><i />
                      </span>
                    </div>
                  </article>
                )}
              </div>
            </div>
            <div className="camilo-composer-dock">
              {composer}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
};

export default AgenteCamiloChat;
