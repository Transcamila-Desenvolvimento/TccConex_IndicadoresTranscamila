import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LogisticaHome from './LogisticaHome';
import LogisticaConfiguracoes from './LogisticaConfiguracoes';

const LogisticaWorkspace: React.FC = () => {
  return (
    <Routes>
      <Route index element={<LogisticaHome />} />
      <Route path="configuracoes" element={<LogisticaConfiguracoes />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
};

export default LogisticaWorkspace;
