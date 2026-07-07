import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ComprasHome from './ComprasHome';
import ComprasControleEstoque from './ComprasControleEstoque';

const ComprasWorkspace: React.FC = () => {
  return (
    <Routes>
      <Route index element={<ComprasHome />} />
      <Route path="controle-estoque" element={<ComprasControleEstoque />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
};

export default ComprasWorkspace;
