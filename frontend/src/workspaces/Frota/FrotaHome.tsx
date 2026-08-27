import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

const FrotaHome: React.FC = () => {
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] ?? 'Usuário';

  return (
    <section id="frota-home-view" className="view active" style={{ display: 'block', padding: '4px' }}>
      <div className="welcome-banner">
        <h2>Olá, {firstName}!</h2>
        <p>Bem-vindo ao ambiente de Frota da Transcamila.</p>
      </div>
    </section>
  );
};

export default FrotaHome;
