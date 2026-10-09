import React, { useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import { useBaixarCamiloTermoComprovante, useCamiloTermoVigente, useCamiloTermosAceitos, usePublicarCamiloTermo } from '../../hooks/useCamiloTermos';
import type { CamiloTermoAceite, CamiloTermoSecao } from '../../types/domain';

type OrdemData = 'data_asc' | 'data_desc';

function formatarAceite(valor: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PAGE_SIZE = 10;

function IconeOrdem({ ordem }: { ordem: OrdemData }) {
  return (
    <span className="comercial-sort-icon" aria-hidden="true">
      <i className="bi bi-caret-up-fill" style={{ color: ordem === 'data_asc' ? '#0f85c1' : '#c8d3e0' }} />
      <i className="bi bi-caret-down-fill" style={{ color: ordem === 'data_desc' ? '#0f85c1' : '#c8d3e0' }} />
    </span>
  );
}

const AdminCamiloTermos: React.FC = () => {
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [ordem, setOrdem] = useState<OrdemData>('data_desc');
  const [baixandoId, setBaixandoId] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [erroForm, setErroForm] = useState('');
  const [aviso, setAviso] = useState('');
  const [editando, setEditando] = useState(false);
  const [declaracao, setDeclaracao] = useState('');
  const [secoes, setSecoes] = useState<CamiloTermoSecao[]>([{ titulo: '', texto: '' }]);
  const vigente = useCamiloTermoVigente();
  const publicar = usePublicarCamiloTermo();
  const lista = useCamiloTermosAceitos(busca, pagina, ordem, true);
  const baixar = useBaixarCamiloTermoComprovante();
  const estado = useAsyncQueryState(lista);
  const linhas = lista.data?.results ?? [];
  const total = lista.data?.count ?? 0;
  const totalPaginas = Math.ceil(total / PAGE_SIZE) || 1;
  const paginaAtual = Math.min(pagina, totalPaginas) || 1;

  const abrirNovaVersao = () => {
    const atual = vigente.data;
    setDeclaracao(atual?.declaracao || 'Li e concordo com o termo de uso do Camilo IA.');
    setSecoes(atual?.secoes?.length ? atual.secoes.map((secao) => ({ ...secao })) : [{ titulo: '', texto: '' }]);
    setErroForm('');
    setEditando(true);
  };

  const atualizarSecao = (indice: number, campo: keyof CamiloTermoSecao, valor: string) => {
    setSecoes((listaAtual) => listaAtual.map((secao, posicao) => (
      posicao === indice ? { ...secao, [campo]: valor } : secao
    )));
  };

  const publicarVersao = (event: React.FormEvent) => {
    event.preventDefault();
    if (publicar.isPending) return;
    setErroForm('');
    publicar.mutate(
      { declaracao, secoes },
      {
        onSuccess: (data) => {
          setEditando(false);
          setPagina(1);
          setAviso(`Versão ${data.versao} publicada. Quem já tinha aceitado precisa aceitar de novo.`);
        },
        onError: (error) => {
          const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
          setErroForm(typeof detail === 'string' && detail.trim() ? detail : 'Não foi possível publicar a nova versão.');
        },
      },
    );
  };

  const extrair = (item: CamiloTermoAceite) => {
    setErro('');
    setBaixandoId(item.id);
    baixar.mutate(item.id, {
      onSuccess: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `comprovante-termo-camilo-${item.username}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      },
      onError: () => setErro('Não foi possível gerar o comprovante.'),
      onSettled: () => setBaixandoId(null),
    });
  };

  return (
    <div className="admin-camilo-termos">
      <div className="admin-camilo-versao" style={{ flexShrink: 0 }}>
        <p>
          Versão vigente: <strong>{vigente.data?.versao || '—'}</strong>.
          Uma versão nova pede aceite de novo para continuar no Camilo IA.
        </p>
        <button type="button" className="camilo-agent-save" onClick={abrirNovaVersao}>
          Nova versão
        </button>
      </div>
      {aviso && <p className="admin-camilo-versao-aviso" style={{ flexShrink: 0 }}>{aviso}</p>}
      <label className="admin-camilo-busca" style={{ flexShrink: 0 }}>
        <span>Buscar</span>
        <input
          value={busca}
          placeholder="Colaborador ou usuário"
          onChange={(event) => {
            setBusca(event.target.value);
            setPagina(1);
          }}
        />
      </label>
      {erro && <p className="admin-camilo-error">{erro}</p>}
      <QueryDataPanel
        query={lista}
        loadingMessage="Carregando termos aceitos..."
        refreshingMessage="Atualizando termos aceitos..."
        errorMessage="Não foi possível carregar os termos aceitos."
      >
        <div className="erp-card reports-table-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="erp-table reports-table">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Usuário</th>
                  <th
                    className="is-sortable"
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      setOrdem((atual) => (atual === 'data_asc' ? 'data_desc' : 'data_asc'));
                      setPagina(1);
                    }}
                    aria-sort={ordem === 'data_asc' ? 'ascending' : 'descending'}
                  >
                    Aceito em <IconeOrdem ordem={ordem} />
                  </th>
                  <th>Versão</th>
                  <th>Protocolo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {estado.canShowEmpty && linhas.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px' }}>
                      Nenhum termo aceito encontrado.
                    </td>
                  </tr>
                ) : (
                  linhas.map((item) => (
                    <tr key={item.id}>
                      <td>{item.nome || '—'}</td>
                      <td>{item.username}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatarAceite(item.aceitoEm)}</td>
                      <td>{item.versao}</td>
                      <td><small>{item.id}</small></td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="camilo-agent-save"
                          disabled={baixandoId === item.id}
                          onClick={() => extrair(item)}
                        >
                          {baixandoId === item.id ? 'Gerando...' : 'Comprovante'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="erp-pagination-bar">
          <span style={{ fontWeight: 500, marginRight: '4px' }}>
            Página <span className="erp-pagination-current">{paginaAtual}</span> de <span className="erp-pagination-current">{totalPaginas}</span>
            <span className="erp-pagination-meta">({total} registros)</span>
          </span>
          <button
            type="button"
            className="reports-action-btn secondary"
            disabled={paginaAtual <= 1}
            onClick={() => setPagina(paginaAtual - 1)}
            style={{ height: '32px', padding: '0 12px', fontSize: '12px', gap: '6px', opacity: paginaAtual <= 1 ? 0.5 : 1, cursor: paginaAtual <= 1 ? 'not-allowed' : 'pointer' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Anterior
          </button>
          <button
            type="button"
            className="reports-action-btn secondary"
            disabled={paginaAtual >= totalPaginas}
            onClick={() => setPagina(paginaAtual + 1)}
            style={{ height: '32px', padding: '0 12px', fontSize: '12px', gap: '6px', opacity: paginaAtual >= totalPaginas ? 0.5 : 1, cursor: paginaAtual >= totalPaginas ? 'not-allowed' : 'pointer' }}
          >
            Próximo
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </QueryDataPanel>
      {editando && (
        <div
          className="search-backdrop admin-user-modal-backdrop"
          style={{ display: 'flex' }}
          onClick={(event) => {
            if (event.target === event.currentTarget && !publicar.isPending) setEditando(false);
          }}
        >
          <div className="search-modal-card admin-user-modal-card admin-camilo-termo-modal" role="dialog" aria-modal="true" aria-labelledby="admin-camilo-termo-titulo">
            <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 id="admin-camilo-termo-titulo" style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                Nova versão do termo
              </h3>
              <span
                className="search-close-key"
                style={{ cursor: publicar.isPending ? 'default' : 'pointer' }}
                onClick={() => {
                  if (!publicar.isPending) setEditando(false);
                }}
              >
                Fechar (X)
              </span>
            </div>
            <form id="admin-camilo-termo-form" className="admin-user-form" onSubmit={publicarVersao}>
              <p className="admin-form-hint" style={{ margin: 0 }}>
                Título, introdução e a linha da empresa permanecem os oficiais. Altere só o conteúdo. Ao publicar, quem já aceitou precisa concordar de novo.
              </p>
              <div className="admin-form-section">
                <div className="admin-camilo-secao-topo">
                  <h4 className="admin-form-section-title">Seções</h4>
                  <button
                    type="button"
                    className="reports-action-btn secondary"
                    style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
                    onClick={() => setSecoes((listaAtual) => [...listaAtual, { titulo: '', texto: '' }])}
                  >
                    Adicionar seção
                  </button>
                </div>
                {secoes.map((secao, indice) => (
                  <div key={indice} className="admin-camilo-secao">
                    <div className="admin-camilo-secao-topo">
                      <span>Seção {indice + 1}</span>
                      {secoes.length > 1 && (
                        <button
                          type="button"
                          className="reports-action-btn secondary"
                          style={{ height: '28px', padding: '0 10px', fontSize: '12px' }}
                          onClick={() => setSecoes((listaAtual) => listaAtual.filter((_, posicao) => posicao !== indice))}
                        >
                          Remover
                        </button>
                      )}
                    </div>
                    <div className="login-group">
                      <label htmlFor={`termo-secao-titulo-${indice}`}>Título</label>
                      <input
                        id={`termo-secao-titulo-${indice}`}
                        required
                        maxLength={120}
                        value={secao.titulo}
                        onChange={(event) => atualizarSecao(indice, 'titulo', event.target.value)}
                      />
                    </div>
                    <div className="login-group">
                      <label htmlFor={`termo-secao-texto-${indice}`}>Texto</label>
                      <textarea
                        id={`termo-secao-texto-${indice}`}
                        required
                        rows={4}
                        maxLength={4000}
                        value={secao.texto}
                        onChange={(event) => atualizarSecao(indice, 'texto', event.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="admin-form-section">
                <h4 className="admin-form-section-title">Aceite</h4>
                <div className="login-group">
                  <label htmlFor="termo-declaracao">Declaração do colaborador</label>
                  <input id="termo-declaracao" required maxLength={240} value={declaracao} onChange={(event) => setDeclaracao(event.target.value)} />
                </div>
              </div>
              {erroForm && <p className="admin-camilo-error" style={{ margin: 0 }}>{erroForm}</p>}
              <div className="admin-camilo-termo-acoes">
                <button
                  type="button"
                  className="reports-action-btn secondary"
                  style={{ height: '40px', padding: '0 16px' }}
                  disabled={publicar.isPending}
                  onClick={() => setEditando(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-login" disabled={publicar.isPending}>
                  {publicar.isPending ? 'Publicando...' : 'Publicar versão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCamiloTermos;
