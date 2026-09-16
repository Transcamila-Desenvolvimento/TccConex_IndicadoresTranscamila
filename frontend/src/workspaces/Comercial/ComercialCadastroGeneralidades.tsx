import React, { useEffect, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import {
  getComercialErrorMessage,
  useClientesComercial,
  useComercialGeneralidades,
  useSaveComercialGeneralidades,
} from '../../hooks/useComercialClientes';
import type { PropostaCondicaoComercial, TipoGeneralidadeComercial } from '../../types/domain';
import { TIPOS_GENERALIDADE_COMERCIAL } from '../../types/domain';

const ComercialCadastroGeneralidades: React.FC = () => {
  const { user } = useAuth();
  const canManage = userHasFuncao(user, 'Comercial', 'gerenciar-generalidades');
  const [clienteId, setClienteId] = useState('');
  const [tipo, setTipo] = useState<TipoGeneralidadeComercial>('frete');
  const [clienteFiltro, setClienteFiltro] = useState('');
  const [items, setItems] = useState<PropostaCondicaoComercial[]>([]);

  const [confirmPadrao, setConfirmPadrao] = useState(false);

  const clientesQuery = useClientesComercial({
    page: 1,
    pageSize: 100,
    search: clienteFiltro.trim() || undefined,
    ativos: true,
  });
  const catalogQuery = useComercialGeneralidades(clienteId || null, tipo, { permitirPadrao: true });
  const saveCatalog = useSaveComercialGeneralidades();
  const clientes = clientesQuery.data?.results ?? [];
  const isPadraoGeral = !clienteId;
  const tipoLabel = TIPOS_GENERALIDADE_COMERCIAL.find((item) => item.key === tipo)?.label ?? tipo;

  useEffect(() => {
    if (catalogQuery.data) {
      setItems(catalogQuery.data.items.map((item) => ({ ...item })));
    }
  }, [catalogQuery.data]);

  const updateItem = (index: number, patch: Partial<PropostaCondicaoComercial>) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const addItem = () => {
    setItems((current) => [...current, { rotulo: '', valor: '' }]);
  };

  const cleanedItems = () => items
    .map((item) => ({ rotulo: item.rotulo.trim(), valor: item.valor.trim() }))
    .filter((item) => item.rotulo || item.valor);

  const persistCatalog = (aplicar?: 'todos' | 'novos') => {
    saveCatalog.mutate(
      { clienteId: clienteId || null, tipo, items: cleanedItems(), aplicar },
      {
        onSuccess: () => setConfirmPadrao(false),
        onError: (err) => alert(getComercialErrorMessage(err)),
      },
    );
  };

  const handleSave = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (isPadraoGeral) {
      setConfirmPadrao(true);
      return;
    }
    persistCatalog();
  };

  return (
    <div className="fat-list-compact" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0 4px 4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Generalidades</h1>
        </div>
        {canManage ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="reports-action-btn secondary" onClick={addItem}>
              Adicionar item
            </button>
            <button
              type="button"
              className="reports-action-btn primary"
              style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
              disabled={saveCatalog.isPending}
              onClick={() => handleSave()}
            >
              {saveCatalog.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        ) : null}
      </header>

      <div className="reports-filters-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
        <div className="reports-filter-left" style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="reports-search-wrapper" style={{ minWidth: '200px' }}>
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <input
              type="text"
              placeholder="Filtrar cliente..."
              value={clienteFiltro}
              onChange={(e) => setClienteFiltro(e.target.value)}
            />
          </div>
          <div className="reports-select-wrapper" style={{ minWidth: '280px' }}>
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Padrão geral</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nomeFantasia || cliente.razaoSocial}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="comercial-generalidades-tipos">
            <legend>Tipo de serviço</legend>
            <div className="comercial-generalidades-tipos-options">
              {TIPOS_GENERALIDADE_COMERCIAL.map((option) => (
                <label key={option.key}>
                  <input
                    type="radio"
                    name="tipo-generalidade"
                    checked={tipo === option.key}
                    onChange={() => setTipo(option.key)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      <QueryDataPanel
        query={catalogQuery}
        refreshVariant="overlay"
        loadingMessage="Carregando generalidades..."
        refreshingMessage="Atualizando generalidades..."
        errorMessage="Não foi possível carregar as generalidades."
      >
        <form className="erp-card reports-table-card comercial-browse-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onSubmit={handleSave}>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="erp-table reports-table comercial-browse-table comercial-generalidades-table">
              <thead>
                <tr>
                  <th style={{ width: '32%' }}>Item</th>
                  <th>Condição</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="comercial-browse-empty">
                      Não há registros a serem exibidos.
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          className="proposta-destinos-input"
                          value={item.rotulo}
                          disabled={!canManage}
                          onChange={(e) => updateItem(index, { rotulo: e.target.value })}
                        />
                      </td>
                      <td>
                        <div className="comercial-generalidades-condicao-row">
                          <input
                            className="proposta-destinos-input"
                            value={item.valor}
                            disabled={!canManage}
                            maxLength={800}
                            onChange={(e) => updateItem(index, { valor: e.target.value })}
                          />
                          {canManage ? (
                            <button
                              type="button"
                              className="btn-icon"
                              title="Remover"
                              onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                            >
                              <i className="bi bi-trash" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </form>
      </QueryDataPanel>
      {confirmPadrao ? (
        <div
          className="search-backdrop"
          style={{ display: 'flex', zIndex: 3100 }}
          onClick={(e) => { if (e.target === e.currentTarget && !saveCatalog.isPending) setConfirmPadrao(false); }}
        >
          <div className="search-modal-card" style={{ width: 480 }}>
            <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Aplicar padrão geral</h3>
              <span className="search-close-key" style={{ cursor: 'pointer', fontSize: 12 }} onClick={() => !saveCatalog.isPending && setConfirmPadrao(false)}>Fechar (X)</span>
            </div>
            <div style={{ padding: '16px 4px 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                Deseja alterar as generalidades de {tipoLabel.toLowerCase()} para todos os clientes, ou considerar somente os novos?
              </p>
              <p style={{ margin: 0, fontSize: 12.5, color: '#64748b', lineHeight: 1.45 }}>
                <strong>Todos os clientes</strong> substitui o catálogo atual de todos.
                {' '}
                <strong>Somente novos</strong> mantém o que os clientes atuais já usam e vale o novo padrão só para cadastros futuros.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', padding: '12px 0 4px' }}>
              <button type="button" className="reports-action-btn secondary" disabled={saveCatalog.isPending} onClick={() => setConfirmPadrao(false)}>
                Cancelar
              </button>
              <button type="button" className="reports-action-btn secondary" disabled={saveCatalog.isPending} onClick={() => persistCatalog('novos')}>
                {saveCatalog.isPending ? 'Salvando...' : 'Somente novos'}
              </button>
              <button
                type="button"
                className="reports-action-btn primary"
                style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
                disabled={saveCatalog.isPending}
                onClick={() => persistCatalog('todos')}
              >
                {saveCatalog.isPending ? 'Salvando...' : 'Alterar para todos'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ComercialCadastroGeneralidades;
