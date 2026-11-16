import React, { useState, useMemo, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  useItensEstoque,
  useEntradasEstoque,
  useSaidasEstoque,
} from '../../hooks/useCompras';
import ItemsManagerModal from './modals/ItemsManagerModal';
import EntradaModal from './modals/EntradaModal';
import SaidaModal from './modals/SaidaModal';

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const estoqueStatus = (qtdAtual: number, qtdMinima: number) => {
  if (qtdAtual === 0) return 'Esgotado';
  if (qtdAtual < qtdMinima) return 'Baixo';
  return 'Normal';
};

function usePaginacao<T>(items: T[]) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const paged = items.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);
  return { page: clampedPage, setPage, pageSize, setPageSize, totalPages, paged, total: items.length };
}

type Paginacao = ReturnType<typeof usePaginacao>;

const BarraPaginacao: React.FC<{ id: string; paginacao: Paginacao }> = ({ id, paginacao }) => {
  const { page, setPage, pageSize, setPageSize, totalPages, total } = paginacao;
  const navBtn = (disabled: boolean): React.CSSProperties => ({
    height: '32px', fontSize: '12px', opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
  });
  return (
    <div className="erp-pagination-bar">
      <div className="erp-pagination-page-size">
        <label htmlFor={id}>Itens por página</label>
        <select id={id} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
          {PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
      <span style={{ fontWeight: 500, marginRight: '4px' }}>
        Página <span className="erp-pagination-current">{page}</span> de{' '}
        <span className="erp-pagination-current">{totalPages}</span>
        <span className="erp-pagination-meta">({total} registros)</span>
      </span>
      <button type="button" className="reports-action-btn secondary" title="Primeira página" aria-label="Primeira página" disabled={page <= 1} onClick={() => setPage(1)} style={{ ...navBtn(page <= 1), width: '32px', padding: 0 }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.75 4.5l-7.5 7.5 7.5 7.5M11.25 4.5l-7.5 7.5 7.5 7.5" /></svg>
      </button>
      <button type="button" className="reports-action-btn secondary" disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ ...navBtn(page <= 1), padding: '0 12px', gap: '6px' }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        Anterior
      </button>
      <button type="button" className="reports-action-btn secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={{ ...navBtn(page >= totalPages), padding: '0 12px', gap: '6px' }}>
        Próximo
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
      </button>
      <button type="button" className="reports-action-btn secondary" title="Última página" aria-label="Última página" disabled={page >= totalPages} onClick={() => setPage(totalPages)} style={{ ...navBtn(page >= totalPages), width: '32px', padding: 0 }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5M12.75 4.5l7.5 7.5-7.5 7.5" /></svg>
      </button>
    </div>
  );
};

const ComprasControleEstoque: React.FC = () => {
  const [activeView, setActiveView] = useState<'estoque' | 'entradas' | 'saidas'>('estoque');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Normal' | 'Baixo' | 'Esgotado'>('Todos');

  const [modalType, setModalType] = useState<'saida' | 'entrada' | null>(null);
  const [modalInitialItemId, setModalInitialItemId] = useState('');

  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isItemsManagerOpen, setIsItemsManagerOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  const itensQuery = useItensEstoque();
  const entradasQuery = useEntradasEstoque();
  const saidasQuery = useSaidasEstoque();

  const { canShowEmpty: canShowEmptyItens } = useAsyncQueryState(itensQuery);
  const { canShowEmpty: canShowEmptyEntradas } = useAsyncQueryState(entradasQuery);
  const { canShowEmpty: canShowEmptySaidas } = useAsyncQueryState(saidasQuery);

  const stockItems = itensQuery.data ?? [];
  const entradas = entradasQuery.data ?? [];
  const saidas = saidasQuery.data ?? [];

  // Fechar o menu "Outras Ações" ao clicar fora dele
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setIsActionsOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const openAction = (setter: (open: boolean) => void) => {
    setIsActionsOpen(false);
    setter(true);
  };

  const handleExportLowStockPdf = () => {
    setIsActionsOpen(false);

    const lowStockItems = stockItems
      .filter((item) => item.qtdAtual === 0 || item.qtdAtual < item.qtdMinima)
      .sort((a, b) => {
        if (a.qtdAtual === 0 && b.qtdAtual !== 0) return -1;
        if (b.qtdAtual === 0 && a.qtdAtual !== 0) return 1;
        return a.nome.localeCompare(b.nome);
      });

    if (lowStockItems.length === 0) {
      alert('Nenhum item com estoque baixo ou esgotado no momento.');
      return;
    }

    const doc = new jsPDF();
    const generatedAt = new Date().toLocaleString('pt-BR');

    doc.setFontSize(14);
    doc.text('Relatório de Estoque Baixo / Esgotado', 14, 16);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em ${generatedAt}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['Item', 'Unidade', 'Qtd Atual', 'Qtd Mínima', 'Status']],
      body: lowStockItems.map((item) => [
        item.nome,
        item.unidade,
        String(item.qtdAtual),
        String(item.qtdMinima),
        item.qtdAtual === 0 ? 'Esgotado' : 'Baixo',
      ]),
      headStyles: { fillColor: [17, 140, 196] },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
      },
    });

    doc.save(`Relatorio_Estoque_Baixo_Esgotado_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const filteredItems = useMemo(() => {
    return stockItems.filter((item) => {
      const matchesName = item.nome.toLowerCase().includes(searchTerm.toLowerCase());
      const status = estoqueStatus(item.qtdAtual, item.qtdMinima);
      const matchesStatus = statusFilter === 'Todos' || status === statusFilter;
      return matchesName && matchesStatus;
    });
  }, [stockItems, searchTerm, statusFilter]);

  const paginacaoEstoque = usePaginacao(filteredItems);
  const paginacaoEntradas = usePaginacao(entradas);
  const paginacaoSaidas = usePaginacao(saidas);

  const stats = useMemo(() => {
    const totalItens = stockItems.length;
    const estoqueBaixo = stockItems.filter((item) => item.qtdAtual > 0 && item.qtdAtual < item.qtdMinima).length;
    const semEstoque = stockItems.filter((item) => item.qtdAtual === 0).length;
    return { totalItens, estoqueBaixo, semEstoque };
  }, [stockItems]);

  const openEntradaModal = (itemId = '') => {
    setModalInitialItemId(itemId);
    setModalType('entrada');
  };

  const openSaidaModal = (itemId = '') => {
    setModalInitialItemId(itemId);
    setModalType('saida');
  };

  return (
    <div className="estoque-page">

      {/* Header e Toolbar */}
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '5px', height: '18px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Controle de estoque</h1>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => openSaidaModal()}
            className="reports-action-btn primary"
            style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Protocolo de Saída</span>
          </button>
          <button
            type="button"
            onClick={() => openEntradaModal()}
            className="reports-action-btn secondary"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 1.968-4.716 2.517-7.221a.75.75 0 00-.728-.917H5.106M7.5 14.25L5.106 5.25M7.5 14.25L4.5 20.25M18.75 20.25a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM8.25 20.25a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            </svg>
            <span>Registrar Compra</span>
          </button>

          <div className="reports-dropdown-wrapper" ref={actionsMenuRef}>
            <button
              type="button"
              className="reports-action-btn secondary"
              onClick={() => setIsActionsOpen((v) => !v)}
            >
              <span>Outras Ações</span>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className={`reports-dropdown-menu reports-dropdown-menu--wide ${isActionsOpen ? 'show' : ''}`}>
              <span className="reports-dropdown-item" onClick={() => openAction(setIsItemsManagerOpen)}>Gerenciar Itens Cadastrados</span>
              <div className="reports-dropdown-divider" />
              <span className="reports-dropdown-item" onClick={handleExportLowStockPdf}>Relatório PDF: Estoque Baixo/Esgotado</span>
            </div>
          </div>
        </div>
      </header>

      <div className="dashboard-stats-grid" style={{ marginBottom: '12px' }}>
        <div className="stat-card card-positive">
          <div className="stat-card-label">Total de Itens Cadastrados</div>
          <div className="stat-card-value">{stats.totalItens}</div>
          <div className="stat-card-desc">Materiais sob controle no almoxarifado</div>
        </div>
        <div className="stat-card card-neutral">
          <div className="stat-card-label">Estoque Baixo</div>
          <div className="stat-card-value">{stats.estoqueBaixo}</div>
          <div className="stat-card-desc">Necessitam de nova compra em breve</div>
        </div>
        <div className="stat-card card-negative">
          <div className="stat-card-label">Esgotado / Sem Estoque</div>
          <div className="stat-card-value">{stats.semEstoque}</div>
          <div className="stat-card-desc">Itens zerados no almoxarifado</div>
        </div>
      </div>

      <div className="reports-tabs-bar">
        <button
          type="button"
          onClick={() => setActiveView('estoque')}
          className={`reports-tab-btn ${activeView === 'estoque' ? 'active' : ''}`}
        >
          Saldo de estoque
        </button>
        <button
          type="button"
          onClick={() => setActiveView('entradas')}
          className={`reports-tab-btn ${activeView === 'entradas' ? 'active' : ''}`}
        >
          Últimas compras
        </button>
        <button
          type="button"
          onClick={() => setActiveView('saidas')}
          className={`reports-tab-btn ${activeView === 'saidas' ? 'active' : ''}`}
        >
          Protocolo de saída
        </button>
      </div>

      {activeView === 'estoque' && (
        <>
          <div className="reports-filters-bar">
            <div className="reports-filter-left">
              <div className="reports-filter-icon-label">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                </svg>
                <span>Filtrar</span>
              </div>
              <div className="reports-search-wrapper">
                <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar na tabela..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); paginacaoEstoque.setPage(1); }}
                />
              </div>
              <div className="reports-select-wrapper">
                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as 'Todos' | 'Normal' | 'Baixo' | 'Esgotado'); paginacaoEstoque.setPage(1); }}>
                  <option value="Todos">Status: Todos</option>
                  <option value="Normal">Normal</option>
                  <option value="Baixo">Baixo</option>
                  <option value="Esgotado">Esgotado</option>
                </select>
              </div>
              <button
                type="button"
                className="reports-action-btn secondary"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('Todos');
                  paginacaoEstoque.setPage(1);
                }}
              >
                Limpar Filtros
              </button>
            </div>

            <div className="reports-filter-right">
              <span className="reports-records-count"><strong>{filteredItems.length}</strong> Registros</span>
            </div>
          </div>

          <div className="erp-card reports-table-card estoque-table-card">
            <QueryDataPanel
              query={itensQuery}
              loadingMessage="Carregando itens do estoque..."
              refreshingMessage="Atualizando estoque..."
              errorMessage="Não foi possível carregar o estoque. Tente novamente."
            >
              <div className="table-container">
                <table className="erp-table reports-table estoque-grade estoque-grade--saldo">
                  <colgroup>
                    <col className="col-item" />
                    <col className="col-qtd" />
                    <col className="col-qtd" />
                    <col className="col-status" />
                    <col className="col-acoes" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qtd Atual</th>
                      <th>Qtd Mínima</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {canShowEmptyItens && filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '32px 14px', textAlign: 'center', color: '#94a3b8', background: '#ffffff' }}>
                          Nenhum item localizado no estoque.
                        </td>
                      </tr>
                    ) : (
                      paginacaoEstoque.paged.map((item, idx) => {
                        const statusLabel = estoqueStatus(item.qtdAtual, item.qtdMinima);
                        return (
                          <tr key={item.id} className={idx % 2 === 1 ? 'zebra-row' : ''}>
                            <td style={{ fontWeight: 600 }}>{item.nome}</td>
                            <td>{item.qtdAtual} {item.unidade}</td>
                            <td>{item.qtdMinima} {item.unidade}</td>
                            <td>
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 10px',
                                borderRadius: '9999px',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: statusLabel === 'Esgotado' ? '#dc2626' : statusLabel === 'Baixo' ? '#d97706' : '#16a34a',
                                border: `1.5px solid ${statusLabel === 'Esgotado' ? '#dc2626' : statusLabel === 'Baixo' ? '#d97706' : '#16a34a'}`,
                                backgroundColor: '#ffffff',
                              }}>
                                {statusLabel}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => openSaidaModal(item.id)}
                                  className="btn-table-action delete"
                                  title="Registrar Saída"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6A2.25 2.25 0 0 0 5.25 5.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                                  </svg>
                                  Saída
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEntradaModal(item.id)}
                                  className="btn-table-action"
                                  title="Registrar Compra (Entrada)"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                                  </svg>
                                  Compra
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <BarraPaginacao id="estoque-saldo-page-size" paginacao={paginacaoEstoque} />
            </QueryDataPanel>
          </div>
        </>
      )}

      {activeView === 'entradas' && (
        <div className="erp-card reports-table-card estoque-table-card">
          <QueryDataPanel
            query={entradasQuery}
            loadingMessage="Carregando compras..."
            refreshingMessage="Atualizando compras..."
            errorMessage="Não foi possível carregar as compras. Tente novamente."
          >
            <div className="table-container">
              <table className="erp-table reports-table estoque-grade estoque-grade--entradas">
                <colgroup>
                  <col className="col-item" />
                  <col className="col-data" />
                  <col className="col-qtd" />
                  <col className="col-valor" />
                  <col className="col-nome" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Data da Compra</th>
                    <th>Quantidade</th>
                    <th>Valor Unitário</th>
                    <th>Fornecedor</th>
                  </tr>
                </thead>
                <tbody>
                  {canShowEmptyEntradas && entradas.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '32px 14px', textAlign: 'center', color: '#94a3b8', background: '#ffffff' }}>
                        Nenhuma compra registrada.
                      </td>
                    </tr>
                  ) : (
                    paginacaoEntradas.paged.map((ent, idx) => (
                      <tr key={ent.id} className={idx % 2 === 1 ? 'zebra-row' : ''}>
                        <td style={{ fontWeight: 600 }}>{ent.itemNome}</td>
                        <td style={{ color: '#64748b' }}>{new Date(`${ent.data}T00:00:00`).toLocaleDateString('pt-BR')}</td>
                        <td>{ent.quantidade}</td>
                        <td>
                          {ent.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td>{ent.fornecedorNome}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <BarraPaginacao id="estoque-entradas-page-size" paginacao={paginacaoEntradas} />
          </QueryDataPanel>
        </div>
      )}

      {activeView === 'saidas' && (
        <div className="erp-card reports-table-card estoque-table-card">
          <QueryDataPanel
            query={saidasQuery}
            loadingMessage="Carregando protocolo de saída..."
            refreshingMessage="Atualizando protocolo de saída..."
            errorMessage="Não foi possível carregar o protocolo de saída. Tente novamente."
          >
            <div className="table-container">
              <table className="erp-table reports-table estoque-grade estoque-grade--saidas">
                <colgroup>
                  <col className="col-item" />
                  <col className="col-data" />
                  <col className="col-qtd" />
                  <col className="col-nome" />
                  <col className="col-nome" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Data</th>
                    <th>Quantidade</th>
                    <th>Setor</th>
                    <th>Colaborador</th>
                  </tr>
                </thead>
                <tbody>
                  {canShowEmptySaidas && saidas.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '32px 14px', textAlign: 'center', color: '#94a3b8', background: '#ffffff' }}>
                        Nenhuma saída registrada no protocolo.
                      </td>
                    </tr>
                  ) : (
                    paginacaoSaidas.paged.map((sai, idx) => (
                      <tr key={sai.id} className={idx % 2 === 1 ? 'zebra-row' : ''}>
                        <td style={{ fontWeight: 600 }}>{sai.itemNome}</td>
                        <td style={{ color: '#64748b' }}>{new Date(`${sai.data}T00:00:00`).toLocaleDateString('pt-BR')}</td>
                        <td>{sai.quantidade}</td>
                        <td>{sai.setorNome}</td>
                        <td>{sai.colaboradorNome}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <BarraPaginacao id="estoque-saidas-page-size" paginacao={paginacaoSaidas} />
          </QueryDataPanel>
        </div>
      )}

      {/* --- MODAIS --- */}

      {/* Modal 1: Registrar Compra (Entrada) — múltiplos itens */}
      {modalType === 'entrada' && (
        <EntradaModal
          initialItemId={modalInitialItemId}
          onClose={() => setModalType(null)}
        />
      )}

      {/* Modal 2: Protocolo de Saída — múltiplos itens */}
      {modalType === 'saida' && (
        <SaidaModal
          initialItemId={modalInitialItemId}
          onClose={() => setModalType(null)}
        />
      )}

      {/* Modais de gerenciamento (Outras Ações) */}
      {isItemsManagerOpen && (
        <ItemsManagerModal onClose={() => setIsItemsManagerOpen(false)} />
      )}

    </div>
  );
};

export default ComprasControleEstoque;
