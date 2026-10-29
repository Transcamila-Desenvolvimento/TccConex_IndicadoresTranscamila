import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import QueryDataPanel from '../components/QueryDataPanel';
import logoImg from '../assets/Logo_TccConex.png';
import { useAuth } from '../contexts/AuthContext';
import { useConsultaCaepi } from '../hooks/useConsultaCaepi';
import type { CertificadoAprovacaoEpi } from '../types/domain';
import './consultaCa.css';

const FONTE_OFICIAL = 'https://caepi.trabalho.gov.br/internet/ConsultaCAInternet.aspx';

function tomSituacao(situacao: string): 'ok' | 'alerta' | 'erro' | 'neutro' {
  const texto = situacao.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (texto.includes('VENCID') || texto.includes('CANCEL')) return 'erro';
  if (texto.includes('SUSPENS')) return 'alerta';
  if (texto.includes('VALID')) return 'ok';
  return 'neutro';
}

const CertificadoCard: React.FC<{ certificado: CertificadoAprovacaoEpi }> = ({ certificado }) => {
  const campos = [
    ['Validade', certificado.validade],
    ['Natureza', certificado.natureza],
    ['CNPJ', certificado.cnpj],
    ['Processo', certificado.processo],
    ['Razão social', certificado.razaoSocial],
  ].filter(([, valor]) => valor);

  return (
    <article className="consulta-ca-resultado-card">
      <div className="consulta-ca-topo">
        <div>
          <p className="consulta-ca-kicker">Certificado</p>
          <h2 className="consulta-ca-numero">CA {certificado.numero}</h2>
          {certificado.equipamento && <p className="consulta-ca-equipamento">{certificado.equipamento}</p>}
        </div>
        {certificado.situacao && (
          <span className={`consulta-ca-situacao consulta-ca-situacao--${tomSituacao(certificado.situacao)}`}>
            {certificado.situacao}
          </span>
        )}
      </div>

      {campos.length > 0 && (
        <dl className="consulta-ca-campos">
          {campos.map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt>{rotulo}</dt>
              <dd>{valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {certificado.descricao && <p className="consulta-ca-descricao">{certificado.descricao}</p>}

      {certificado.historico.length > 0 && (
        <div>
          <h3>Histórico</h3>
          <ul className="consulta-ca-historico">
            {certificado.historico.map((item) => (
              <li key={`${item.data}-${item.situacao}`}>
                <span>{item.data}</span>
                <strong>{item.situacao}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="consulta-ca-fonte">
        {certificado.fonte}.{' '}
        <a href={FONTE_OFICIAL} target="_blank" rel="noreferrer">Abrir a consulta oficial</a>
      </p>
    </article>
  );
};

const ConsultaCaPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedEnvironment } = useAuth();
  const [digitado, setDigitado] = useState('');
  const [numero, setNumero] = useState('');
  const consulta = useConsultaCaepi(numero);
  const origem = (location.state as { voltar?: string } | null)?.voltar;
  const voltar = origem && origem.startsWith('/') && origem !== '/consulta-ca'
    ? origem
    : (selectedEnvironment ? '/' : '/select-environment');

  const buscar = (event: React.FormEvent) => {
    event.preventDefault();
    const limpo = digitado.replace(/\D/g, '').slice(0, 6);
    if (!limpo) return;
    if (limpo === numero) {
      void consulta.refetch();
      return;
    }
    setNumero(limpo);
  };

  return (
    <div className="login-container consulta-ca-pagina">
      <div className="consulta-ca-painel">
        <img src={logoImg} alt="TccConex" className="consulta-ca-logo" />

        <section className="consulta-ca-caixa">
          <header className="consulta-ca-cabecalho">
            <h1>Consulta de CA</h1>
            <p>Informe o número impresso no equipamento para ver o certificado de aprovação.</p>
          </header>

          <form id="consulta-ca-form" className="consulta-ca-form" onSubmit={buscar}>
            <label htmlFor="consulta-ca-numero">Número do CA</label>
            <input
              id="consulta-ca-numero"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="search"
              maxLength={6}
              placeholder="Ex.: 12345"
              value={digitado}
              onChange={(event) => setDigitado(event.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <button type="submit" disabled={!digitado || consulta.isFetching}>
              {consulta.isFetching ? 'Consultando...' : 'Consultar'}
            </button>
          </form>

          {numero && (
            <QueryDataPanel
              query={consulta}
              variant="compact"
              loadingMessage="Consultando o certificado..."
              refreshingMessage="Atualizando a consulta..."
              errorMessage="Não foi possível consultar o CA agora. Tente novamente."
            >
              {consulta.data?.encontrado && consulta.data.certificado ? (
                <CertificadoCard certificado={consulta.data.certificado} />
              ) : (
                <p className="consulta-ca-vazio">Nenhum certificado encontrado para o CA {numero}.</p>
              )}
            </QueryDataPanel>
          )}
        </section>

        <button type="button" className="consulta-ca-voltar" onClick={() => navigate(voltar)}>
          Voltar ao sistema
        </button>
      </div>
    </div>
  );
};

export default ConsultaCaPage;
