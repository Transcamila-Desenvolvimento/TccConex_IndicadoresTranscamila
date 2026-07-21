import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SGQHome from './SGQHome';
import SGQPesquisaSatisfacao from './SGQPesquisaSatisfacao';

const SGQWorkspace: React.FC = () => {
  return (
    <Routes>
      <Route index element={<SGQHome />} />
      <Route path="pesquisa-satisfacao" element={<SGQPesquisaSatisfacao />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
};

export default SGQWorkspace;
