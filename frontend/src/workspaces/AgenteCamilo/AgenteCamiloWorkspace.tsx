import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { firstAllowedAbaPath } from '../../constants/abas';
import { AGENTE_CAMILO_ENVIRONMENT } from '../../constants/environments';
import AbaRoute from '../../components/AbaRoute';
import AgenteCamiloChat from './AgenteCamiloChat';

const AgenteCamiloWorkspace: React.FC = () => {
  const { user } = useAuth();
  const fallback = firstAllowedAbaPath(user, AGENTE_CAMILO_ENVIRONMENT, '/agente-camilo');

  return (
    <Routes>
      <Route
        index
        element={
          <AbaRoute module={AGENTE_CAMILO_ENVIRONMENT} aba="home" fallback={fallback}>
            <AgenteCamiloChat />
          </AbaRoute>
        }
      />
      <Route path="*" element={<Navigate to={fallback} replace />} />
    </Routes>
  );
};

export default AgenteCamiloWorkspace;
