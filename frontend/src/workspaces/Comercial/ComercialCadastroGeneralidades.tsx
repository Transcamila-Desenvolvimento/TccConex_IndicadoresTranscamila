import React, { useEffect, useMemo, useState } from 'react';
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
import { catalogoGeneralidadesPadrao, TIPOS_GENERALIDADE_COMERCIAL } from '../../types/domain';

const ComercialCadastroGeneralidades: React.FC = () => {
  const { user } = useAuth();
  const canManage = userHasFuncao(user, 'Comercial', 'gerenciar-generalidades');
  const [clienteId, setClienteId] = useState('');
  const [tipo, setTipo] = useState<TipoGeneralidadeComercial>('frete');
  const [clienteFiltro, setClienteFiltro] = useState('');
  const [items, setItems] = useState<PropostaCondicaoComercial[]>([]);

  const clientesQuery = useClientesComercial({ page: 1, pageSize: 100 });
  const catalogQuery = useComercialGeneralidades(clienteId || null, tipo);
  const saveCatalog = useSaveComercialGeneralidades();
  const clientes = clientesQuery.data?.results ?? [];

  const clientesFiltrados = useMemo(() => {
    const query = clienteFiltro.trim().toLowerCase();
    if (!query) return clientes;
    return clientes.filter((cliente) => {
      const nome = `${cliente.razaoSocial} ${cliente.nomeFantasia}`.toLowerCase();
      return nome.includes(query) || (cliente.cnpj || '').toLowerCase().includes(query);
    });
  }, [clientes, clienteFiltro]);

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

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!clienteId) {
      alert('Selecione o cliente.');
      return;
    }
    const cleaned = items
      .map((item) => ({ rotulo: item.rotulo.trim(), valor: item.valor.trim() }))
      .filter((item) => item.rotulo || item.valor);
    saveCatalog.mutate(
      { clienteId, tipo, items: cleaned },
      { onError: (err) => alert(getComercialErrorMessage(err)) },
    );
  };

  const tipoLabel = TIPOS_GENERALIDADE_COMERCIAL.find((item) => item.key === tipo)?.label ?? tipo;

  return (
    <div className="fat-list-compact" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0 4px 4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Generalidades</h1>
        </div>
        {canManage && clienteId ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="reports-action-btn secondary"
              onClick={addItem}
            >
              Adicionar item
            </button>
            <button
              type="button"
              className="reports-action-btn primary"
              style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
              disabled={saveCatalog.isPending}
              onClick={handleSave}
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
          <div className="reports-select-wrapper" style={{ minWidth: '260px' }}>
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Selecione o cliente</option>
              {clientesFiltrados.map((cliente) => (
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

      {!clienteId ? (
        <div className="erp-card" style={{ padding: 24, color: 'var(--text-muted)' }}>
          Selecione o cliente e o tipo de serviço para cadastrar as generalidades.
        </div>
      ) : (
        <QueryDataPanel
          query={catalogQuery}
          loadingMessage="Carregando generalidades..."
          refreshingMessage="Atualizando generalidades..."
          errorMessage="Não foi possível carregar as generalidades."
        >
          <form className="erp-card reports-table-card comercial-browse-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onSubmit={handleSave}>
            {catalogQuery.data?.origem === 'padrao' ? (
              <p style={{ margin: '8px 12px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Ainda não há itens salvos para este cliente em {tipoLabel.toLowerCase()}.
                {' '}
                {tipo === 'frete'
                  ? 'O padrão segue as Generalidades da proposta de transferência.'
                  : tipo === 'distribuicao'
                    ? 'O padrão segue as Considerações da proposta de distribuição.'
                    : 'O padrão segue as Observações da tabela de armazenagem.'}
                {' '}
                Salve para gravar neste cliente.
              </p>
            ) : null}
            <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table comercial-browse-table comercial-generalidades-table">
                <thead>
                  <tr>
                    <th style={{ width: '32%' }}>Item</th>
                    <th>Condição</th>
                    {canManage ? <th style={{ width: 48 }} /> : null}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={canManage ? 3 : 2} className="comercial-browse-empty">
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
                          <input
                            className="proposta-destinos-input"
                            value={item.valor}
                            disabled={!canManage}
                            maxLength={800}
                            onChange={(e) => updateItem(index, { valor: e.target.value })}
                          />
                        </td>
                        {canManage ? (
                          <td>
                            <button
                              type="button"
                              className="btn-icon"
                              title="Remover"
                              onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                            >
                              <i className="bi bi-trash" />
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {canManage ? (
              <div style={{ padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="reports-action-btn secondary" onClick={addItem}>
                  Adicionar item
                </button>
                {items.length === 0 ? (
                  <button
                    type="button"
                    className="reports-action-btn secondary"
                    onClick={() => setItems(catalogoGeneralidadesPadrao(tipo).map((item) => ({ ...item })))}
                  >
                    Restaurar padrão
                  </button>
                ) : null}
              </div>
            ) : null}
          </form>
        </QueryDataPanel>
      )}
    </div>
  );
};

export default ComercialCadastroGeneralidades;
