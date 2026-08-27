import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { firstAllowedAbaPath } from '../../constants/abas';
import AbaRoute from '../../components/AbaRoute';
import SGQHome from './SGQHome';
import SGQPesquisaSatisfacao from './SGQPesquisaSatisfacao';

const SGQWorkspace: React.FC = () => {
  const { user } = useAuth();
  const fallback = firstAllowedAbaPath(user, 'SGQ', '/sgq');

  return (
    <Routes>
      <Route index element={<AbaRoute module="SGQ" aba="home" fallback={fallback}><SGQHome /></AbaRoute>} />
      <Route path="pesquisa-satisfacao" element={<AbaRoute module="SGQ" aba="pesquisa-satisfacao" fallback={fallback}><SGQPesquisaSatisfacao /></AbaRoute>} />
      <Route path="*" element={<Navigate to={fallback} replace />} />
    </Routes>
  );
};

export default SGQWorkspace;
