import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { firstAllowedAbaPath } from '../../constants/abas';
import AbaRoute from '../../components/AbaRoute';
import MarketingHome from './MarketingHome';
import MarketingCampanhas from './MarketingCampanhas';

const MarketingWorkspace: React.FC = () => {
  const { user } = useAuth();
  const fallback = firstAllowedAbaPath(user, 'Marketing', '/marketing');

  return (
    <Routes>
      <Route index element={<AbaRoute module="Marketing" aba="home" fallback={fallback}><MarketingHome /></AbaRoute>} />
      <Route path="campanhas" element={<AbaRoute module="Marketing" aba="campanhas" fallback={fallback}><MarketingCampanhas /></AbaRoute>} />
      <Route path="*" element={<Navigate to={fallback} replace />} />
    </Routes>
  );
};

export default MarketingWorkspace;
