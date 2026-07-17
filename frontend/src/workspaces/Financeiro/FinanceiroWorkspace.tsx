import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Sub-components/Pages
import FinanceiroHome from './FinanceiroHome';
import FinanceiroReports from './FinanceiroReports';
import FinanceiroBalances from './FinanceiroBalances';
import FinanceiroAdjustments from './FinanceiroAdjustments';
import FinanceiroBilling from './FinanceiroBilling';
import FinanceiroOcorrencias from './FinanceiroOcorrencias';

const FinanceiroWorkspace: React.FC = () => {
  return (
    <Routes>
      <Route path="home" element={<FinanceiroHome />} />
      <Route path="reports" element={<FinanceiroReports />} />
      <Route path="balances" element={<FinanceiroBalances />} />
      <Route path="adjustments" element={<FinanceiroAdjustments />} />
      <Route path="billing" element={<FinanceiroBilling />} />
      <Route path="ocorrencias/*" element={<FinanceiroOcorrencias />} />
      <Route path="*" element={<Navigate to="home" replace />} />
    </Routes>
  );
};

export default FinanceiroWorkspace;
