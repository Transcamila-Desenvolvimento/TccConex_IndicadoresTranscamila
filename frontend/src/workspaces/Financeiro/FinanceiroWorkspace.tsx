import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { firstAllowedAbaPath } from '../../constants/abas';
import AbaRoute from '../../components/AbaRoute';
import FinanceiroHome from './FinanceiroHome';
import FinanceiroCalendar from './FinanceiroCalendar';
import FinanceiroReports from './FinanceiroReports';
import FinanceiroBalances from './FinanceiroBalances';
import FinanceiroAdjustments from './FinanceiroAdjustments';
import FinanceiroBilling from './FinanceiroBilling';

const FinanceiroWorkspace: React.FC = () => {
  const { user } = useAuth();
  const fallback = firstAllowedAbaPath(user, 'Financeiro', '/financeiro/home');

  return (
    <Routes>
      <Route path="home" element={<AbaRoute module="Financeiro" aba="home" fallback={fallback}><FinanceiroHome /></AbaRoute>} />
      <Route path="calendar" element={<AbaRoute module="Financeiro" aba="calendario" fallback={fallback}><FinanceiroCalendar /></AbaRoute>} />
      <Route path="reports" element={<AbaRoute module="Financeiro" aba="inclusao-relatorios" fallback={fallback}><FinanceiroReports /></AbaRoute>} />
      <Route path="balances" element={<AbaRoute module="Financeiro" aba="saldos-bancarios" fallback={fallback}><FinanceiroBalances /></AbaRoute>} />
      <Route path="adjustments" element={<AbaRoute module="Financeiro" aba="ajustes-caixa" fallback={fallback}><FinanceiroAdjustments /></AbaRoute>} />
      <Route path="billing" element={<AbaRoute module="Financeiro" aba="faturamento" fallback={fallback}><FinanceiroBilling /></AbaRoute>} />
      <Route path="*" element={<Navigate to={fallback} replace />} />
    </Routes>
  );
};

export default FinanceiroWorkspace;
