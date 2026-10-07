import React, { useEffect, useMemo, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import { getFrotaErrorMessage } from '../../hooks/useFrotaVeiculos';
import { useOlhoVivo, useOlhoVivoAno, useSalvarOlhoVivo } from '../../hooks/useFrotaOlhoVivo';
import type { OlhoVivoMesResumo } from '../../types/domain';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const ANO_INICIAL = 2019;

const formatQuando = (iso: string | null) => {
  if (!iso) return '';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleString('pt-BR');
};

const statusDoMes = (mes: OlhoVivoMesResumo) => {
  if (!mes.respondido) return 'Sem resposta';
  const quando = formatQuando(mes.atualizadoEm);
  const quem = mes.atualizadoPor ? `por ${mes.atualizadoPor}` : '';
  return ['Respondido', quem, quando ? `em ${quando}` : ''].filter(Boolean).join(' ');
};

const MesAberto: React.FC<{ ano: number; mes: number; canRespond: boolean }> = ({ ano, mes, canRespond }) => {
  const query = useOlhoVivo({ ano, mes });
  const salvar = useSalvarOlhoVivo();
  const resposta = query.data;
  const [valores, setValores] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!resposta) return;
    const next: Record<string, string> = {};
    for (const item of resposta.itens) {
      next[item.comportamento] = String(item.recorrencia ?? 0);
    }
    setValores(next);
  }, [resposta]);

  const total = useMemo(
    () => Object.values(valores).reduce((soma, valor) => soma + (Number(valor) || 0), 0),
    [valores],
  );

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!resposta || !canRespond) return;
    salvar.mutate(
      {
        ano,
        mes,
        itens: resposta.itens.map((item) => ({
          comportamento: item.comportamento,
          recorrencia: Math.max(0, Math.trunc(Number(valores[item.comportamento]) || 0)),
        })),
      },
      { onError: (err: unknown) => alert(getFrotaErrorMessage(err)) },
    );
  };

  return (
    <form onSubmit={handleSave}>
      <div className="olho-vivo-painel">
        <div className="olho-vivo-barra">
          <span>
            {resposta?.respondido
              ? statusDoMes({
                mes,
                respondido: true,
                total,
                atualizadoEm: resposta.atualizadoEm,
                atualizadoPor: resposta.atualizadoPor,
              })
              : 'Preencha a recorrência deste mês.'}
          </span>
          {canRespond && (
            <button
              type="submit"
              className="reports-action-btn primary"
              style={{ backgroundColor: '#118CC4', borderColor: '#118CC4', height: '28px', padding: '0 10px', fontSize: '12px' }}
              disabled={salvar.isPending || query.isLoading}
            >
              {salvar.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          )}
        </div>
        <QueryDataPanel
          query={query}
          variant="compact"
          loadingMessage="Carregando mês..."
          refreshingMessage="Atualizando mês..."
          errorMessage="Não foi possível carregar este mês. Tente novamente."
        >
          <div className="olho-vivo-grade">
            {(resposta?.itens ?? []).map((item) => (
              <label key={item.comportamento} className="olho-vivo-item">
                <span>{item.descricao}</span>
                <input
                  type="number"
                  className="form-input"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  aria-label={`Recorrência de ${item.descricao} em ${MESES[mes - 1]}`}
                  value={valores[item.comportamento] ?? '0'}
                  disabled={!canRespond}
                  onChange={(e) => setValores((atual) => ({
                    ...atual,
                    [item.comportamento]: e.target.value,
                  }))}
                />
              </label>
            ))}
          </div>
          <div className="olho-vivo-total">
            <strong>Total {total.toLocaleString('pt-BR')}</strong>
          </div>
        </QueryDataPanel>
      </div>
    </form>
  );
};

const FrotaOlhoVivo: React.FC = () => {
  const { user, selectedFilial } = useAuth();
  const canRespond = userHasFuncao(user, 'Frota', 'responder-olho-vivo');
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const anos = useMemo(
    () => Array.from({ length: anoAtual - ANO_INICIAL + 1 }, (_, index) => anoAtual - index),
    [anoAtual],
  );
  const [ano, setAno] = useState(anoAtual);
  const [mesAberto, setMesAberto] = useState<number | null>(null);
  const anoQuery = useOlhoVivoAno(ano);
  const meses = anoQuery.data?.meses ?? [];

  return (
    <section id="frota-olho-vivo-view" className="view active" style={{ display: 'block', padding: '4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Olho vivo na estrada</h1>
        </div>
      </header>

      <p style={{ margin: '0 0 14px', color: '#64748b' }}>
        Abra o mês para registrar a recorrência dos comportamentos críticos
        {selectedFilial ? ` em ${selectedFilial}` : ''}.
      </p>

      <div className="reports-filters-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
        <div className="reports-select-wrapper" style={{ minWidth: '120px' }}>
          <select
            value={ano}
            aria-label="Ano"
            onChange={(e) => {
              setAno(Number(e.target.value));
              setMesAberto(null);
            }}
          >
            {anos.map((opcao) => (
              <option key={opcao} value={opcao}>{opcao}</option>
            ))}
          </select>
        </div>
      </div>

      <QueryDataPanel
        query={anoQuery}
        loadingMessage="Carregando meses..."
        refreshingMessage="Atualizando meses..."
        errorMessage="Não foi possível carregar os meses. Tente novamente."
      >
        <div className="logistica-settings-accordion">
          {MESES.map((nome, index) => {
            const numero = index + 1;
            const resumo = meses.find((item) => item.mes === numero);
            const aberto = mesAberto === numero;
            return (
              <section key={nome} className={`logistica-settings-accordion-item${aberto ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="logistica-settings-accordion-trigger"
                  aria-expanded={aberto}
                  onClick={() => setMesAberto(aberto ? null : numero)}
                >
                  <span className="logistica-settings-accordion-title">
                    <span className="logistica-settings-accordion-label">{nome}</span>
                  </span>
                  {!aberto && (
                    <span className="logistica-settings-accordion-hint">
                      {resumo ? statusDoMes(resumo) : 'Sem resposta'}
                      {resumo?.respondido ? ` · total ${resumo.total.toLocaleString('pt-BR')}` : ''}
                    </span>
                  )}
                  <svg
                    className="logistica-settings-accordion-chevron"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <div className="logistica-settings-accordion-body-wrap">
                  <div className="logistica-settings-accordion-body">
                    {aberto ? <MesAberto ano={ano} mes={numero} canRespond={canRespond} /> : null}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </QueryDataPanel>
    </section>
  );
};

export default FrotaOlhoVivo;
