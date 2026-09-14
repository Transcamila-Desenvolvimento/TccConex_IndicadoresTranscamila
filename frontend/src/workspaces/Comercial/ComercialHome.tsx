import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { userCanSeeAba } from '../../constants/abas';
import ComercialCotarFretePanel from './ComercialCotarFretePanel';
import ComercialPropostasDashboard from './ComercialPropostasDashboard';

const ComercialHome: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] ?? 'Usuário';
  const canCadastro = userCanSeeAba(user, 'Comercial', 'cadastro-clientes');
  const canTabelaFrete = userCanSeeAba(user, 'Comercial', 'cadastro-tabela-frete');
  const canGeneralidades = userCanSeeAba(user, 'Comercial', 'cadastro-generalidades');
  const canProdutos = userCanSeeAba(user, 'Comercial', 'cadastro-produtos');
  const canPropostas = userCanSeeAba(user, 'Comercial', 'propostas-comerciais');
  const canValidacaoClientes = userCanSeeAba(user, 'Comercial', 'validacao-clientes');
  const [cotarAberto, setCotarAberto] = useState(false);
  const [acessoAberto, setAcessoAberto] = useState(false);
  const [ferramentasAberto, setFerramentasAberto] = useState(false);
  const temAcessoRapido = canCadastro || canTabelaFrete || canGeneralidades || canProdutos || canPropostas || canValidacaoClientes;

  return (
    <section
      id="comercial-home-view"
      className={`view active comercial-home-view${cotarAberto ? ' is-cotar-open' : ''}`}
    >
      <div className="welcome-banner">
        <h2>Olá, {firstName}!</h2>
        <p>Bem-vindo ao ambiente Comercial da Transcamila.</p>
      </div>

      {canPropostas ? <ComercialPropostasDashboard /> : null}

      {temAcessoRapido ? (
        <>
          <button
            type="button"
            className="quick-access-bar comercial-home-section-toggle"
            aria-expanded={acessoAberto}
            onClick={() => setAcessoAberto((atual) => !atual)}
          >
            <span className="comercial-home-section-toggle-main">
              <span className={`comercial-home-chevron${acessoAberto ? ' is-open' : ''}`} aria-hidden="true">
                <i className="bi bi-chevron-right" />
              </span>
              <h3 className="quick-access-title">Acesso rápido</h3>
            </span>
          </button>
          {acessoAberto ? (
          <div className="quick-access-grid">
            {canCadastro && (
            <button
              type="button"
              className="quick-access-card"
              style={{ width: '100%', textAlign: 'left' }}
              onClick={() => navigate('/comercial/cadastros/clientes')}
            >
              <div className="card-header-row">
                <div className="card-icon-wrapper">
                  <i className="bi bi-people" aria-hidden="true" />
                </div>
                <span className="card-badge" style={{ background: 'rgba(17, 140, 196, 0.08)', color: '#118CC4' }}>
                  Cadastros
                </span>
              </div>
              <h4>Clientes</h4>
              <p>Cadastre clientes comerciais com consulta automática de CNPJ.</p>
            </button>
            )}
            {canTabelaFrete && (
            <button
              type="button"
              className="quick-access-card"
              style={{ width: '100%', textAlign: 'left' }}
              onClick={() => navigate('/comercial/cadastros/tabela-frete')}
            >
              <div className="card-header-row">
                <div className="card-icon-wrapper">
                  <i className="bi bi-table" aria-hidden="true" />
                </div>
                <span className="card-badge" style={{ background: 'rgba(17, 140, 196, 0.08)', color: '#118CC4' }}>
                  Cadastros
                </span>
              </div>
              <h4>Tabela frete</h4>
              <p>Mantenha origens, destinos, veículos e valores padrão da tabela.</p>
            </button>
            )}
            {canGeneralidades && (
            <button
              type="button"
              className="quick-access-card"
              style={{ width: '100%', textAlign: 'left' }}
              onClick={() => navigate('/comercial/cadastros/generalidades')}
            >
              <div className="card-header-row">
                <div className="card-icon-wrapper">
                  <i className="bi bi-list-check" aria-hidden="true" />
                </div>
                <span className="card-badge" style={{ background: 'rgba(17, 140, 196, 0.08)', color: '#118CC4' }}>
                  Cadastros
                </span>
              </div>
              <h4>Generalidades</h4>
              <p>Edite as condições padrão que entram nas novas propostas.</p>
            </button>
            )}
            {canProdutos && (
            <button
              type="button"
              className="quick-access-card"
              style={{ width: '100%', textAlign: 'left' }}
              onClick={() => navigate('/comercial/cadastros/produtos')}
            >
              <div className="card-header-row">
                <div className="card-icon-wrapper">
                  <i className="bi bi-box-seam" aria-hidden="true" />
                </div>
                <span className="card-badge" style={{ background: 'rgba(17, 140, 196, 0.08)', color: '#118CC4' }}>
                  Cadastros
                </span>
              </div>
              <h4>Produtos</h4>
              <p>Cadastro de produtos comerciais (em desenvolvimento).</p>
            </button>
            )}
            {canPropostas && (
            <button
              type="button"
              className="quick-access-card"
              style={{ width: '100%', textAlign: 'left' }}
              onClick={() => navigate('/comercial/propostas')}
            >
              <div className="card-header-row">
                <div className="card-icon-wrapper">
                  <i className="bi bi-file-earmark-text" aria-hidden="true" />
                </div>
                <span className="card-badge" style={{ background: 'rgba(17, 140, 196, 0.08)', color: '#118CC4' }}>
                  Propostas
                </span>
              </div>
              <h4>Propostas comerciais</h4>
              <p>Rascunhos de propostas de frete e armazenagem para evoluir juntos.</p>
            </button>
            )}
            {canValidacaoClientes && (
            <button
              type="button"
              className="quick-access-card"
              style={{ width: '100%', textAlign: 'left' }}
              onClick={() => navigate('/comercial/validacao-clientes')}
            >
              <div className="card-header-row">
                <div className="card-icon-wrapper">
                  <i className="bi bi-person-check" aria-hidden="true" />
                </div>
                <span className="card-badge" style={{ background: 'rgba(17, 140, 196, 0.08)', color: '#118CC4' }}>
                  Comercial
                </span>
              </div>
              <h4>Validação clientes</h4>
              <p>Validação de clientes comerciais (em desenvolvimento).</p>
            </button>
            )}
          </div>
          ) : null}
        </>
      ) : null}

      <button
        type="button"
        className="quick-access-bar comercial-home-section-toggle"
        aria-expanded={ferramentasAberto}
        onClick={() => setFerramentasAberto((atual) => !atual)}
      >
        <span className="comercial-home-section-toggle-main">
          <span className={`comercial-home-chevron${ferramentasAberto ? ' is-open' : ''}`} aria-hidden="true">
            <i className="bi bi-chevron-right" />
          </span>
          <h3 className="quick-access-title">Ferramentas</h3>
        </span>
      </button>
      {ferramentasAberto ? (
      <div className="quick-access-grid">
        <button
          type="button"
          className={`quick-access-card${cotarAberto ? ' is-active' : ''}`}
          style={{ width: '100%', textAlign: 'left' }}
          onClick={() => setCotarAberto(true)}
        >
          <div className="card-header-row">
            <div className="card-icon-wrapper">
              <i className="bi bi-calculator" aria-hidden="true" />
            </div>
            <span className="card-badge" style={{ background: 'rgba(17, 140, 196, 0.08)', color: '#118CC4' }}>
              Ferramentas
            </span>
          </div>
          <h4>Cotar frete</h4>
          <p>Simule valores por tabela ou pelo cliente, com km, peso e ICMS.</p>
        </button>
      </div>
      ) : null}

      {cotarAberto ? <ComercialCotarFretePanel onClose={() => setCotarAberto(false)} /> : null}
    </section>
  );
};

export default ComercialHome;
