import React, { useEffect, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useCamiloChatPadrao, useSalvarCamiloChatPadrao } from '../../hooks/useCamiloAgentes';
import AdminCamiloMatriz from './AdminCamiloMatriz';
import AdminCamiloTermos from './AdminCamiloTermos';

type CamiloAba = 'chat' | 'matriz' | 'termos';

function erroApi(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: unknown; nome?: unknown; instrucao?: unknown } } })?.response?.data;
  if (typeof detail?.detail === 'string' && detail.detail.trim()) return detail.detail;
  if (Array.isArray(detail?.nome) && typeof detail.nome[0] === 'string') return detail.nome[0];
  if (Array.isArray(detail?.instrucao) && typeof detail.instrucao[0] === 'string') return detail.instrucao[0];
  return 'Não foi possível salvar o chat padrão.';
}

const AdminCamiloPanel: React.FC = () => {
  const [aba, setAba] = useState<CamiloAba>('chat');
  const query = useCamiloChatPadrao();
  const salvar = useSalvarCamiloChatPadrao();
  const [nome, setNome] = useState('');
  const [instrucao, setInstrucao] = useState('');
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(false);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    if (!query.data || carregado) return;
    setNome(query.data.nome);
    setInstrucao(query.data.instrucao ?? '');
    setCarregado(true);
  }, [query.data, carregado]);

  useEffect(() => {
    if (aba === 'chat') return undefined;
    const contentEl = document.querySelector('.content') as HTMLElement | null;
    if (!contentEl) return undefined;
    const anterior = contentEl.style.overflowY;
    contentEl.style.overflowY = 'hidden';
    return () => { contentEl.style.overflowY = anterior; };
  }, [aba]);

  const restaurar = () => {
    setNome(query.data?.nomePadrao || 'Camilo');
    setInstrucao(query.data?.instrucaoPadrao || '');
    setSalvo(false);
    setErro('');
  };

  return (
    <section
      className="admin-camilo"
      style={aba !== 'chat' ? { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' } : undefined}
    >
      <header className="view-header" style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Camilo IA</h1>
        </div>
      </header>

      <div className="reports-tabs-bar" style={{ flexShrink: 0 }}>
        <button
          type="button"
          className={`reports-tab-btn${aba === 'chat' ? ' active' : ''}`}
          onClick={() => setAba('chat')}
        >
          Chat padrão
        </button>
        <button
          type="button"
          className={`reports-tab-btn${aba === 'matriz' ? ' active' : ''}`}
          onClick={() => setAba('matriz')}
        >
          Matriz empresarial
        </button>
        <button
          type="button"
          className={`reports-tab-btn${aba === 'termos' ? ' active' : ''}`}
          onClick={() => setAba('termos')}
        >
          Termos aceitos
        </button>
      </div>

      {aba === 'termos' ? <AdminCamiloTermos /> : aba === 'matriz' ? <AdminCamiloMatriz /> : (
      <QueryDataPanel
        query={query}
        loadingMessage="Carregando o chat padrão..."
        errorMessage="Não foi possível carregar o chat padrão."
      >
        <form
          className="admin-camilo-card"
          onSubmit={(event) => {
            event.preventDefault();
            if (!nome.trim() || salvar.isPending) return;
            setErro('');
            setSalvo(false);
            salvar.mutate(
              { nome: nome.trim(), instrucao: instrucao.trim() },
              {
                onSuccess: (data) => {
                  setNome(data.nome);
                  setInstrucao(data.instrucao ?? '');
                  setSalvo(true);
                },
                onError: (error) => setErro(erroApi(error)),
              },
            );
          }}
        >
          <h2>Chat padrão</h2>
          <p>
            Este texto orienta o chat que todo mundo abre no CamiloIA.
            Ele não consulta dados do ERP. Os documentos da Matriz empresarial entram só neste chat.
            Os agentes de cada usuário não usam essa matriz.
          </p>
          <label>
            Nome
            <input
              value={nome}
              maxLength={80}
              onChange={(event) => {
                setNome(event.target.value);
                setSalvo(false);
              }}
            />
          </label>
          <label>
            Instrução
            <textarea
              rows={6}
              maxLength={4000}
              value={instrucao}
              onChange={(event) => {
                setInstrucao(event.target.value);
                setSalvo(false);
              }}
            />
          </label>
          {erro && <p className="admin-camilo-error">{erro}</p>}
          {salvo && <p className="admin-camilo-ok">Chat padrão salvo.</p>}
          <div className="admin-camilo-actions">
            <button type="button" className="camilo-agent-cancel" onClick={restaurar}>
              Restaurar padrão
            </button>
            <button type="submit" className="camilo-agent-save" disabled={!nome.trim() || salvar.isPending}>
              {salvar.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </QueryDataPanel>
      )}
    </section>
  );
};

export default AdminCamiloPanel;
