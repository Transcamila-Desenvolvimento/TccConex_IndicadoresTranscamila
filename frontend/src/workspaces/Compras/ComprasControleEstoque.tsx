import React, { useState, useMemo, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import {
  useItensEstoque,
  useEntradasEstoque,
  useSaidasEstoque,
  useUnidadesMedida,
  useSetoresCompras,
  useColaboradoresCompras,
  useFornecedores,
  useCreateUnidadeMedida,
  useUpdateUnidadeMedida,
  useDeleteUnidadeMedida,
  useCreateSetorCompras,
  useUpdateSetorCompras,
  useDeleteSetorCompras,
  useCreateColaboradorCompras,
  useUpdateColaboradorCompras,
  useDeleteColaboradorCompras,
  useCreateFornecedor,
  useUpdateFornecedor,
  useDeleteFornecedor,
  getComprasErrorMessage,
} from '../../hooks/useCompras';
import SimpleListModal from './modals/SimpleListModal';
import ItemsManagerModal from './modals/ItemsManagerModal';
import EntradaModal from './modals/EntradaModal';
import SaidaModal from './modals/SaidaModal';

const ComprasControleEstoque: React.FC = () => {
  const [activeView, setActiveView] = useState<'estoque' | 'entradas' | 'saidas'>('estoque');
  const [searchTerm, setSearchTerm] = useState('');

  const [modalType, setModalType] = useState<'saida' | 'entrada' | null>(null);
  const [modalInitialItemId, setModalInitialItemId] = useState('');

  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isItemsManagerOpen, setIsItemsManagerOpen] = useState(false);
  const [isUnidadesOpen, setIsUnidadesOpen] = useState(false);
  const [isSetoresOpen, setIsSetoresOpen] = useState(false);
  const [isColaboradoresOpen, setIsColaboradoresOpen] = useState(false);
  const [isFornecedoresOpen, setIsFornecedoresOpen] = useState(false);
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

  // Cadastros simples (unidades/setores/colaboradores/fornecedores) usados nos modais "Outras Ações"
  const unidadesQuery = useUnidadesMedida();
  const createUnidade = useCreateUnidadeMedida();
  const updateUnidade = useUpdateUnidadeMedida();
  const deleteUnidade = useDeleteUnidadeMedida();

  const setoresQuery = useSetoresCompras();
  const createSetor = useCreateSetorCompras();
  const updateSetor = useUpdateSetorCompras();
  const deleteSetor = useDeleteSetorCompras();

  const colaboradoresQuery = useColaboradoresCompras();
  const createColaborador = useCreateColaboradorCompras();
  const updateColaborador = useUpdateColaboradorCompras();
  const deleteColaborador = useDeleteColaboradorCompras();

  const fornecedoresQuery = useFornecedores();
  const createFornecedor = useCreateFornecedor();
  const updateFornecedor = useUpdateFornecedor();
  const deleteFornecedor = useDeleteFornecedor();

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
    return stockItems.filter((item) => item.nome.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [stockItems, searchTerm]);

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
    <div style={{ padding: '4px' }}>

      {/* Header e Toolbar */}
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Controle de estoque</h1>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => openSaidaModal()}
            className="reports-action-btn primary"
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
              <span className="reports-dropdown-item" onClick={() => openAction(setIsUnidadesOpen)}>Cadastrar Unidades</span>
              <span className="reports-dropdown-item" onClick={() => openAction(setIsSetoresOpen)}>Cadastrar Setores</span>
              <span className="reports-dropdown-item" onClick={() => openAction(setIsColaboradoresOpen)}>Cadastrar Colaboradores</span>
              <span className="reports-dropdown-item" onClick={() => openAction(setIsFornecedoresOpen)}>Cadastrar Fornecedores</span>
              <div className="reports-dropdown-divider" />
              <span className="reports-dropdown-item" onClick={handleExportLowStockPdf}>Relatório PDF: Estoque Baixo/Esgotado</span>
            </div>
          </div>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="dashboard-stats-grid" style={{ marginBottom: '24px' }}>
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

      {/* Navigation Tabs */}
      <div className="reports-tabs-bar">
        <button
          onClick={() => setActiveView('estoque')}
          className={`reports-tab-btn ${activeView === 'estoque' ? 'active' : ''}`}
        >
          <i className="bi bi-grid-3x3-gap-fill" style={{ marginRight: '6px' }}></i> Saldo de Estoque
        </button>
        <button
          onClick={() => setActiveView('entradas')}
          className={`reports-tab-btn ${activeView === 'entradas' ? 'active' : ''}`}
        >
          <i className="bi bi-cart-check" style={{ marginRight: '6px' }}></i> Últimas Compras
        </button>
        <button
          onClick={() => setActiveView('saidas')}
          className={`reports-tab-btn ${activeView === 'saidas' ? 'active' : ''}`}
        >
          <i className="bi bi-clipboard-check" style={{ marginRight: '6px' }}></i> Protocolo de Saída
        </button>
      </div>

      {activeView === 'estoque' && (
        <>
          <div className="reports-filters-bar">
            <div className="reports-filter-left">
              <div className="reports-search-wrapper" style={{ minWidth: '260px' }}>
                <i className="bi bi-search search-icon" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Pesquisar item..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="reports-filter-right">
              <span className="reports-records-count"><strong>{filteredItems.length}</strong> Itens Exibidos</span>
            </div>
          </div>

          <div className="reports-table-card">
            <QueryDataPanel
              query={itensQuery}
              variant="compact"
              loadingMessage="Carregando itens do estoque..."
              refreshingMessage="Atualizando estoque..."
              errorMessage="Não foi possível carregar o estoque. Tente novamente."
            >
              <div style={{ overflowX: 'auto' }}>
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="num" style={{ textAlign: 'right' }}>Qtd Atual</th>
                      <th className="num" style={{ textAlign: 'right' }}>Qtd Mínima</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th style={{ textAlign: 'center' }}>Ações</th>
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
                      filteredItems.map(item => {
                        let statusLabel = 'Normal';
                        let statusColor = '#10b981';
                        let statusBg = 'rgba(16, 185, 129, 0.08)';

                        if (item.qtdAtual === 0) {
                          statusLabel = 'Esgotado';
                          statusColor = '#ef4444';
                          statusBg = 'rgba(239, 68, 68, 0.08)';
                        } else if (item.qtdAtual < item.qtdMinima) {
                          statusLabel = 'Baixo';
                          statusColor = '#f59e0b';
                          statusBg = 'rgba(245, 158, 11, 0.08)';
                        }

                        return (
                          <tr key={item.id}>
                            <td style={{ fontWeight: 500 }}>{item.nome}</td>
                            <td className="num" style={{ fontWeight: 700, textAlign: 'right' }}>
                              {item.qtdAtual} <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>{item.unidade}</span>
                            </td>
                            <td className="num" style={{ color: '#64748b', textAlign: 'right' }}>
                              {item.qtdMinima} <span style={{ fontSize: '11px', color: '#94a3b8' }}>{item.unidade}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 600,
                                color: statusColor,
                                background: statusBg
                              }}>
                                {statusLabel}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => openSaidaModal(item.id)}
                                  className="btn-table-action delete"
                                  title="Registrar Saída"
                                >
                                  <i className="bi bi-dash-circle"></i> Saída
                                </button>
                                <button
                                  onClick={() => openEntradaModal(item.id)}
                                  className="btn-table-action"
                                  title="Registrar Compra (Entrada)"
                                >
                                  <i className="bi bi-plus-circle"></i> Compra
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
            </QueryDataPanel>
          </div>
        </>
      )}

      {activeView === 'entradas' && (
        <div className="reports-table-card">
          <QueryDataPanel
            query={entradasQuery}
            variant="compact"
            loadingMessage="Carregando compras..."
            refreshingMessage="Atualizando compras..."
            errorMessage="Não foi possível carregar as compras. Tente novamente."
          >
            <div style={{ overflowX: 'auto' }}>
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Data da Compra</th>
                    <th className="num" style={{ textAlign: 'right' }}>Quantidade</th>
                    <th className="num" style={{ textAlign: 'right' }}>Valor Unitário</th>
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
                    entradas.map(ent => (
                      <tr key={ent.id}>
                        <td style={{ fontWeight: 600 }}>{ent.itemNome}</td>
                        <td style={{ color: '#64748b' }}>{new Date(`${ent.data}T00:00:00`).toLocaleDateString('pt-BR')}</td>
                        <td className="num" style={{ fontWeight: 700, textAlign: 'right' }}>{ent.quantidade}</td>
                        <td className="num" style={{ textAlign: 'right' }}>
                          {ent.valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td>
                          <i className="bi bi-shop" style={{ color: '#118CC4', marginRight: '6px' }}></i>{ent.fornecedorNome}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </QueryDataPanel>
        </div>
      )}

      {activeView === 'saidas' && (
        <div className="reports-table-card">
          <QueryDataPanel
            query={saidasQuery}
            variant="compact"
            loadingMessage="Carregando protocolo de saída..."
            refreshingMessage="Atualizando protocolo de saída..."
            errorMessage="Não foi possível carregar o protocolo de saída. Tente novamente."
          >
            <div style={{ overflowX: 'auto' }}>
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Data</th>
                    <th className="num" style={{ textAlign: 'right' }}>Quantidade</th>
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
                    saidas.map(sai => (
                      <tr key={sai.id}>
                        <td style={{ fontWeight: 600 }}>{sai.itemNome}</td>
                        <td style={{ color: '#64748b' }}>{new Date(`${sai.data}T00:00:00`).toLocaleDateString('pt-BR')}</td>
                        <td className="num" style={{ fontWeight: 700, textAlign: 'right' }}>{sai.quantidade}</td>
                        <td>{sai.setorNome}</td>
                        <td>
                          <i className="bi bi-person" style={{ marginRight: '6px', color: '#64748b' }}></i>{sai.colaboradorNome}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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

      {isUnidadesOpen && (
        <SimpleListModal
          title="Cadastrar Unidades de Medida"
          placeholder="Ex: Un, Resma, Caixa..."
          query={unidadesQuery}
          onAdd={(nome) => createUnidade.mutate(nome)}
          onEdit={(id, nome) => updateUnidade.mutate({ id, nome })}
          onRemove={(id) => deleteUnidade.mutate(id)}
          isAdding={createUnidade.isPending}
          isSaving={updateUnidade.isPending}
          isRemoving={deleteUnidade.isPending}
          errorMessage={createUnidade.isError ? getComprasErrorMessage(createUnidade.error, 'Não foi possível adicionar a unidade.') : null}
          onClose={() => setIsUnidadesOpen(false)}
        />
      )}

      {isSetoresOpen && (
        <SimpleListModal
          title="Cadastrar Setores"
          placeholder="Ex: Logística, Frota, ADM..."
          query={setoresQuery}
          onAdd={(nome) => createSetor.mutate(nome)}
          onEdit={(id, nome) => updateSetor.mutate({ id, nome })}
          onRemove={(id) => deleteSetor.mutate(id)}
          isAdding={createSetor.isPending}
          isSaving={updateSetor.isPending}
          isRemoving={deleteSetor.isPending}
          errorMessage={createSetor.isError ? getComprasErrorMessage(createSetor.error, 'Não foi possível adicionar o setor.') : null}
          onClose={() => setIsSetoresOpen(false)}
        />
      )}

      {isColaboradoresOpen && (
        <SimpleListModal
          title="Cadastrar Colaboradores"
          placeholder="Ex: Carlos Santos..."
          query={colaboradoresQuery}
          onAdd={(nome) => createColaborador.mutate(nome)}
          onEdit={(id, nome) => updateColaborador.mutate({ id, nome })}
          onRemove={(id) => deleteColaborador.mutate(id)}
          isAdding={createColaborador.isPending}
          isSaving={updateColaborador.isPending}
          isRemoving={deleteColaborador.isPending}
          errorMessage={createColaborador.isError ? getComprasErrorMessage(createColaborador.error, 'Não foi possível adicionar o colaborador.') : null}
          onClose={() => setIsColaboradoresOpen(false)}
        />
      )}

      {isFornecedoresOpen && (
        <SimpleListModal
          title="Cadastrar Fornecedores"
          placeholder="Ex: Papelaria Exclusiva..."
          query={fornecedoresQuery}
          onAdd={(nome) => createFornecedor.mutate(nome)}
          onEdit={(id, nome) => updateFornecedor.mutate({ id, nome })}
          onRemove={(id) => deleteFornecedor.mutate(id)}
          isAdding={createFornecedor.isPending}
          isSaving={updateFornecedor.isPending}
          isRemoving={deleteFornecedor.isPending}
          errorMessage={createFornecedor.isError ? getComprasErrorMessage(createFornecedor.error, 'Não foi possível adicionar o fornecedor.') : null}
          onClose={() => setIsFornecedoresOpen(false)}
        />
      )}

    </div>
  );
};

export default ComprasControleEstoque;
