import React, { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import camiloLogo from '../../assets/camilo-logo.png';
import { useAuth } from '../../contexts/AuthContext';
import { useAceitarCamiloTermo, useCamiloMeuTermo } from '../../hooks/useCamiloTermos';

function erroApi(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  return 'Não foi possível registrar o aceite.';
}

const CamiloTermoUso: React.FC = () => {
  const { user, clearEnvironment } = useAuth();
  const navigate = useNavigate();
  const tituloId = useId();
  const status = useCamiloMeuTermo();
  const aceitar = useAceitarCamiloTermo();
  const [concordou, setConcordou] = useState(false);
  const [erro, setErro] = useState('');
  const aberto = Boolean(user) && !status.isLoading && status.data?.aceito !== true;

  useEffect(() => {
    if (!aberto) return undefined;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [aberto]);

  if (!user || !aberto) return null;

  const confirmar = (event: React.FormEvent) => {
    event.preventDefault();
    if (!concordou || aceitar.isPending) return;
    setErro('');
    aceitar.mutate(undefined, {
      onError: (error) => setErro(erroApi(error)),
    });
  };

  const recusar = () => {
    clearEnvironment();
    navigate('/select-environment');
  };

  return (
    <div className="camilo-termo">
      <form
        className="camilo-termo-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onSubmit={confirmar}
      >
        <img src={camiloLogo} alt="Camilo" className="camilo-termo-logo" />
        <h2 id={tituloId}>{status.data?.titulo || 'Termo de uso do Camilo IA'}</h2>
        <p className="camilo-termo-lead">
          {status.data?.introducao || 'Antes de usar esta ferramenta, leia e aceite as condições abaixo.'}
        </p>
        {(status.data?.assinatura || '').trim() && (
          <p className="camilo-termo-powered">{status.data?.assinatura}</p>
        )}

        <label className="camilo-termo-campo">
          <span>Colaborador</span>
          <input type="text" value={user.name || user.username} readOnly />
        </label>

        <div className="camilo-termo-corpo">
          {(status.data?.secoes ?? []).map((secao) => (
            <section key={secao.titulo}>
              <h3>{secao.titulo}</h3>
              <p>{secao.texto}</p>
            </section>
          ))}
        </div>

        <label className="camilo-termo-check">
          <input
            type="checkbox"
            checked={concordou}
            onChange={(event) => setConcordou(event.target.checked)}
          />
          <span>{status.data?.declaracao || 'Li e concordo com o termo de uso do Camilo IA.'}</span>
        </label>

        {erro && <p className="camilo-termo-erro">{erro}</p>}
        <div className="camilo-termo-acoes">
          <button type="button" className="camilo-termo-recusar" onClick={recusar} disabled={aceitar.isPending}>
            Recusar
          </button>
          <button type="submit" className="camilo-termo-aceitar" disabled={!concordou || aceitar.isPending}>
            {aceitar.isPending ? 'Aceitando...' : 'Aceitar'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CamiloTermoUso;
