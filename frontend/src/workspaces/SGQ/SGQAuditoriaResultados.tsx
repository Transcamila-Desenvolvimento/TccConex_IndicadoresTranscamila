import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import { useSgqAuditoriaExecucao } from '../../hooks/useSgqAuditorias';
import type { SgqAuditoriaExecucao, SgqNormaItem } from '../../types/domain';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const SEM_RESPOSTA = '__sem__';
const SEM_CLASSE = '__sem_classe__';

type Serie = { chave: string; rotulo: string; cor: string; ordem: number };
type Categoria = { id: string; rotulo: string; contagens: Map<string, number> };

function encurtar(texto: string, limite: number) {
  return texto.length > limite ? `${texto.slice(0, limite).trimEnd()}…` : texto;
}

function corDaOpcao(valor: number | null, repeticao: number) {
  const matiz = valor == null ? 215 : valor >= 100 ? 152 : valor > 0 ? 40 : 4;
  const luz = 38 + (repeticao % 3) * 10;
  return `hsl(${matiz} 52% ${luz}%)`;
}

/** Nome da classificação (ex.: M → Mandatória), na ordem cadastrada na norma. */
function classificacoesDaNorma(dados: SgqAuditoriaExecucao) {
  const ordem: string[] = [];
  const nomes = new Map<string, Set<string>>();
  dados.normas.forEach((norma) => {
    norma.classificacoes.forEach((classe) => {
      if (!ordem.includes(classe.sigla)) ordem.push(classe.sigla);
      const lista = nomes.get(classe.sigla) ?? new Set<string>();
      if (classe.nome.trim()) lista.add(classe.nome.trim());
      nomes.set(classe.sigla, lista);
    });
  });
  return { ordem, nomes };
}

function rotuloDaClasse(sigla: string, nomes: Map<string, Set<string>>) {
  const lista = [...(nomes.get(sigla) ?? [])];
  if (lista.length === 1) return lista[0];
  if (lista.length > 1) return `${sigla} (${lista.join(', ')})`;
  return sigla;
}

function agregarRespostasAuditoria(dados: SgqAuditoriaExecucao) {
  const respostas = new Map(dados.respostas.map((resposta) => [resposta.itemId, resposta]));
  const classes = classificacoesDaNorma(dados);

  const series = new Map<string, Serie>();
  const repeticaoPorValor = new Map<string, number>();
  dados.tiposResposta.forEach((tipo) => {
    tipo.opcoes.forEach((opcao) => {
      const chave = opcao.texto || opcao.codigo;
      if (!chave || series.has(chave)) return;
      const faixa = opcao.valor == null ? 'na' : String(opcao.valor);
      const repeticao = repeticaoPorValor.get(faixa) ?? 0;
      repeticaoPorValor.set(faixa, repeticao + 1);
      series.set(chave, {
        chave,
        rotulo: chave,
        cor: corDaOpcao(opcao.valor, repeticao),
        ordem: opcao.valor == null ? -1 : opcao.valor,
      });
    });
  });

  const porResposta = new Map<string, number>();
  const categorias = new Map<string, Categoria>();

  const registrar = (item: SgqNormaItem) => {
    const sigla = item.classificacao.trim();
    const id = sigla || SEM_CLASSE;
    let grupo = categorias.get(id);
    if (!grupo) {
      grupo = {
        id,
        rotulo: sigla ? rotuloDaClasse(sigla, classes.nomes) : 'Sem classificação',
        contagens: new Map(),
      };
      categorias.set(id, grupo);
    }
    const resposta = respostas.get(item.id);
    const sem = !resposta?.opcaoCodigo;
    const chave = sem ? SEM_RESPOSTA : (resposta.opcaoTexto || resposta.opcaoCodigo);
    if (!sem && !series.has(chave)) {
      series.set(chave, {
        chave,
        rotulo: chave,
        cor: corDaOpcao(resposta.valor, 0),
        ordem: resposta.valor == null ? -1 : resposta.valor,
      });
    }
    porResposta.set(chave, (porResposta.get(chave) ?? 0) + 1);
    grupo.contagens.set(chave, (grupo.contagens.get(chave) ?? 0) + 1);
  };

  dados.itens.forEach((item) => {
    if (item.tipo === 'pergunta') registrar(item);
  });

  const listaSeries = [...series.values()]
    .filter((serie) => (porResposta.get(serie.chave) ?? 0) > 0)
    .sort((a, b) => b.ordem - a.ordem);
  if ((porResposta.get(SEM_RESPOSTA) ?? 0) > 0) {
    listaSeries.push({ chave: SEM_RESPOSTA, rotulo: 'Sem resposta', cor: '#cbd5e1', ordem: -2 });
  }

  const listaCategorias = [...categorias.values()].sort((a, b) => {
    const posicao = (id: string) => {
      if (id === SEM_CLASSE) return classes.ordem.length + 1;
      const indice = classes.ordem.indexOf(id);
      return indice < 0 ? classes.ordem.length : indice;
    };
    return posicao(a.id) - posicao(b.id);
  });

  const total = [...porResposta.values()].reduce((soma, valor) => soma + valor, 0);
  const respondidas = total - (porResposta.get(SEM_RESPOSTA) ?? 0);
  return { series: listaSeries, porResposta, categorias: listaCategorias, total, respondidas };
}

const tooltip = {
  backgroundColor: '#0f172a',
  padding: 10,
  titleFont: { size: 12 },
  bodyFont: { size: 12 },
};

interface Props {
  auditoriaId: string;
}

export { agregarRespostasAuditoria };

const SGQAuditoriaResultados: React.FC<Props> = ({ auditoriaId }) => {
  const { selectedFilial } = useAuth();
  const execucaoQuery = useSgqAuditoriaExecucao(selectedFilial, auditoriaId);
  const { canShowEmpty } = useAsyncQueryState(execucaoQuery);
  const resumo = useMemo(
    () => (execucaoQuery.data ? agregarRespostasAuditoria(execucaoQuery.data) : null),
    [execucaoQuery.data],
  );

  const pizza = useMemo(() => {
    if (!resumo) return null;
    return {
      labels: resumo.series.map((serie) => serie.rotulo),
      datasets: [{
        data: resumo.series.map((serie) => resumo.porResposta.get(serie.chave) ?? 0),
        backgroundColor: resumo.series.map((serie) => serie.cor),
        borderColor: '#ffffff',
        borderWidth: 0,
        hoverOffset: 4,
      }],
    };
  }, [resumo]);

  const barras = useMemo(() => {
    if (!resumo) return null;
    return {
      labels: resumo.categorias.map((categoria) => categoria.rotulo),
      datasets: resumo.series.map((serie) => ({
        label: serie.rotulo,
        data: resumo.categorias.map((categoria) => categoria.contagens.get(serie.chave) ?? 0),
        backgroundColor: serie.cor,
        borderWidth: 0,
        maxBarThickness: 22,
      })),
    };
  }, [resumo]);

  const alturaGrafico = resumo ? Math.max(240, resumo.categorias.length * 32 + 72) : 240;
  const progresso = resumo && resumo.total > 0 ? Math.round((resumo.respondidas / resumo.total) * 100) : 0;

  return (
    <section className="sgq-aud-resultados" aria-label="Gráficos das respostas">
      <QueryDataPanel
        query={execucaoQuery}
        variant="compact"
        loadingMessage="Carregando respostas da auditoria..."
        refreshingMessage="Atualizando respostas..."
        errorMessage="Não foi possível carregar as respostas desta auditoria."
      >
        {canShowEmpty && resumo?.total === 0 ? (
          <div className="sgq-aud-resultados-vazio">
            <i className="bi bi-bar-chart" aria-hidden="true" />
            <span>As normas desta auditoria ainda não têm perguntas para gerar os gráficos.</span>
          </div>
        ) : resumo && pizza && barras && resumo.total > 0 ? (
          <>
            <header className="sgq-aud-resultados-topo">
              <h4>Respostas da norma</h4>
              <p>{resumo.respondidas} de {resumo.total} perguntas respondidas</p>
            </header>
            <div className="sgq-aud-progresso-linha">
              <div
                className="sgq-aud-progresso"
                role="progressbar"
                aria-valuenow={resumo.respondidas}
                aria-valuemin={0}
                aria-valuemax={resumo.total}
                aria-label="Progresso geral das perguntas"
              >
                <span style={{ width: `${progresso}%` }} />
              </div>
              <strong>{progresso}%</strong>
            </div>
            <div className="sgq-aud-resultados-graficos">
              <article className="sgq-aud-resultado-card">
                <h5>Por categoria</h5>
                <p>Classificação cadastrada na norma</p>
                <div className="sgq-aud-resultado-chart" style={{ height: alturaGrafico }}>
                  <Bar
                    data={barras}
                    options={{
                      indexAxis: 'y',
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 8,
                            padding: 12,
                            color: '#64748b',
                            font: { size: 11 },
                          },
                        },
                        tooltip: {
                          ...tooltip,
                          callbacks: {
                            label: (item) => {
                              const valor = Number(item.raw ?? 0);
                              if (!valor) return '';
                              const categoria = resumo.categorias[item.dataIndex];
                              const totalCategoria = resumo.series.reduce(
                                (soma, serie) => soma + (categoria?.contagens.get(serie.chave) ?? 0),
                                0,
                              );
                              const pct = totalCategoria ? Math.round((valor / totalCategoria) * 100) : 0;
                              return ` ${item.dataset.label}: ${valor} (${pct}%)`;
                            },
                          },
                        },
                      },
                      scales: {
                        x: {
                          stacked: true,
                          beginAtZero: true,
                          ticks: { precision: 0, color: '#94a3b8', font: { size: 11 } },
                          grid: { color: '#e8eef5' },
                          border: { display: false },
                        },
                        y: {
                          stacked: true,
                          ticks: {
                            color: '#334155',
                            font: { size: 11 },
                            callback(value) {
                              return encurtar(this.getLabelForValue(Number(value)), 32);
                            },
                          },
                          grid: { display: false },
                          border: { display: false },
                        },
                      },
                    }}
                  />
                </div>
              </article>
              <article className="sgq-aud-resultado-card">
                <h5>Por resposta</h5>
                <p>Opção escolhida em cada pergunta</p>
                <div className="sgq-aud-resultado-chart is-pizza" style={{ height: alturaGrafico }}>
                  <Pie
                    data={pizza}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      layout: { padding: { bottom: 4 } },
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 8,
                            padding: 12,
                            color: '#64748b',
                            font: { size: 11 },
                            generateLabels: (chart) => {
                              const cores = chart.data.datasets[0]?.backgroundColor as string[];
                              const valores = chart.data.datasets[0]?.data as number[];
                              return (chart.data.labels ?? []).map((label, index) => ({
                                text: `${encurtar(String(label), 22)} (${valores[index] ?? 0})`,
                                fillStyle: cores[index],
                                strokeStyle: cores[index],
                                fontColor: '#64748b',
                                hidden: !chart.getDataVisibility(index),
                                index,
                                datasetIndex: 0,
                              }));
                            },
                          },
                        },
                        tooltip: {
                          ...tooltip,
                          callbacks: {
                            label: (item) => {
                              const valor = Number(item.raw ?? 0);
                              const pct = resumo.total ? Math.round((valor / resumo.total) * 100) : 0;
                              return ` ${item.label}: ${valor} (${pct}%)`;
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>
              </article>
            </div>
          </>
        ) : null}
      </QueryDataPanel>
    </section>
  );
};

export default SGQAuditoriaResultados;
