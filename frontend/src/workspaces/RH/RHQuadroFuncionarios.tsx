import React, { useEffect, useState } from 'react';
import { DEPARTAMENTOS_QUADRO, FILIAIS_QUADRO } from '../../constants/filiais';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  getRHErrorMessage,
  useAtivarQuadroFuncionarioRH,
  useAtualizarQuadroFuncionarioRH,
  useCadastrarQuadroFuncionarioRH,
  useInativarQuadroFuncionarioRH,
  useQuadroFuncionariosRH,
} from '../../hooks/useRH';
import type { FuncionarioQuadro } from '../../types/domain';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function formatCpf(value?: string) {
  const digits = (value || '').replace(/\D/g, '');
  if (digits.length !== 11) return value || '—';
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatDateBr(value?: string | null) {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function EditarFuncionarioModal({ funcionario, onClose }: {
  funcionario: FuncionarioQuadro | null;
  onClose: () => void;
}) {
  const cadastrar = useCadastrarQuadroFuncionarioRH();
  const atualizar = useAtualizarQuadroFuncionarioRH();
  const salvando = cadastrar.isPending || atualizar.isPending;
  const [nome, setNome] = useState(funcionario?.nomeCompleto ?? '');
  const [cpf, setCpf] = useState(funcionario ? formatCpf(funcionario.cpf) : '');
  const [filial, setFilial] = useState(funcionario?.filial ?? '');
  const [cargo, setCargo] = useState(funcionario?.cargo ?? '');
  const [departamento, setDepartamento] = useState(funcionario?.departamento ?? '');
  const [admissao, setAdmissao] = useState(funcionario?.dataAdmissao ?? '');
  const [demissao, setDemissao] = useState(funcionario?.dataDemissao ?? '');
  const [ativo, setAtivo] = useState(funcionario?.ativo !== false);
  const [erro, setErro] = useState('');

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault();
    setErro('');
    const payload = {
      nomeCompleto: nome.trim(),
      cpf,
      filial: filial.trim(),
      cargo: cargo.trim(),
      departamento,
      dataAdmissao: admissao || null,
      dataDemissao: demissao || null,
      ativo,
    };
    try {
      if (funcionario) {
        await atualizar.mutateAsync({ id: funcionario.id, payload });
      } else {
        await cadastrar.mutateAsync(payload);
      }
      onClose();
    } catch (falha) {
      setErro(getRHErrorMessage(falha, 'Não foi possível salvar o funcionário.'));
    }
  };

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', zIndex: 3000 }}
      onClick={(event) => { if (event.target === event.currentTarget && !salvando) onClose(); }}
    >
      <form className="search-modal-card" style={{ width: '560px', padding: '24px' }} onSubmit={enviar}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
            {funcionario ? 'Editar funcionário' : 'Cadastrar funcionário'}
          </h3>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Fechar" disabled={salvando}>
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
          <div className="login-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
            <label htmlFor="quadro-nome">Nome</label>
            <input id="quadro-nome" value={nome} onChange={(event) => setNome(event.target.value)} required />
          </div>
          <div className="login-group" style={{ marginBottom: 0 }}>
            <label htmlFor="quadro-cpf">CPF</label>
            <input id="quadro-cpf" value={cpf} onChange={(event) => setCpf(event.target.value)} required />
          </div>
          <div className="login-group" style={{ marginBottom: 0 }}>
            <label htmlFor="quadro-filial">Filial</label>
            <select id="quadro-filial" value={filial} onChange={(event) => setFilial(event.target.value)} required>
              <option value="">Selecione</option>
              {FILIAIS_QUADRO.map((nomeFilial) => <option key={nomeFilial} value={nomeFilial}>{nomeFilial}</option>)}
            </select>
          </div>
          <div className="login-group" style={{ marginBottom: 0 }}>
            <label htmlFor="quadro-cargo">Cargo</label>
            <input id="quadro-cargo" value={cargo} onChange={(event) => setCargo(event.target.value)} />
          </div>
          <div className="login-group" style={{ marginBottom: 0 }}>
            <label htmlFor="quadro-departamento">Departamento</label>
            <select id="quadro-departamento" value={departamento} onChange={(event) => setDepartamento(event.target.value)}>
              <option value="">Selecione</option>
              {DEPARTAMENTOS_QUADRO.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
            </select>
          </div>
          <div className="login-group" style={{ marginBottom: 0 }}>
            <label htmlFor="quadro-status">Status</label>
            <select id="quadro-status" value={ativo ? 'ativo' : 'inativo'} onChange={(event) => setAtivo(event.target.value === 'ativo')}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
          <div className="login-group" style={{ marginBottom: 0 }}>
            <label htmlFor="quadro-admissao">Admissão</label>
            <input id="quadro-admissao" type="date" value={admissao} onChange={(event) => setAdmissao(event.target.value)} />
          </div>
          <div className="login-group" style={{ marginBottom: 0 }}>
            <label htmlFor="quadro-demissao">Demissão</label>
            <input id="quadro-demissao" type="date" value={demissao} onChange={(event) => setDemissao(event.target.value)} />
          </div>
        </div>
        {erro && <p style={{ color: '#e11d48', fontSize: '13px', margin: '12px 0 0' }}>{erro}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button type="button" className="reports-action-btn secondary" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button type="submit" className="reports-action-btn primary" disabled={salvando}>
            {salvando ? 'Salvando...' : funcionario ? 'Salvar' : 'Cadastrar'}
          </button>
        </div>
      </form>
    </div>
  );
}

const RHQuadroFuncionarios: React.FC = () => {
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [filial, setFilial] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [acoesAbertas, setAcoesAbertas] = useState(false);
  const [formulario, setFormulario] = useState<FuncionarioQuadro | null | 'novo'>(null);
  const ativar = useAtivarQuadroFuncionarioRH();
  const inativar = useInativarQuadroFuncionarioRH();
  const quadroQuery = useQuadroFuncionariosRH({
    search: buscaAplicada || undefined,
    filial: filial || undefined,
    ativo: status === '' ? undefined : status === 'ativo',
    page,
    pageSize,
  });
  const { canShowEmpty } = useAsyncQueryState(quadroQuery);
  const linhas = quadroQuery.data?.results ?? [];
  const total = quadroQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginaAtual = Math.min(page, totalPages);
  const marcados = linhas.filter((funcionario) => selecionados.includes(funcionario.id));
  const unico = marcados.length === 1 ? marcados[0] : null;
  const todosMarcados = linhas.length > 0 && linhas.every((funcionario) => selecionados.includes(funcionario.id));
  const alterando = ativar.isPending || inativar.isPending;

  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaAplicada(busca.trim());
      setPage(1);
      setSelecionados([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  useEffect(() => {
    const fechar = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.reports-dropdown-wrapper')) setAcoesAbertas(false);
    };
    document.addEventListener('click', fechar);
    return () => document.removeEventListener('click', fechar);
  }, []);

  const irParaPagina = (proxima: number) => {
    setPage(proxima);
    setSelecionados([]);
  };

  const marcarTodos = (marcado: boolean) => {
    setSelecionados(marcado ? linhas.map((funcionario) => funcionario.id) : []);
  };

  const marcarLinha = (id: string, marcado: boolean) => {
    setSelecionados((atual) => (marcado ? [...atual, id] : atual.filter((item) => item !== id)));
  };

  const alternarAtivo = async () => {
    setAcoesAbertas(false);
    if (alterando || marcados.length === 0) return;
    try {
      await Promise.all(marcados.map((funcionario) => (
        funcionario.ativo === false ? ativar.mutateAsync(funcionario.id) : inativar.mutateAsync(funcionario.id)
      )));
      setSelecionados([]);
    } catch (falha) {
      window.alert(getRHErrorMessage(falha, 'Não foi possível alterar o status do funcionário.'));
    }
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <header className="view-header" style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Quadro de Funcionários</h1>
        </div>
      </header>

      <div className="reports-filters-bar" style={{ flexShrink: 0 }}>
        <div className="reports-filter-left">
          <div className="reports-search-wrapper">
            <i className="bi bi-search search-icon" aria-hidden="true" />
            <input
              type="text"
              placeholder="Buscar por nome, CPF, cargo, departamento ou status..."
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
          </div>
          <select
            className="rh-period-select"
            value={filial}
            onChange={(event) => { setFilial(event.target.value); setPage(1); setSelecionados([]); }}
            aria-label="Filial"
          >
            <option value="">Todas as filiais</option>
            {FILIAIS_QUADRO.map((nome) => (
              <option key={nome} value={nome}>{nome}</option>
            ))}
          </select>
          <select
            className="rh-period-select"
            value={status}
            onChange={(event) => { setStatus(event.target.value); setPage(1); setSelecionados([]); }}
            aria-label="Status"
          >
            <option value="">Ativos e inativos</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>
        <div className="reports-filter-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="reports-records-count"><strong>{total}</strong> Funcionários</span>
          <div className="reports-dropdown-wrapper">
            <button
              type="button"
              className="reports-action-btn secondary"
              disabled={selecionados.length === 0 || alterando}
              onClick={() => setAcoesAbertas((aberto) => !aberto)}
            >
              <span>Ações{selecionados.length > 0 ? ` (${selecionados.length})` : ''}</span>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className={`reports-dropdown-menu ${acoesAbertas ? 'show' : ''}`} style={{ cursor: 'pointer' }}>
              {unico && (
                <span
                  className="reports-dropdown-item"
                  onClick={() => { setAcoesAbertas(false); setFormulario(unico); }}
                >
                  <span className="reports-dropdown-item-left">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                    Editar
                  </span>
                </span>
              )}
              <span className={`reports-dropdown-item${alterando ? ' is-disabled' : ''}`} onClick={alternarAtivo}>
                <span className="reports-dropdown-item-left">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
                  </svg>
                  Ativar / Inativar
                </span>
              </span>
            </div>
          </div>
          <button type="button" className="reports-action-btn primary" onClick={() => setFormulario('novo')}>
            <i className="bi bi-plus-lg" />
            <span>Cadastrar</span>
          </button>
        </div>
      </div>

      <QueryDataPanel
        query={quadroQuery}
        loadingMessage="Carregando quadro de funcionários..."
        refreshingMessage="Atualizando quadro..."
        errorMessage="Não foi possível carregar o quadro de funcionários. Tente novamente."
      >
        <div className="erp-card reports-table-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="reports-table">
              <thead>
                <tr>
                  <th className="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={todosMarcados}
                      onChange={(event) => marcarTodos(event.target.checked)}
                      aria-label="Selecionar todos"
                      style={{ borderRadius: '4px' }}
                    />
                  </th>
                  <th>Filial</th>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>Cargo</th>
                  <th>Departamento</th>
                  <th>Status</th>
                  <th>Admissão</th>
                  <th>Demissão</th>
                </tr>
              </thead>
              <tbody>
                {canShowEmpty && linhas.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                      Nenhum funcionário cadastrado.
                    </td>
                  </tr>
                ) : (
                  linhas.map((funcionario) => (
                    <tr key={funcionario.id}>
                      <td className="checkbox-cell">
                        <input
                          type="checkbox"
                          checked={selecionados.includes(funcionario.id)}
                          onChange={(event) => marcarLinha(funcionario.id, event.target.checked)}
                          aria-label={`Selecionar ${funcionario.nomeCompleto}`}
                          style={{ borderRadius: '4px' }}
                        />
                      </td>
                      <td>{funcionario.filial || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{funcionario.nomeCompleto}</td>
                      <td>{formatCpf(funcionario.cpf)}</td>
                      <td>{funcionario.cargo || '—'}</td>
                      <td>{funcionario.departamento || '—'}</td>
                      <td>
                        <span className={`status-dot-label ${funcionario.ativo === false ? 'is-inactive' : 'is-active'}`}>
                          {funcionario.ativo === false ? 'Inativo' : 'Ativo'}
                        </span>
                      </td>
                      <td>{formatDateBr(funcionario.dataAdmissao)}</td>
                      <td>{formatDateBr(funcionario.dataDemissao)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="erp-pagination-bar">
          <div className="erp-pagination-page-size">
            <label htmlFor="quadro-page-size">Itens por página</label>
            <select
              id="quadro-page-size"
              value={pageSize}
              onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); setSelecionados([]); }}
            >
              {PAGE_SIZE_OPTIONS.map((opcao) => <option key={opcao} value={opcao}>{opcao}</option>)}
            </select>
          </div>
          <span style={{ fontWeight: 500, marginRight: '4px' }}>
            Página <span className="erp-pagination-current">{paginaAtual}</span> de <span className="erp-pagination-current">{totalPages}</span>
            <span className="erp-pagination-meta">({total} registros)</span>
          </span>
          <button
            type="button"
            className="reports-action-btn secondary"
            disabled={paginaAtual <= 1}
            onClick={() => irParaPagina(paginaAtual - 1)}
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
            disabled={paginaAtual >= totalPages}
            onClick={() => irParaPagina(paginaAtual + 1)}
            style={{ height: '32px', padding: '0 12px', fontSize: '12px', gap: '6px', opacity: paginaAtual >= totalPages ? 0.5 : 1, cursor: paginaAtual >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            Próximo
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </QueryDataPanel>
      {formulario !== null && (
        <EditarFuncionarioModal
          funcionario={formulario === 'novo' ? null : formulario}
          onClose={() => setFormulario(null)}
        />
      )}
    </div>
  );
};

export default RHQuadroFuncionarios;
