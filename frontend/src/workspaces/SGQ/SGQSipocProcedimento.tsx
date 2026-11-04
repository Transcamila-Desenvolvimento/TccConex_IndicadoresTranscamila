import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QueryDataPanel from '../../components/QueryDataPanel';
import { getFrotaErrorMessage } from '../../hooks/useFrotaOlhoVivo';
import { useAtualizarSgqSipocProcedimento, useSalvarEsquemaSipoc, useSgqSipocProcedimento } from '../../hooks/useSgqSipoc';
import type { SgqSipocEsquema } from '../../types/domain';
import SGQSipocLousa from './SGQSipocLousa';
import { baixarSipocPdf } from './sipocPdf';

const vazio: SgqSipocEsquema = { nos: [], ligacoes: [] };

const SGQSipocProcedimento: React.FC = () => {
  const { procedimentoId } = useParams();
  const id = Number(procedimentoId);
  const consulta = useSgqSipocProcedimento(Number.isFinite(id) ? id : null);
  const salvar = useSalvarEsquemaSipoc(id);
  const atualizar = useAtualizarSgqSipocProcedimento(id);
  const [esquema, setEsquema] = useState<SgqSipocEsquema | null>(null);
  const [pronto, setPronto] = useState(false);
  const [situacao, setSituacao] = useState<'salvo' | 'salvando' | 'erro'>('salvo');
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [nome, setNome] = useState('');
  const nomeEmEdicao = useRef(false);
  const cancelarNome = useRef(false);
  const origem = useRef('');
  const fila = useRef<SgqSipocEsquema | null>(null);
  const enviando = useRef(false);

  useEffect(() => {
    if (!consulta.data) return;
    if (!nomeEmEdicao.current) setNome(consulta.data.nome);
    if (consulta.data.esquema && !pronto) {
      origem.current = JSON.stringify(consulta.data.esquema);
      setEsquema(consulta.data.esquema);
      setPronto(true);
    }
  }, [consulta.data, pronto]);

  async function exportarPdf() {
    if (!consulta.data || !esquema || gerandoPdf) return;
    setGerandoPdf(true);
    try {
      await baixarSipocPdf({
        nome: nome.trim() || consulta.data.nome,
        setor: consulta.data.setorNome,
        descricao: consulta.data.descricao,
        esquema,
      });
    } catch {
      alert('Não foi possível gerar o PDF.');
    } finally {
      setGerandoPdf(false);
    }
  }

  function confirmarNome() {
    nomeEmEdicao.current = false;
    const atual = consulta.data?.nome ?? '';
    if (cancelarNome.current) {
      cancelarNome.current = false;
      setNome(atual);
      return;
    }
    const texto = nome.trim();
    if (!texto || texto === atual) {
      setNome(atual);
      return;
    }
    atualizar.mutate({ nome: texto }, {
      onError: (err) => {
        alert(getFrotaErrorMessage(err));
        setNome(atual);
      },
    });
  }

  function enviar(proximo: SgqSipocEsquema) {
    if (enviando.current) {
      fila.current = proximo;
      return;
    }
    enviando.current = true;
    setSituacao('salvando');
    salvar.mutate(proximo, {
      onSuccess: () => {
        enviando.current = false;
        const pendente = fila.current;
        fila.current = null;
        if (pendente) {
          enviar(pendente);
          return;
        }
        origem.current = JSON.stringify(proximo);
        setSituacao('salvo');
      },
      onError: () => {
        enviando.current = false;
        fila.current = null;
        setSituacao('erro');
      },
    });
  }

  useEffect(() => {
    if (!pronto || !esquema) return undefined;
    if (JSON.stringify(esquema) === origem.current) return undefined;
    const timer = window.setTimeout(() => enviar(esquema), 700);
    return () => window.clearTimeout(timer);
  }, [esquema, pronto]);

  return (
    <section className="view active sipoc-pagina">
      <QueryDataPanel query={consulta} loadingMessage="Abrindo a lousa..." errorMessage="Não foi possível abrir o procedimento.">
        {consulta.data && esquema && (
          <>
            <header className="sgq-aud-header">
              <div className="sgq-exec-ident">
                <Link to="/sgq/sipoc" className="sgq-exec-voltar" aria-label="Voltar aos procedimentos">
                  <i className="bi bi-arrow-left" aria-hidden="true" />
                </Link>
                <div className="sgq-exec-ident-texto">
                  <input
                    className="view-page-title tabela-frete-title-input"
                    value={nome}
                    maxLength={140}
                    aria-label="Título do procedimento"
                    style={{ width: `${Math.max(12, nome.length + 1)}ch` }}
                    onFocus={() => { nomeEmEdicao.current = true; }}
                    onChange={(event) => setNome(event.target.value)}
                    onBlur={confirmarNome}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        cancelarNome.current = true;
                        event.currentTarget.blur();
                      }
                    }}
                  />
                  <p className="sgq-aud-subtitle">
                    {consulta.data.setorNome}{consulta.data.descricao ? ` · ${consulta.data.descricao}` : ''}
                  </p>
                </div>
              </div>
              <span className={`sipoc-status is-${situacao}`}>
                {situacao === 'salvando' ? 'Salvando...' : situacao === 'erro' ? 'Não foi possível salvar' : 'Lousa salva'}
              </span>
            </header>
            <SGQSipocLousa
              esquema={esquema.nos ? esquema : vazio}
              onChange={setEsquema}
              onExportar={exportarPdf}
              exportando={gerandoPdf}
            />
          </>
        )}
      </QueryDataPanel>
    </section>
  );
};

export default SGQSipocProcedimento;
