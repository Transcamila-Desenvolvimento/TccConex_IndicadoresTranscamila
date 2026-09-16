import React, { useMemo, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import {
  useClientesComercial,
  useTabelaFreteDistribuicaoCliente,
  useTabelasFrete,
} from '../../hooks/useComercialClientes';
import ComercialTabelaFreteSimulador from './ComercialTabelaFreteSimulador';
import { formatTabelaFreteClientes, nomeBaseTabelaFrete } from './formatTabelaFrete';

type EscopoCotacao = 'tabela' | 'cliente';

type Props = {
  onClose: () => void;
};

const ComercialCotarFretePanel: React.FC<Props> = ({ onClose }) => {
  const [escopo, setEscopo] = useState<EscopoCotacao>('cliente');
  const [clienteId, setClienteId] = useState('');
  const [tabelaIdManual, setTabelaIdManual] = useState('');

  const clientesQuery = useClientesComercial({ page: 1, pageSize: 100, ativos: true });
  const tabelasQuery = useTabelasFrete({
    page: 1,
    pageSize: 100,
    tipo: 'distribuicao',
  });
  const tabelaCliente = useTabelaFreteDistribuicaoCliente(
    escopo === 'cliente' ? clienteId || null : null,
    escopo === 'cliente' && Boolean(clienteId),
  );

  const clientes = clientesQuery.data?.results ?? [];
  const tabelas = tabelasQuery.data?.results ?? [];
  const tabelaPorCliente = tabelaCliente.tabela;
  const tabelaId = escopo === 'cliente' ? (tabelaPorCliente?.id ?? '') : tabelaIdManual;
  const tabelaSelecionada = useMemo(() => {
    if (escopo === 'cliente') return tabelaPorCliente;
    return tabelas.find((item) => item.id === tabelaIdManual) ?? null;
  }, [escopo, tabelaIdManual, tabelaPorCliente, tabelas]);

  return (
    <section id="comercial-cotar-frete" className="comercial-cotar-dock" aria-label="Cotar frete">
      <header className="comercial-cotar-panel-header">
        <div>
          <h3>Cotar frete</h3>
          <p>Simule pela tabela vigente do cliente ou escolha uma tabela cadastrada.</p>
        </div>
        <button type="button" className="btn-icon comercial-cotar-close" onClick={onClose} aria-label="Fechar">
          <i className="bi bi-x-lg" />
        </button>
      </header>

      <div className="comercial-cotar-dock-body">
        <div className="comercial-cotar-panel-filtros">
          <fieldset className="comercial-generalidades-tipos">
            <legend>Selecionar por</legend>
            <div className="comercial-generalidades-tipos-options">
              <label>
                <input
                  type="radio"
                  name="cotar-escopo"
                  checked={escopo === 'cliente'}
                  onChange={() => {
                    setEscopo('cliente');
                    setTabelaIdManual('');
                  }}
                />
                Cliente
              </label>
              <label>
                <input
                  type="radio"
                  name="cotar-escopo"
                  checked={escopo === 'tabela'}
                  onChange={() => {
                    setEscopo('tabela');
                    setClienteId('');
                  }}
                />
                Tabela
              </label>
            </div>
          </fieldset>

          {escopo === 'cliente' ? (
            <label className="tabela-frete-filter comercial-cotar-select">
              <span>Cliente</span>
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                <option value="">Selecione o cliente</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nomeFantasia || cliente.razaoSocial}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="tabela-frete-filter comercial-cotar-select">
              <span>Tabela</span>
              <select value={tabelaIdManual} onChange={(e) => setTabelaIdManual(e.target.value)}>
                <option value="">Selecione a tabela</option>
                {tabelas.map((tabela) => (
                  <option key={tabela.id} value={tabela.id}>
                    {nomeBaseTabelaFrete(tabela.nome) || 'Tabela'}
                    {formatTabelaFreteClientes(tabela) !== '—' ? ` — ${formatTabelaFreteClientes(tabela)}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {escopo === 'cliente' && !clienteId ? (
          <>
            <p className="comercial-cotar-hint">Selecione o cliente. A tabela vinculada entra automaticamente na simulação.</p>
            <ComercialTabelaFreteSimulador tabelaId={null} disabled />
          </>
        ) : escopo === 'cliente' ? (
          <QueryDataPanel
            query={tabelaCliente.listQuery}
            variant="compact"
            loadingMessage="Carregando tabela do cliente..."
            refreshingMessage="Atualizando tabela do cliente..."
            errorMessage="Não foi possível carregar a tabela do cliente."
          >
            {!tabelaId ? (
              <>
                <p className="comercial-cotar-hint">Nenhuma tabela de distribuição vigente vinculada a este cliente.</p>
                <ComercialTabelaFreteSimulador tabelaId={null} disabled />
              </>
            ) : (
              <QueryDataPanel
                query={tabelaCliente.detalheQuery}
                variant="compact"
                loadingMessage="Carregando simulação..."
                refreshingMessage="Atualizando simulação..."
                errorMessage="Não foi possível carregar a tabela para simular."
              >
                {tabelaSelecionada ? (
                  <p className="comercial-cotar-tabela-nome">
                    Tabela: {nomeBaseTabelaFrete(tabelaSelecionada.nome)}
                    {tabelaSelecionada.revisao ? ` · rev. ${tabelaSelecionada.revisao}` : ''}
                  </p>
                ) : null}
                <ComercialTabelaFreteSimulador key={tabelaId} tabelaId={tabelaId} />
              </QueryDataPanel>
            )}
          </QueryDataPanel>
        ) : (
          <QueryDataPanel
            query={tabelasQuery}
            variant="compact"
            loadingMessage="Carregando tabelas..."
            refreshingMessage="Atualizando tabelas..."
            errorMessage="Não foi possível carregar as tabelas de frete."
          >
            {tabelas.length === 0 ? (
              <>
                <p className="comercial-cotar-hint">Nenhuma tabela de distribuição cadastrada.</p>
                <ComercialTabelaFreteSimulador tabelaId={null} disabled />
              </>
            ) : !tabelaId ? (
              <>
                <p className="comercial-cotar-hint">Selecione a tabela para simular.</p>
                <ComercialTabelaFreteSimulador tabelaId={null} disabled />
              </>
            ) : (
              <>
                {tabelaSelecionada ? (
                  <p className="comercial-cotar-tabela-nome">
                    {nomeBaseTabelaFrete(tabelaSelecionada.nome)}
                    {tabelaSelecionada.revisao ? ` · rev. ${tabelaSelecionada.revisao}` : ''}
                  </p>
                ) : null}
                <ComercialTabelaFreteSimulador key={tabelaId} tabelaId={tabelaId} />
              </>
            )}
          </QueryDataPanel>
        )}
      </div>
    </section>
  );
};

export default ComercialCotarFretePanel;
