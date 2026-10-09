import React, { useEffect, useMemo, useRef, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState, type QueryResultLike } from '../../hooks/useAsyncQueryState';
import {
  getRHErrorMessage,
  useCreateDocumentoRH,
  useCreatePastaMatrizRH,
  useDeleteDocumentoRH,
  useDeletePastaMatrizRH,
  useDocumentosRH,
  useDownloadDocumentoRH,
  useMoverDocumentoRH,
  usePastasMatrizRH,
  useRenomearDocumentoRH,
  useRenomearPastaMatrizRH,
  useSubstituirDocumentoRH,
} from '../../hooks/useRH';
import type { DocumentoRH, GoogleDriveItem, PaginatedResponse, PastaMatrizRH } from '../../types/domain';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import RHDrivePicker from './RHDrivePicker';

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentoModal({
  modo,
  documento,
  pending,
  onClose,
  onSubmit,
  DrivePicker,
}: {
  modo: 'novo' | 'substituir' | 'renomear';
  documento: DocumentoRH | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (titulo: string, driveFileId: string | null) => void;
  DrivePicker: React.ComponentType<{
    open: boolean;
    onClose: () => void;
    onSelect: (item: GoogleDriveItem) => void;
  }>;
}) {
  const [titulo, setTitulo] = useState(documento?.titulo ?? '');
  const [drive, setDrive] = useState<GoogleDriveItem | null>(null);
  const [erro, setErro] = useState('');
  const [picker, setPicker] = useState(false);
  const soTitulo = modo === 'renomear';

  const enviar = (event: React.FormEvent) => {
    event.preventDefault();
    const nome = titulo.trim();
    if (!nome || pending) return;
    if (!soTitulo && !drive) return;
    setErro('');
    onSubmit(nome, drive?.id ?? null);
  };

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', zIndex: 3000 }}
      onClick={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}
    >
      <form className="search-modal-card" style={{ width: '480px', padding: '24px' }} onSubmit={enviar}>
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
            {modo === 'renomear' ? 'Renomear arquivo' : modo === 'substituir' ? 'Substituir arquivo' : 'Incluir arquivo'}
          </h3>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>Fechar (X)</span>
        </div>

        <div className="login-group" style={{ marginBottom: '16px' }}>
          <label htmlFor="rh-doc-titulo">Título</label>
          <input
            id="rh-doc-titulo"
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            placeholder="Título do arquivo"
          />
        </div>

        {documento && modo === 'substituir' && (
          <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: '#64748b' }}>
            Arquivo atual: <strong style={{ color: '#334155' }}>{documento.nomeArquivo}</strong>
          </p>
        )}

        {!soTitulo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button type="button" className="reports-action-btn secondary" onClick={() => setPicker(true)}>
              Google Drive
            </button>
            <span style={{ fontSize: '13px', color: drive ? '#334155' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {drive ? drive.name : 'Nenhum arquivo escolhido'}
            </span>
          </div>
        )}

        {erro && (
          <div style={{ marginTop: '14px', padding: '10px 14px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '12.5px' }}>
            {erro}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          <button type="button" className="reports-action-btn secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </button>
          <button
            type="submit"
            className="reports-action-btn primary"
            disabled={!titulo.trim() || (!soTitulo && !drive) || pending}
          >
            {pending ? 'Salvando...' : modo === 'renomear' ? 'Renomear' : modo === 'substituir' ? 'Substituir' : 'Incluir'}
          </button>
        </div>
      </form>
      <DrivePicker
        open={picker}
        onClose={() => setPicker(false)}
        onSelect={(item) => {
          setDrive(item);
          setTitulo((atual) => atual.trim() ? atual : item.name.replace(/\.[^.]+$/, ''));
          setPicker(false);
        }}
      />
    </div>
  );
}

function PastaModal({
  pasta,
  pending,
  onClose,
  onSubmit,
}: {
  pasta: PastaMatrizRH | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (nome: string) => void;
}) {
  const [nome, setNome] = useState(pasta?.nome ?? '');

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', zIndex: 3000 }}
      onClick={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}
    >
      <form
        className="search-modal-card"
        style={{ width: '420px', padding: '24px' }}
        onSubmit={(event) => {
          event.preventDefault();
          if (!nome.trim() || pending) return;
          onSubmit(nome.trim());
        }}
      >
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
            {pasta ? 'Renomear pasta' : 'Nova pasta'}
          </h3>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>Fechar (X)</span>
        </div>
        <div className="login-group" style={{ marginBottom: '16px' }}>
          <label htmlFor="rh-pasta-nome">Nome</label>
          <input
            id="rh-pasta-nome"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Nome da pasta"
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          <button type="button" className="reports-action-btn secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </button>
          <button type="submit" className="reports-action-btn primary" disabled={!nome.trim() || pending}>
            {pending ? 'Salvando...' : pasta ? 'Renomear' : 'Criar'}
          </button>
        </div>
      </form>
    </div>
  );
}

function MoverModal({
  documento,
  pastas,
  pending,
  raiz,
  onClose,
  onSubmit,
}: {
  documento: DocumentoRH;
  pastas: PastaMatrizRH[];
  pending: boolean;
  raiz: string;
  onClose: () => void;
  onSubmit: (pastaId: string | null) => void;
}) {
  const [destino, setDestino] = useState(documento.pastaId ?? '');
  const opcoes = useMemo(() => {
    const porPai = new Map<string | null, PastaMatrizRH[]>();
    pastas.forEach((pasta) => {
      const pai = pasta.parentId || null;
      const lista = porPai.get(pai) ?? [];
      lista.push(pasta);
      porPai.set(pai, lista);
    });
    const linhas: { id: string; rotulo: string }[] = [];
    const visitar = (pai: string | null, nivel: number) => {
      const filhos = [...(porPai.get(pai) ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      filhos.forEach((pasta) => {
        linhas.push({ id: pasta.id, rotulo: `${'— '.repeat(nivel)}${pasta.nome}` });
        visitar(pasta.id, nivel + 1);
      });
    };
    visitar(null, 0);
    return linhas;
  }, [pastas]);

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', zIndex: 3000 }}
      onClick={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}
    >
      <form
        className="search-modal-card"
        style={{ width: '420px', padding: '24px' }}
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          onSubmit(destino || null);
        }}
      >
        <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Mover arquivo</h3>
          <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={onClose}>Fechar (X)</span>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#64748b' }}>{documento.titulo}</p>
        <div className="login-group" style={{ marginBottom: '16px' }}>
          <label htmlFor="rh-mover-pasta">Pasta</label>
          <select id="rh-mover-pasta" value={destino} onChange={(event) => setDestino(event.target.value)}>
            <option value="">{raiz}</option>
            {opcoes.map((opcao) => (
              <option key={opcao.id} value={opcao.id}>{opcao.rotulo}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          <button type="button" className="reports-action-btn secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </button>
          <button type="submit" className="reports-action-btn primary" disabled={pending}>
            {pending ? 'Movendo...' : 'Mover'}
          </button>
        </div>
      </form>
    </div>
  );
}

function IconePasta() {
  return (
    <svg className="matriz-icone-pasta" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M3.75 6.75A1.5 1.5 0 015.25 5.25h4.19c.3 0 .59.09.84.26l1.3.86c.25.17.54.26.84.26h6.33a1.5 1.5 0 011.5 1.5v8.62a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V6.75z" />
    </svg>
  );
}

function IconeArquivo() {
  return (
    <svg className="matriz-icone-arquivo" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 0H6.375c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h11.25c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9H8.25z" />
    </svg>
  );
}

function MenuAcoes({
  aberto,
  onToggle,
  children,
  rotulo = 'Ações',
  paraBaixo = false,
}: {
  aberto: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  rotulo?: string;
  paraBaixo?: boolean;
}) {
  return (
    <div
      className={`matriz-menu${paraBaixo ? ' matriz-menu--baixo' : ''}`}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button type="button" className="matriz-menu__gatilho" aria-expanded={aberto} onClick={onToggle}>
        {rotulo}
      </button>
      {aberto && <div className="matriz-menu__lista">{children}</div>}
    </div>
  );
}

type Acao<TVars, TData = void> = Pick<UseMutationResult<TData, unknown, TVars>, 'isPending' | 'mutate'>;

export type MatrizConhecimentoProps = {
  raiz: string;
  embutida?: boolean;
  documentosQuery: UseQueryResult<PaginatedResponse<DocumentoRH>>;
  pastasQuery: UseQueryResult<PaginatedResponse<PastaMatrizRH>>;
  criar: Acao<{ titulo: string; driveFileId: string; pastaId?: string | null }, DocumentoRH>;
  renomear: Acao<{ id: string; titulo: string }, DocumentoRH>;
  substituir: Acao<{ id: string; titulo: string; driveFileId: string }, DocumentoRH>;
  excluir: Acao<string>;
  baixar: Acao<string, Blob>;
  criarPasta: Acao<{ nome: string; parentId?: string | null }, PastaMatrizRH>;
  renomearPasta: Acao<{ id: string; nome: string }, PastaMatrizRH>;
  excluirPasta: Acao<string>;
  mover: Acao<{ id: string; pastaId: string | null }, DocumentoRH>;
  DrivePicker: React.ComponentType<{
    open: boolean;
    onClose: () => void;
    onSelect: (item: GoogleDriveItem) => void;
  }>;
};

export function MatrizConhecimento({
  raiz,
  embutida = false,
  documentosQuery,
  pastasQuery,
  criar,
  renomear,
  substituir,
  excluir,
  baixar,
  criarPasta,
  renomearPasta,
  excluirPasta,
  mover,
  DrivePicker,
}: MatrizConhecimentoProps) {
  const [search, setSearch] = useState('');
  const [pastaAtual, setPastaAtual] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [menuId, setMenuId] = useState<string | null>(null);
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [destinoArraste, setDestinoArraste] = useState<string | null>(null);
  const [modal, setModal] = useState<
    | { tipo: 'arquivo'; modo: 'novo'; pastaId: string | null }
    | { tipo: 'arquivo'; modo: 'substituir' | 'renomear'; documento: DocumentoRH }
    | { tipo: 'pasta'; parentId: string | null; pasta: PastaMatrizRH | null }
    | { tipo: 'mover'; documento: DocumentoRH }
    | null
  >(null);
  const [formError, setFormError] = useState('');
  const ignorarClique = useRef(false);

  const matrizQuery = {
    isLoading: documentosQuery.isLoading || pastasQuery.isLoading,
    isFetching: documentosQuery.isFetching || pastasQuery.isFetching,
    isError: documentosQuery.isError || pastasQuery.isError,
    data: documentosQuery.data && pastasQuery.data ? { documentos: documentosQuery.data, pastas: pastasQuery.data } : undefined,
    error: documentosQuery.error ?? pastasQuery.error,
    refetch: () => {
      documentosQuery.refetch();
      pastasQuery.refetch();
    },
  };
  const { canShowEmpty } = useAsyncQueryState({
    isLoading: matrizQuery.isLoading,
    isFetching: matrizQuery.isFetching,
    isError: matrizQuery.isError,
    hasData: matrizQuery.data != null,
  });

  const documentos = documentosQuery.data?.results ?? [];
  const pastas = pastasQuery.data?.results ?? [];
  const termo = search.trim().toLowerCase();
  const salvando = criar.isPending || renomear.isPending || substituir.isPending || criarPasta.isPending || renomearPasta.isPending || mover.isPending;

  const mapaPastas = useMemo(() => new Map(pastas.map((pasta) => [pasta.id, pasta])), [pastas]);
  const filhosPorPai = useMemo(() => {
    const mapa = new Map<string | null, PastaMatrizRH[]>();
    pastas.forEach((pasta) => {
      const pai = pasta.parentId || null;
      const lista = mapa.get(pai) ?? [];
      lista.push(pasta);
      mapa.set(pai, lista);
    });
    mapa.forEach((lista) => lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
    return mapa;
  }, [pastas]);
  const arquivosPorPasta = useMemo(() => {
    const mapa = new Map<string | null, DocumentoRH[]>();
    documentos.forEach((documento) => {
      const pai = documento.pastaId || null;
      const lista = mapa.get(pai) ?? [];
      lista.push(documento);
      mapa.set(pai, lista);
    });
    return mapa;
  }, [documentos]);

  const pastaAberta = pastaAtual ? mapaPastas.get(pastaAtual) ?? null : null;

  useEffect(() => {
    if (pastaAtual && !mapaPastas.has(pastaAtual)) setPastaAtual(null);
  }, [pastaAtual, mapaPastas]);

  useEffect(() => {
    if (!menuId) return;
    const fechar = () => setMenuId(null);
    window.addEventListener('mousedown', fechar);
    return () => window.removeEventListener('mousedown', fechar);
  }, [menuId]);

  const caminho = (id: string | null) => {
    const itens: PastaMatrizRH[] = [];
    let atual = id ? mapaPastas.get(id) : undefined;
    const vistos = new Set<string>();
    while (atual && !vistos.has(atual.id)) {
      vistos.add(atual.id);
      itens.unshift(atual);
      atual = atual.parentId ? mapaPastas.get(atual.parentId) : undefined;
    }
    return itens;
  };

  const resumoPasta = (id: string) => {
    const nPastas = (filhosPorPai.get(id) ?? []).length;
    const nArquivos = (arquivosPorPasta.get(id) ?? []).length;
    if (!nPastas && !nArquivos) return 'Vazia';
    const partes: string[] = [];
    if (nPastas) partes.push(`${nPastas} ${nPastas === 1 ? 'pasta' : 'pastas'}`);
    if (nArquivos) partes.push(`${nArquivos} ${nArquivos === 1 ? 'arquivo' : 'arquivos'}`);
    return partes.join(' · ');
  };

  const localDoArquivo = (pastaId: string | null | undefined) => {
    const trilha = caminho(pastaId || null);
    return trilha.length ? trilha.map((pasta) => pasta.nome).join(' / ') : raiz;
  };

  const abrirPasta = (id: string | null) => {
    setPastaAtual(id);
    setSearch('');
    setMenuId(null);
    setExpandidos((atual) => {
      const proximos = { ...atual };
      let cursor = id ? mapaPastas.get(id) : undefined;
      const vistos = new Set<string>();
      while (cursor && !vistos.has(cursor.id)) {
        vistos.add(cursor.id);
        if (cursor.parentId) proximos[cursor.parentId] = true;
        cursor = cursor.parentId ? mapaPastas.get(cursor.parentId) : undefined;
      }
      return proximos;
    });
  };

  const soltarArquivo = (pastaId: string | null) => {
    const id = arrastandoId;
    setArrastandoId(null);
    setDestinoArraste(null);
    if (!id) return;
    const documento = documentos.find((item) => item.id === id);
    if (!documento || (documento.pastaId || null) === pastaId) return;
    mover.mutate(
      { id, pastaId },
      { onError: (error) => setFormError(getRHErrorMessage(error, 'Não foi possível mover o arquivo.')) },
    );
  };

  const salvarArquivo = (titulo: string, driveFileId: string | null) => {
    if (!modal || modal.tipo !== 'arquivo') return;
    setFormError('');
    const onError = (error: unknown) => setFormError(getRHErrorMessage(error, 'Não foi possível salvar o arquivo.'));
    if (modal.modo === 'renomear') {
      renomear.mutate({ id: modal.documento.id, titulo }, { onSuccess: () => setModal(null), onError });
      return;
    }
    if (!driveFileId) return;
    if (modal.modo === 'substituir') {
      substituir.mutate(
        { id: modal.documento.id, titulo, driveFileId },
        { onSuccess: () => setModal(null), onError },
      );
      return;
    }
    if (modal.modo !== 'novo') return;
    criar.mutate(
      { titulo, driveFileId, pastaId: modal.pastaId },
      { onSuccess: () => setModal(null), onError },
    );
  };

  const salvarPasta = (nome: string) => {
    if (!modal || modal.tipo !== 'pasta') return;
    setFormError('');
    const onError = (error: unknown) => setFormError(getRHErrorMessage(error, 'Não foi possível salvar a pasta.'));
    if (modal.pasta) {
      renomearPasta.mutate({ id: modal.pasta.id, nome }, { onSuccess: () => setModal(null), onError });
      return;
    }
    criarPasta.mutate(
      { nome, parentId: modal.parentId },
      {
        onSuccess: (pasta) => {
          setExpandidos((atual) => ({ ...atual, ...(modal.parentId ? { [modal.parentId]: true } : {}) }));
          setPastaAtual(pasta.id);
          setModal(null);
        },
        onError,
      },
    );
  };

  const baixarArquivo = (id: string, nome: string) => {
    baixar.mutate(id, {
      onSuccess: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = nome;
        link.click();
        URL.revokeObjectURL(url);
      },
    });
  };

  const abrirArquivo = (documento: DocumentoRH) => {
    if (documento.linkExterno) {
      window.open(documento.linkExterno, '_blank', 'noopener');
      return;
    }
    baixarArquivo(documento.id, documento.nomeArquivo);
  };

  const excluirPastaAtual = (pasta: PastaMatrizRH) => {
    if (!window.confirm(`Excluir a pasta "${pasta.nome}"?`)) return;
    excluirPasta.mutate(pasta.id, {
      onSuccess: () => {
        if (pastaAtual === pasta.id) setPastaAtual(pasta.parentId);
      },
      onError: (error) => setFormError(getRHErrorMessage(error, 'Não foi possível excluir a pasta.')),
    });
  };

  const prepararDestino = (event: React.DragEvent, destino: string | null) => {
    if (!arrastandoId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (destinoArraste !== (destino ?? 'inicio')) setDestinoArraste(destino ?? 'inicio');
  };

  const soltarNoDestino = (event: React.DragEvent, destino: string | null) => {
    event.preventDefault();
    event.stopPropagation();
    ignorarClique.current = true;
    soltarArquivo(destino);
  };

  const saiuDoDestino = (event: React.DragEvent, destino: string) => {
    const proximo = event.relatedTarget;
    if (proximo instanceof Node && event.currentTarget.contains(proximo)) return;
    setDestinoArraste((atual) => (atual === destino ? null : atual));
  };

  const pastasEncontradas = termo
    ? pastas.filter((pasta) => pasta.nome.toLowerCase().includes(termo)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    : [];
  const arquivosEncontrados = termo
    ? documentos.filter((documento) => `${documento.titulo} ${documento.nomeArquivo}`.toLowerCase().includes(termo))
    : [];
  const subpastas = filhosPorPai.get(pastaAtual) ?? [];
  const arquivos = arquivosPorPasta.get(pastaAtual) ?? [];
  const trilha = caminho(pastaAtual);
  const vazio = !termo && subpastas.length === 0 && arquivos.length === 0;
  const buscaVazia = Boolean(termo) && pastasEncontradas.length === 0 && arquivosEncontrados.length === 0;

  const arvore = (parentId: string | null, nivel: number): React.ReactNode => (
    (filhosPorPai.get(parentId) ?? []).map((pasta) => {
      const filhos = filhosPorPai.get(pasta.id) ?? [];
      const aberta = Boolean(expandidos[pasta.id]);
      const destino = destinoArraste === pasta.id;
      return (
        <div key={pasta.id}>
          <div className={`matriz-arvore__item${pastaAtual === pasta.id ? ' is-active' : ''}${destino ? ' is-drop' : ''}`} style={{ paddingLeft: 8 + nivel * 16 }}>
            <button
              type="button"
              className="matriz-arvore__seta"
              aria-label={aberta ? 'Recolher' : 'Expandir'}
              disabled={filhos.length === 0}
              onClick={() => setExpandidos((atual) => ({ ...atual, [pasta.id]: !aberta }))}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: aberta ? 'rotate(90deg)' : undefined }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              type="button"
              className="matriz-arvore__nome"
              onClick={() => {
                if (ignorarClique.current) {
                  ignorarClique.current = false;
                  return;
                }
                abrirPasta(pasta.id);
              }}
              onDragOver={(event) => prepararDestino(event, pasta.id)}
              onDragLeave={(event) => saiuDoDestino(event, pasta.id)}
              onDrop={(event) => soltarNoDestino(event, pasta.id)}
            >
              <IconePasta />
              <span>{pasta.nome}</span>
            </button>
          </div>
          {aberta && filhos.length > 0 && arvore(pasta.id, nivel + 1)}
        </div>
      );
    })
  );

  const cartaoPasta = (pasta: PastaMatrizRH, detalhe: string) => (
    <article
      key={pasta.id}
      className={`matriz-pasta${destinoArraste === pasta.id ? ' is-drop' : ''}`}
      onClick={() => {
        if (ignorarClique.current) {
          ignorarClique.current = false;
          return;
        }
        abrirPasta(pasta.id);
      }}
      onDragOver={(event) => prepararDestino(event, pasta.id)}
      onDragLeave={(event) => saiuDoDestino(event, pasta.id)}
      onDrop={(event) => soltarNoDestino(event, pasta.id)}
    >
      <IconePasta />
      <div className="matriz-pasta__texto">
        <strong>{pasta.nome}</strong>
        <span>{detalhe}</span>
      </div>
      <MenuAcoes aberto={menuId === `pasta-${pasta.id}`} onToggle={() => setMenuId((atual) => (atual === `pasta-${pasta.id}` ? null : `pasta-${pasta.id}`))}>
        <button type="button" onClick={() => abrirPasta(pasta.id)}>Abrir</button>
        <button type="button" onClick={() => { setMenuId(null); setModal({ tipo: 'pasta', parentId: pasta.parentId, pasta }); }}>Renomear</button>
        <button type="button" className="is-danger" onClick={() => { setMenuId(null); excluirPastaAtual(pasta); }}>Excluir</button>
      </MenuAcoes>
    </article>
  );

  const cartaoArquivo = (documento: DocumentoRH, mostrarLocal: boolean) => (
    <article
      key={documento.id}
      className={`matriz-arquivo${arrastandoId === documento.id ? ' is-dragging' : ''}`}
    >
      <button
        type="button"
        className="matriz-arquivo__corpo"
        draggable
        onClick={() => abrirArquivo(documento)}
        onDragStart={(event) => {
          event.dataTransfer.setData('text/plain', documento.id);
          event.dataTransfer.effectAllowed = 'move';
          setArrastandoId(documento.id);
          setMenuId(null);
        }}
        onDragEnd={() => { setArrastandoId(null); setDestinoArraste(null); }}
      >
        <IconeArquivo />
        <span className="matriz-arquivo__texto">
          <strong>{documento.titulo}</strong>
          <span>
            {documento.nomeArquivo}
            {' · '}
            {formatBytes(documento.tamanho)}
            {documento.criadoEm ? ` · ${documento.criadoEm}` : ''}
            {documento.incluidoPor ? ` · ${documento.incluidoPor}` : ''}
            {mostrarLocal ? ` · ${localDoArquivo(documento.pastaId)}` : ''}
          </span>
        </span>
      </button>
      <MenuAcoes aberto={menuId === `arquivo-${documento.id}`} onToggle={() => setMenuId((atual) => (atual === `arquivo-${documento.id}` ? null : `arquivo-${documento.id}`))}>
        <button type="button" onClick={() => { setMenuId(null); abrirArquivo(documento); }}>{documento.linkExterno ? 'Abrir no Drive' : 'Baixar'}</button>
        <button type="button" onClick={() => { setMenuId(null); setModal({ tipo: 'mover', documento }); }}>Mover</button>
        <button type="button" onClick={() => { setMenuId(null); setModal({ tipo: 'arquivo', modo: 'renomear', documento }); }}>Renomear</button>
        <button type="button" onClick={() => { setMenuId(null); setModal({ tipo: 'arquivo', modo: 'substituir', documento }); }}>Substituir</button>
        <button
          type="button"
          className="is-danger"
          onClick={() => {
            setMenuId(null);
            if (window.confirm(`Excluir o arquivo "${documento.titulo}"?`)) excluir.mutate(documento.id);
          }}
        >
          Excluir
        </button>
      </MenuAcoes>
    </article>
  );

  return (
    <div className="fat-list-compact matriz-conhecimento">
      {!embutida && (
        <header className="view-header matriz-cabecalho">
          <div className="matriz-titulo">
            <div className="matriz-titulo__marca" />
            <h1 className="view-page-title">Matriz de conhecimento</h1>
          </div>
        </header>
      )}

      {formError && <p className="matriz-erro">{formError}</p>}

      <QueryDataPanel
        query={matrizQuery as QueryResultLike<unknown>}
        loadingMessage="Carregando a matriz..."
        errorMessage="Não foi possível carregar a matriz de conhecimento."
      >
        <div className="matriz-shell">
          <aside className="matriz-arvore">
            <div className="matriz-coluna-topo">Pastas</div>
            <div className="matriz-arvore__lista">
              <div className={`matriz-arvore__item${pastaAtual === null && !termo ? ' is-active' : ''}${destinoArraste === 'inicio' ? ' is-drop' : ''}`}>
                <span className="matriz-arvore__seta" aria-hidden="true" />
                <button
                  type="button"
                  className="matriz-arvore__nome"
                  onClick={() => abrirPasta(null)}
                  onDragOver={(event) => prepararDestino(event, null)}
                  onDragLeave={(event) => saiuDoDestino(event, 'inicio')}
                  onDrop={(event) => soltarNoDestino(event, null)}
                >
                  <IconePasta />
                  <span>{raiz}</span>
                </button>
              </div>
              {arvore(null, 0)}
            </div>
          </aside>

          <section className="matriz-painel">
            <div className="matriz-painel__topo">
              <nav className="matriz-trilha" aria-label="Pastas abertas">
                <button type="button" className={trilha.length === 0 ? 'is-atual' : ''} onClick={() => abrirPasta(null)}>{raiz}</button>
                {trilha.map((pasta, indice) => (
                  <React.Fragment key={pasta.id}>
                    <span aria-hidden="true">/</span>
                    <button type="button" className={indice === trilha.length - 1 ? 'is-atual' : ''} onClick={() => abrirPasta(pasta.id)}>{pasta.nome}</button>
                  </React.Fragment>
                ))}
              </nav>
              <div className="matriz-painel__acoes">
                <div className="reports-search-wrapper matriz-busca">
                  <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Buscar pasta ou arquivo"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                {pastaAberta && (
                  <MenuAcoes
                    paraBaixo
                    aberto={menuId === 'pasta-aberta'}
                    onToggle={() => setMenuId((atual) => (atual === 'pasta-aberta' ? null : 'pasta-aberta'))}
                  >
                    <button type="button" onClick={() => { setMenuId(null); setModal({ tipo: 'pasta', parentId: pastaAberta.parentId, pasta: pastaAberta }); }}>
                      Renomear
                    </button>
                    <button type="button" className="is-danger" disabled={excluirPasta.isPending} onClick={() => { setMenuId(null); excluirPastaAtual(pastaAberta); }}>
                      Excluir
                    </button>
                  </MenuAcoes>
                )}
                <button type="button" className="reports-action-btn secondary" onClick={() => { setFormError(''); setModal({ tipo: 'pasta', parentId: pastaAtual, pasta: null }); }}>
                  Nova pasta
                </button>
                <button type="button" className="reports-action-btn primary" onClick={() => { setFormError(''); setModal({ tipo: 'arquivo', modo: 'novo', pastaId: pastaAtual }); }}>
                  Incluir arquivo
                </button>
              </div>
            </div>

            {arrastandoId && <p className="matriz-dica">Solte o arquivo em uma pasta para movê-lo.</p>}

            <div className="matriz-painel__corpo">
              {termo ? (
                <>
                  {canShowEmpty && buscaVazia ? (
                    <div className="matriz-vazio">
                      <strong>Nenhum item encontrado</strong>
                      <span>Tente outro nome de pasta ou arquivo.</span>
                    </div>
                  ) : (
                    <>
                      {pastasEncontradas.length > 0 && (
                        <section>
                          <h2>Pastas</h2>
                          <div className="matriz-grade">
                            {pastasEncontradas.map((pasta) => cartaoPasta(pasta, localDoArquivo(pasta.parentId)))}
                          </div>
                        </section>
                      )}
                      {arquivosEncontrados.length > 0 && (
                        <section>
                          <h2>Arquivos</h2>
                          <div className="matriz-lista">
                            {arquivosEncontrados.map((documento) => cartaoArquivo(documento, true))}
                          </div>
                        </section>
                      )}
                    </>
                  )}
                </>
              ) : canShowEmpty && vazio ? (
                <div className="matriz-vazio">
                  <IconePasta />
                  <strong>{pastaAberta ? 'Esta pasta está vazia' : 'A matriz ainda não tem conteúdo'}</strong>
                  <span>Crie uma pasta ou inclua um arquivo para a IA consultar.</span>
                </div>
              ) : (
                <>
                  {subpastas.length > 0 && (
                    <section>
                      <h2>Pastas</h2>
                      <div className="matriz-grade">
                        {subpastas.map((pasta) => cartaoPasta(pasta, resumoPasta(pasta.id)))}
                      </div>
                    </section>
                  )}
                  {arquivos.length > 0 && (
                    <section>
                      <h2>Arquivos</h2>
                      <div className="matriz-lista">
                        {arquivos.map((documento) => cartaoArquivo(documento, false))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      </QueryDataPanel>

      {modal?.tipo === 'arquivo' && (
        <DocumentoModal
          modo={modal.modo}
          documento={modal.modo === 'novo' ? null : modal.documento}
          pending={salvando}
          DrivePicker={DrivePicker}
          onClose={() => { if (!salvando) setModal(null); }}
          onSubmit={salvarArquivo}
        />
      )}
      {modal?.tipo === 'pasta' && (
        <PastaModal
          pasta={modal.pasta}
          pending={salvando}
          onClose={() => { if (!salvando) setModal(null); }}
          onSubmit={salvarPasta}
        />
      )}
      {modal?.tipo === 'mover' && (
        <MoverModal
          documento={modal.documento}
          pastas={pastas}
          pending={salvando}
          raiz={raiz}
          onClose={() => { if (!salvando) setModal(null); }}
          onSubmit={(pastaId) => {
            mover.mutate(
              { id: modal.documento.id, pastaId },
              {
                onSuccess: () => {
                  if (pastaId) setExpandidos((atual) => ({ ...atual, [pastaId]: true }));
                  setModal(null);
                },
                onError: (error) => setFormError(getRHErrorMessage(error, 'Não foi possível mover o arquivo.')),
              },
            );
          }}
        />
      )}
    </div>
  );
}

const RHDocumentos: React.FC = () => {
  const documentosQuery = useDocumentosRH({ todos: true });
  const pastasQuery = usePastasMatrizRH();
  const criar = useCreateDocumentoRH();
  const renomear = useRenomearDocumentoRH();
  const substituir = useSubstituirDocumentoRH();
  const excluir = useDeleteDocumentoRH();
  const baixar = useDownloadDocumentoRH();
  const criarPasta = useCreatePastaMatrizRH();
  const renomearPasta = useRenomearPastaMatrizRH();
  const excluirPasta = useDeletePastaMatrizRH();
  const mover = useMoverDocumentoRH();

  return (
    <MatrizConhecimento
      raiz="Matriz RH"
      documentosQuery={documentosQuery}
      pastasQuery={pastasQuery}
      criar={criar}
      renomear={renomear}
      substituir={substituir}
      excluir={excluir}
      baixar={baixar}
      criarPasta={criarPasta}
      renomearPasta={renomearPasta}
      excluirPasta={excluirPasta}
      mover={mover}
      DrivePicker={RHDrivePicker}
    />
  );
};

export default RHDocumentos;
