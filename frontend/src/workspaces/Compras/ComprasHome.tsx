import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

const ComprasHome: React.FC = () => {
  const { user, selectedFilial } = useAuth();
  const firstName = user?.name?.split(' ')[0] ?? 'Usuário';

  return (
    <section id="compras-home-view" className="view active" style={{ display: 'block' }}>
      <div className="welcome-banner" style={{ background: 'linear-gradient(135deg, #0f85c1 0%, #0c6a99 100%)' }}>
        <h2>Olá, {firstName}!</h2>
        <p>
          Bem-vindo ao ambiente de Compras
          {selectedFilial ? ` · ${selectedFilial}` : ''}.
        </p>
      </div>
    </section>
  );
};

export default ComprasHome;
