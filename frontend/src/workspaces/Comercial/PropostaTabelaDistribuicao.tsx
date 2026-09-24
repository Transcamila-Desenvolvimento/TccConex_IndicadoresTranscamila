import { type ReactNode, useLayoutEffect, useId, useRef, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import { useTabelaFreteDistribuicaoCliente } from '../../hooks/useComercialClientes';
import type { PropostaTabelaDistribuicaoSnapshot } from '../../types/domain';
import { formatColunaExtraValor, formatTabelaAmount, formatTabelaPercentFator, isGrisAdvUnificado, isTarifaVeiculo } from './formatTabelaFrete';

type Props = {
  clienteId: string | null;
  snapshot?: PropostaTabelaDistribuicaoSnapshot | null;
};

function PropostaDistribuicaoGradeScroll({ children }: { children: ReactNode }) {
  const topRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const syncing = useRef<'top' | 'body' | null>(null);
  const [contentWidth, setContentWidth] = useState(0);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    const table = body?.querySelector('table');
    if (!body || !table) return undefined;
    const measure = () => setContentWidth(table.scrollWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(table);
    observer.observe(body);
    const onWheel = (event: WheelEvent) => {
      const horizontal = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
      if (!horizontal) return;
      const delta = event.shiftKey ? event.deltaY : event.deltaX;
      if (!delta) return;
      event.preventDefault();
      body.scrollLeft += delta;
      if (topRef.current) topRef.current.scrollLeft = body.scrollLeft;
    };
    body.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      observer.disconnect();
      body.removeEventListener('wheel', onWheel);
    };
  }, []);

  return (
    <>
      <div
        className="proposta-distribuicao-hscroll"
        ref={topRef}
        onScroll={() => {
          if (syncing.current === 'body') return;
          syncing.current = 'top';
          if (bodyRef.current && topRef.current) {
            bodyRef.current.scrollLeft = topRef.current.scrollLeft;
          }
          syncing.current = null;
        }}
      >
        <div className="proposta-distribuicao-hscroll-spacer" style={{ width: contentWidth }} />
      </div>
      <div
        className="proposta-distribuicao-body"
        ref={bodyRef}
        onScroll={() => {
          if (syncing.current === 'top') return;
          syncing.current = 'body';
          if (bodyRef.current && topRef.current) {
            topRef.current.scrollLeft = bodyRef.current.scrollLeft;
          }
          syncing.current = null;
        }}
      >
        {children}
      </div>
    </>
  );
}

export default function PropostaTabelaDistribuicao({
  clienteId,
  snapshot = null,
}: Props) {
  const { listQuery, detalheQuery, tabela } = useTabelaFreteDistribuicaoCliente(clienteId, Boolean(clienteId));
  const listState = useAsyncQueryState(listQuery);
  const detalheState = useAsyncQueryState(detalheQuery);
  const [aberta, setAberta] = useState(true);
  const painelId = useId();
  const faixas = (snapshot?.faixas?.length ? snapshot.faixas : tabela?.faixas) ?? [];
  const bandas = faixas[0]?.tarifas ?? [];
  const extras = faixas[0]?.extras ?? [];
  const grisAdvUnificado = snapshot?.grisAdvUnificado ?? isGrisAdvUnificado(tabela?.config);
  const nomeTabela = snapshot?.nome || tabela?.nome || listQuery.data?.results[0]?.nome;

  if (!clienteId) {
    return (
      <div className="proposta-distribuicao-empty">
        <p>Selecione um cliente para ver a tabela de distribuição.</p>
      </div>
    );
  }

  return (
    <QueryDataPanel
      query={listQuery}
      variant="compact"
      loadingMessage="Carregando tabela de distribuição..."
      refreshingMessage="Atualizando tabela de distribuição..."
      errorMessage="Não foi possível carregar a tabela de distribuição."
    >
      {listState.canShowEmpty && (listQuery.data?.results.length ?? 0) === 0 ? (
        <div className="proposta-distribuicao-empty">
          <p>Nenhuma tabela de distribuição vinculada a este cliente.</p>
        </div>
      ) : (
            <div className={`proposta-destinos-card proposta-distribuicao-card${aberta ? ' is-open' : ''}`}>
              <button
                type="button"
                className="proposta-distribuicao-toggle"
                aria-expanded={aberta}
                aria-controls={painelId}
                onClick={() => setAberta((atual) => !atual)}
              >
                <span className="proposta-distribuicao-toggle-copy">
                  <span className="proposta-distribuicao-toggle-title">Tabela de distribuição</span>
                  {nomeTabela ? (
                    <span className="proposta-distribuicao-nome">{nomeTabela}</span>
                  ) : null}
                </span>
                <i className={`bi ${aberta ? 'bi-chevron-up' : 'bi-chevron-down'}`} aria-hidden="true" />
              </button>
              {aberta ? (
              <div id={painelId} className="proposta-distribuicao-wrap">
        <QueryDataPanel
          query={detalheQuery}
          variant="compact"
          loadingMessage="Carregando faixas..."
          refreshingMessage="Atualizando faixas..."
          errorMessage="Não foi possível carregar as faixas da tabela."
        >
          {detalheState.canShowEmpty && faixas.length === 0 ? (
            <div className="proposta-distribuicao-empty">
              <p>A tabela “{tabela?.nome || 'distribuição'}” ainda não tem faixas. Recalcule no cadastro de tabela frete.</p>
            </div>
          ) : (
              <PropostaDistribuicaoGradeScroll>
              <div className="table-container">
                <table className="data-table tabela-frete-grade proposta-distribuicao-grade">
                  <thead>
                    <tr>
                      <th className="is-km">De</th>
                      <th className="is-km">Até</th>
                      <th className="is-money">Frete mín.</th>
                      {bandas.map((banda) => (
                        <th
                          key={banda.key || banda.rotulo}
                          className={`is-banda${isTarifaVeiculo(banda) ? ' is-veiculo' : ' is-ton'}`}
                        >
                          {banda.rotulo}
                        </th>
                      ))}
                      <th className="is-extra is-group-start">Pedágio/t</th>
                      {grisAdvUnificado ? (
                        <th className="is-extra">GRIS/ADV %</th>
                      ) : (
                        <>
                          <th className="is-extra">GRIS %</th>
                          <th className="is-extra">ADV %</th>
                        </>
                      )}
                      {extras.map((coluna) => (
                        <th key={coluna.key || coluna.rotulo} className="is-extra">{coluna.rotulo}</th>
                      ))}
                      <th className="is-prazo is-group-start">Prazo frac.</th>
                      <th className="is-prazo">Prazo fechado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {faixas.map((faixa) => (
                      <tr key={`${faixa.kmDe}-${faixa.kmAte}`}>
                        <td className="is-km">{faixa.kmDe}</td>
                        <td className="is-km">{faixa.kmAte}</td>
                        <td className="is-money">{formatTabelaAmount(faixa.freteMinimo)}</td>
                        {faixa.tarifas.map((tarifa) => (
                          <td key={tarifa.key} className={`is-banda${isTarifaVeiculo(tarifa) ? ' is-veiculo' : ' is-ton'}`}>
                            {formatTabelaAmount(tarifa.valor)}
                          </td>
                        ))}
                        <td className="is-extra is-group-start">{formatTabelaAmount(faixa.pedagioTon)}</td>
                        {grisAdvUnificado ? (
                          <td className="is-extra">{formatTabelaPercentFator(faixa.grisPercent)}</td>
                        ) : (
                          <>
                            <td className="is-extra">{formatTabelaPercentFator(faixa.grisPercent)}</td>
                            <td className="is-extra">{formatTabelaPercentFator(faixa.advPercent)}</td>
                          </>
                        )}
                        {extras.map((coluna) => {
                          const extra = (faixa.extras || []).find((item) => item.key === coluna.key) ?? coluna;
                          return (
                            <td key={coluna.key} className="is-extra">{formatColunaExtraValor(extra)}</td>
                          );
                        })}
                        <td className="is-prazo is-group-start">{faixa.prazoFracionado}</td>
                        <td className="is-prazo">{faixa.prazoFechado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </PropostaDistribuicaoGradeScroll>
          )}
        </QueryDataPanel>
              </div>
              ) : null}
            </div>
      )}
    </QueryDataPanel>
  );
}
