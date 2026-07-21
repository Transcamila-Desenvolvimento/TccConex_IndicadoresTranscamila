import React, { useEffect, useMemo, useState } from 'react';
import type { InconsistenciaColaborador, MovimentacaoColaborador } from '../../types/domain';
import {
  useRHDashboardSummary,
  useMovimentacoesRH,
  useSalvarJustificativaAlteracao,
  useCargosRH,
} from '../../hooks/useRH';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import ImportarMovimentacaoModal from './modals/ImportarMovimentacaoModal';
import ImportarLoteModal from './modals/ImportarLoteModal';
import EnviarEmailModal from './modals/EnviarEmailModal';
import CompararSalariosModal from './modals/CompararSalariosModal';
import CargoMappingModal from './modals/CargoMappingModal';
import PjsModal from './modals/PjsModal';
import DesconsideradosModal from './modals/DesconsideradosModal';
import ExportarRelatorioModal from './modals/ExportarRelatorioModal';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

type MovTab = 'ativos' | 'novos' | 'desligados' | 'alteracoes';

const TABS: { id: MovTab; label: string }[] = [
  { id: 'ativos', label: 'Ativos' },
  { id: 'novos', label: 'Novos' },
  { id: 'desligados', label: 'Desligados' },
  { id: 'alteracoes', label: 'Alterações' },
];

const formatCurrency = (value: number | null | undefined) =>
  (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function CategoriaBadge({ categoria }: { categoria?: string | null }) {
  if (!categoria) {
    return <span className="rh-cat-badge rh-cat-badge--pending">Revisar</span>;
  }
  const labels: Record<string, string> = {
    ADMINISTRATIVO: 'Administrativo',
    OPERACIONAL: 'Operacional',
    MOTORISTA: 'Motorista',
  };
  return (
    <span className={`rh-cat-badge rh-cat-badge--${categoria.toLowerCase()}`}>
      {labels[categoria] ?? categoria}
    </span>
  );
}

function TipoBadge({ tipo, label }: { tipo: string; label: string }) {
  return <span className={`rh-tipo-badge rh-tipo-badge--${tipo}`}>{label}</span>;
}

function SalaryValue({ value, hidden }: { value: number | null | undefined; hidden: boolean }) {
  return (
    <span className={hidden ? 'rh-salary-blur' : undefined}>{formatCurrency(value)}</span>
  );
}

interface JustificativaCellProps {
  alteracao: InconsistenciaColaborador;
}

const JustificativaCell: React.FC<JustificativaCellProps> = ({ alteracao }) => {
  const [value, setValue] = useState(alteracao.justificativa ?? '');
  const salvarJustificativa = useSalvarJustificativaAlteracao();

  useEffect(() => {
    setValue(alteracao.justificativa ?? '');
  }, [alteracao.justificativa, alteracao.id]);

  const handleBlur = () => {
    if (value === (alteracao.justificativa ?? '')) return;
    salvarJustificativa.mutate({ id: alteracao.id, justificativa: value });
  };

  return (
    <input
      type="text"
      className="rh-justificativa-input"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      placeholder="Adicionar justificativa..."
    />
  );
};

function matchesText(values: Array<string | undefined | null>, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return values.some((v) => (v ?? '').toLowerCase().includes(normalized));
}

const RHMovimentacoes: React.FC = () => {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [periodTouched, setPeriodTouched] = useState(false);
  const [activeTab, setActiveTab] = useState<MovTab>('ativos');
  const [showSalaries, setShowSalaries] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  const [ativosSearch, setAtivosSearch] = useState('');
  const [ativosFilial, setAtivosFilial] = useState('');
  const [ativosCategoria, setAtivosCategoria] = useState('');
  const [novosSearch, setNovosSearch] = useState('');
  const [desligadosSearch, setDesligadosSearch] = useState('');
  const [alteracoesSearch, setAlteracoesSearch] = useState('');

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImportLoteOpen, setIsImportLoteOpen] = useState(false);
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [isCompararOpen, setIsCompararOpen] = useState(false);
  const [isCargosOpen, setIsCargosOpen] = useState(false);
  const [isPjsOpen, setIsPjsOpen] = useState(false);
  const [isDesconsideradosOpen, setIsDesconsideradosOpen] = useState(false);
  const [isExportarRelatorioOpen, setIsExportarRelatorioOpen] = useState(false);

  const dashboardParams = useMemo(
    () => (periodTouched ? { mes: selectedMonth, ano: selectedYear } : {}),
    [periodTouched, selectedMonth, selectedYear],
  );

  const dashboardQuery = useRHDashboardSummary(dashboardParams);
  const { data } = dashboardQuery;
  const { canShowEmpty } = useAsyncQueryState(dashboardQuery);

  const pendingCargosQuery = useCargosRH({ status: 'pendente' });
  const pendingCargosCount = pendingCargosQuery.data?.length ?? 0;

  useEffect(() => {
    if (!periodTouched && data?.lote) {
      setSelectedMonth(data.lote.mes);
      setSelectedYear(data.lote.ano);
    }
  }, [data, periodTouched]);

  const loteId = data?.lote?.id;

  const ativosParams = useMemo(
    () => ({
      loteId,
      search: ativosSearch.trim() || undefined,
      filial: ativosFilial || undefined,
      categoria: ativosCategoria || undefined,
    }),
    [loteId, ativosSearch, ativosFilial, ativosCategoria],
  );
  const ativosQuery = useMovimentacoesRH(ativosParams, activeTab === 'ativos' && !!loteId);
  const ativosQueryState = useAsyncQueryState(ativosQuery);

  const yearsOptions = useMemo(() => {
    const set = new Set<number>();
    set.add(currentYear);
    set.add(selectedYear);
    (data?.lotesDisponiveis ?? []).forEach((lote) => set.add(lote.ano));
    return Array.from(set).sort((a, b) => b - a);
  }, [data?.lotesDisponiveis, selectedYear, currentYear]);

  const filiaisOptions = useMemo(
    () => (data?.resumoFiliais ?? []).map((f) => f.filial).filter(Boolean),
    [data?.resumoFiliais],
  );

  const handlePeriodChange = (month: number, year: number) => {
    setPeriodTouched(true);
    setSelectedMonth(month);
    setSelectedYear(year);
  };

  const filteredNovos = useMemo(
    () => (data?.novos ?? []).filter((c: MovimentacaoColaborador) =>
      matchesText([c.nome, c.cpf, c.funcao, c.filial], novosSearch)),
    [data?.novos, novosSearch],
  );

  const filteredDesligados = useMemo(
    () => (data?.desligados ?? []).filter((c: MovimentacaoColaborador) =>
      matchesText([c.nome, c.cpf, c.funcao, c.filial], desligadosSearch)),
    [data?.desligados, desligadosSearch],
  );

  const filteredAlteracoes = useMemo(
    () => (data?.alteracoes ?? []).filter((a: InconsistenciaColaborador) =>
      matchesText([a.nome, a.cpf, a.tipoDisplay], alteracoesSearch)),
    [data?.alteracoes, alteracoesSearch],
  );

  const openAction = (setter: (open: boolean) => void) => {
    setIsActionsOpen(false);
    setter(true);
  };

  return (
    <div className="rh-mov-page">
      <header className="view-header rh-mov-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Movimentações de RH</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            type="button"
            className="reports-action-btn primary"
            onClick={() => setIsImportOpen(true)}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            className="reports-action-btn secondary"
            onClick={() => setIsImportLoteOpen(true)}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
            </svg>
            <span>Importar Lote</span>
          </button>

          <div className="reports-dropdown-wrapper">
            <button type="button" className="reports-action-btn secondary" onClick={() => setIsActionsOpen(!isActionsOpen)}>
              <span>Outras Ações</span>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              {pendingCargosCount > 0 && (
                <span className="notification-dot notification-dot--floating" title={`${pendingCargosCount} cargo(s) pendente(s) de mapeamento`} />
              )}
            </button>
            <div className={`reports-dropdown-menu reports-dropdown-menu--wide ${isActionsOpen ? 'show' : ''}`}>
              <span className="reports-dropdown-item" onClick={() => openAction(setIsCargosOpen)}>
                <span>Mapeamento de Cargos</span>
                {pendingCargosCount > 0 && (
                  <span className="notification-dot" title={`${pendingCargosCount} cargo(s) pendente(s)`} />
                )}
              </span>
              <span className="reports-dropdown-item" onClick={() => openAction(setIsCompararOpen)}>Comparar Salários</span>
              <div className="reports-dropdown-divider" />
              <span className="reports-dropdown-item" onClick={() => openAction(setIsEmailOpen)}>Enviar Movimentação por E-mail</span>
              <span
                className={`reports-dropdown-item ${(data?.lotesDisponiveis ?? []).length === 0 ? 'is-disabled' : ''}`}
                onClick={() => openAction(setIsExportarRelatorioOpen)}
              >
                Exportar Relatório de Movimentações
              </span>
              <div className="reports-dropdown-divider" />
              <span className="reports-dropdown-item" onClick={() => openAction(setIsPjsOpen)}>Cadastro de PJs</span>
              <span className="reports-dropdown-item" onClick={() => openAction(setIsDesconsideradosOpen)}>Colaboradores Desconsiderados</span>
            </div>
          </div>
        </div>
      </header>

      {/* Meta info bar */}
      <div className="reports-meta-bar">
        <div className="reports-meta-item">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
          </svg>
          <span>Referência: <strong>{data?.lote ? `${String(data.lote.mes).padStart(2, '0')}/${data.lote.ano}` : '—'}</strong></span>
        </div>
        <div className="reports-meta-item">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Atualizado em: <strong>{data?.lote?.dataImportacao ?? '—'}</strong></span>
        </div>
        <div className="reports-meta-item">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          <span>Usuário: <strong>{data?.lote?.updatedBy ?? '—'}</strong></span>
        </div>
        <button
          type="button"
          className="rh-toggle-salary-btn"
          onClick={() => setShowSalaries((v) => !v)}
        >
          {showSalaries ? (
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
          ) : (
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
          <span>{showSalaries ? 'Ocultar salários' : 'Mostrar salários'}</span>
        </button>
      </div>

      {/* Filtro de período */}
      <div className="reports-filters-bar">
        <div className="reports-filter-left">
          <div className="reports-filter-icon-label">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
            </svg>
            <span>Período</span>
          </div>
          <select
            className="rh-period-select"
            value={selectedMonth}
            onChange={(e) => handlePeriodChange(Number(e.target.value), selectedYear)}
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx + 1}>{name}</option>
            ))}
          </select>
          <select
            className="rh-period-select"
            value={selectedYear}
            onChange={(e) => handlePeriodChange(selectedMonth, Number(e.target.value))}
          >
            {yearsOptions.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      <QueryDataPanel
        query={dashboardQuery}
        variant="compact"
        fullPageLoader
        loadingMessage="Carregando movimentações de RH..."
        refreshingMessage="Atualizando movimentações..."
        errorMessage="Não foi possível carregar as movimentações de RH. Tente novamente."
      >
        {data && !data.lote && canShowEmpty ? (
          <div className="rh-empty-state">
            <svg width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <h3>Nenhuma Movimentação Encontrada</h3>
            <p>Faça o upload da planilha de ativos referente a {MONTH_NAMES[selectedMonth - 1]}/{selectedYear} para começar.</p>
            <button type="button" className="reports-action-btn primary" onClick={() => setIsImportOpen(true)}>
              Começar Importação
            </button>
          </div>
        ) : data ? (
          <>
            {data.resumoFiliais.length > 0 && (
              <div className="rh-filial-grid">
                {data.resumoFiliais.map((f) => (
                  <div key={f.filial} className="rh-filial-card">
                    <h4>{f.filial}</h4>
                    <div className="rh-filial-card-row">
                      <span>Funcionários</span>
                      <strong>{f.total}</strong>
                    </div>
                    <div className="rh-filial-card-row">
                      <span>Média Idade</span>
                      <strong>{f.mediaIdade.toFixed(1)} anos</strong>
                    </div>
                    <div className="rh-filial-card-row">
                      <span>Média Empresa</span>
                      <strong>{f.mediaTempo.toFixed(1)} anos</strong>
                    </div>
                    <div className="rh-filial-card-row">
                      <span>Folha</span>
                      <strong>{formatCurrency(f.payroll)}</strong>
                    </div>
                  </div>
                ))}
                <div className="rh-filial-card rh-filial-card--total">
                  <h4>Total Geral</h4>
                  <div className="rh-filial-card-row">
                    <span>Funcionários</span>
                    <strong>{data.totais.totalColaboradores}</strong>
                  </div>
                  <div className="rh-filial-card-row">
                    <span>Média Idade</span>
                    <strong>{data.totais.mediaIdade.toFixed(1)} anos</strong>
                  </div>
                  <div className="rh-filial-card-row">
                    <span>Média Empresa</span>
                    <strong>{data.totais.mediaTempo.toFixed(1)} anos</strong>
                  </div>
                  <div className="rh-filial-card-row">
                    <span>Folha</span>
                    <strong>{formatCurrency(data.totais.payroll)}</strong>
                  </div>
                </div>
              </div>
            )}

            <div className="reports-tabs-bar">
              {TABS.map((tab) => {
                const count = tab.id === 'novos' ? data.totais.admitidos
                  : tab.id === 'desligados' ? data.totais.desligados
                  : tab.id === 'alteracoes' ? data.totais.alteracoes
                  : data.totais.totalColaboradores;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`reports-tab-btn${activeTab === tab.id ? ' active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label} <span className="rh-tab-count">{count}</span>
                  </button>
                );
              })}
            </div>

            {activeTab === 'ativos' && (
              <>
                <div className="reports-filters-bar">
                  <div className="reports-filter-left">
                    <div className="reports-search-wrapper">
                      <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Buscar por nome, CPF ou cargo..."
                        value={ativosSearch}
                        onChange={(e) => setAtivosSearch(e.target.value)}
                      />
                    </div>
                    <select className="rh-period-select" value={ativosFilial} onChange={(e) => setAtivosFilial(e.target.value)}>
                      <option value="">Todas as filiais</option>
                      {filiaisOptions.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <select className="rh-period-select" value={ativosCategoria} onChange={(e) => setAtivosCategoria(e.target.value)}>
                      <option value="">Todas as categorias</option>
                      <option value="ADMINISTRATIVO">Administrativo</option>
                      <option value="OPERACIONAL">Operacional</option>
                      <option value="MOTORISTA">Motorista</option>
                    </select>
                  </div>
                </div>

                <QueryDataPanel
                  query={ativosQuery}
                  variant="compact"
                  loadingMessage="Carregando colaboradores ativos..."
                  refreshingMessage="Atualizando colaboradores..."
                  errorMessage="Não foi possível carregar os colaboradores ativos. Tente novamente."
                >
                  <div className="erp-card reports-table-card">
                    <div className="table-container">
                      <table className="erp-table reports-table">
                        <thead>
                          <tr>
                            <th>Funcionário</th>
                            <th>CPF</th>
                            <th>Cargo</th>
                            <th>Categoria</th>
                            <th>Idade</th>
                            <th>Tempo Empresa</th>
                            <th>Admissão</th>
                            <th className="num">Salário</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ativosQueryState.canShowEmpty && (ativosQuery.data ?? []).length === 0 ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontStyle: 'italic' }}>Nenhum colaborador ativo encontrado.</td></tr>
                          ) : (
                            (ativosQuery.data ?? []).map((c) => (
                              <tr key={c.id}>
                                <td>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <strong>{c.nome}</strong>
                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{c.filial}</span>
                                  </div>
                                </td>
                                <td>{c.cpf}</td>
                                <td>{c.funcao || '—'}</td>
                                <td><CategoriaBadge categoria={c.categoria} /></td>
                                <td>{c.idadeStr}</td>
                                <td>{c.tempoEmpresaStr}</td>
                                <td>{c.dataAdmissao}</td>
                                <td className="num"><SalaryValue value={c.salario} hidden={!showSalaries} /></td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </QueryDataPanel>
              </>
            )}

            {activeTab === 'novos' && (
              <>
                <div className="reports-filters-bar">
                  <div className="reports-filter-left">
                    <div className="reports-search-wrapper">
                      <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Buscar por nome, CPF ou cargo..."
                        value={novosSearch}
                        onChange={(e) => setNovosSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="erp-card reports-table-card">
                  <div className="table-container">
                    <table className="erp-table reports-table">
                      <thead>
                        <tr>
                          <th>Funcionário</th>
                          <th>CPF</th>
                          <th>Cargo</th>
                          <th>Admissão</th>
                          <th className="num">Salário</th>
                          <th>Categoria</th>
                          <th>Filial</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredNovos.length === 0 ? (
                          <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontStyle: 'italic' }}>Nenhuma nova contratação identificada.</td></tr>
                        ) : (
                          filteredNovos.map((c) => (
                            <tr key={c.id}>
                              <td><strong>{c.nome}</strong></td>
                              <td>{c.cpf}</td>
                              <td>{c.funcao || '—'}</td>
                              <td>{c.dataAdmissao}</td>
                              <td className="num"><SalaryValue value={c.salario} hidden={!showSalaries} /></td>
                              <td><CategoriaBadge categoria={c.categoria} /></td>
                              <td>{c.filial}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'desligados' && (
              <>
                <div className="reports-filters-bar">
                  <div className="reports-filter-left">
                    <div className="reports-search-wrapper">
                      <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Buscar por nome, CPF ou cargo..."
                        value={desligadosSearch}
                        onChange={(e) => setDesligadosSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="erp-card reports-table-card">
                  <div className="table-container">
                    <table className="erp-table reports-table">
                      <thead>
                        <tr>
                          <th>Funcionário</th>
                          <th>CPF</th>
                          <th>Cargo</th>
                          <th>Admissão</th>
                          <th className="num">Salário Antigo</th>
                          <th>Categoria</th>
                          <th>Filial</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDesligados.length === 0 ? (
                          <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontStyle: 'italic' }}>Nenhum desligamento identificado.</td></tr>
                        ) : (
                          filteredDesligados.map((c) => (
                            <tr key={c.id}>
                              <td><strong>{c.nome}</strong></td>
                              <td>{c.cpf}</td>
                              <td>{c.funcao || '—'}</td>
                              <td>{c.dataAdmissao}</td>
                              <td className="num"><SalaryValue value={c.salario} hidden={!showSalaries} /></td>
                              <td><CategoriaBadge categoria={c.categoria} /></td>
                              <td>{c.filial}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'alteracoes' && (
              <>
                <div className="reports-filters-bar">
                  <div className="reports-filter-left">
                    <div className="reports-search-wrapper">
                      <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Buscar por nome, CPF ou tipo..."
                        value={alteracoesSearch}
                        onChange={(e) => setAlteracoesSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="erp-card reports-table-card">
                  <div className="table-container">
                    <table className="erp-table reports-table">
                      <thead>
                        <tr>
                          <th>Funcionário</th>
                          <th>Alteração</th>
                          <th>Anterior</th>
                          <th>Atual</th>
                          <th>Data</th>
                          <th>Justificativa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAlteracoes.length === 0 ? (
                          <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontStyle: 'italic' }}>Nenhuma alteração detectada.</td></tr>
                        ) : (
                          filteredAlteracoes.map((a) => (
                            <tr key={a.id}>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <strong>{a.nome}</strong>
                                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{a.cpf}</span>
                                </div>
                              </td>
                              <td><TipoBadge tipo={a.tipo} label={a.tipoDisplay} /></td>
                              <td>{a.valorAnterior || '—'}</td>
                              <td>{a.valorAtual || '—'}</td>
                              <td>{String(selectedMonth).padStart(2, '0')}/{selectedYear}</td>
                              <td><JustificativaCell alteracao={a} /></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        ) : null}
      </QueryDataPanel>

      {isImportOpen && (
        <ImportarMovimentacaoModal
          defaultMes={selectedMonth}
          defaultAno={selectedYear}
          onClose={() => setIsImportOpen(false)}
        />
      )}
      {isImportLoteOpen && <ImportarLoteModal onClose={() => setIsImportLoteOpen(false)} />}
      {isEmailOpen && (
        <EnviarEmailModal
          lotes={data?.lotesDisponiveis ?? []}
          defaultLoteId={loteId}
          onClose={() => setIsEmailOpen(false)}
        />
      )}
      {isCompararOpen && <CompararSalariosModal onClose={() => setIsCompararOpen(false)} />}
      {isCargosOpen && <CargoMappingModal onClose={() => setIsCargosOpen(false)} />}
      {isPjsOpen && <PjsModal onClose={() => setIsPjsOpen(false)} />}
      {isDesconsideradosOpen && <DesconsideradosModal onClose={() => setIsDesconsideradosOpen(false)} />}
      {isExportarRelatorioOpen && (
        <ExportarRelatorioModal
          lotes={data?.lotesDisponiveis ?? []}
          defaultLoteId={loteId}
          onClose={() => setIsExportarRelatorioOpen(false)}
        />
      )}
    </div>
  );
};

export default RHMovimentacoes;
