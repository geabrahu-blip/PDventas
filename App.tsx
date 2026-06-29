import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import SalesReport from './pages/SalesReport';
import Inventory from './pages/Inventory';
import Catalog from './pages/Catalog';
import Kardex from './pages/Kardex';
import POS from './pages/POS';
import Users from './pages/Users';
import Alerts from './pages/Alerts';

function App() {
  console.log("🚀 Piel Divina POS - Despliegue forzado: ", new Date().toISOString());

  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
          <Route path="/catalogo" element={<Catalog />} />
          <Route element={<Layout />}>
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/kardex" element={<Kardex />} />
            <Route path="/reports" element={<SalesReport />} />
            <Route path="/users" element={<Users />} />
            <Route path="/alerts" element={<Alerts />} />
              <Route path="/" element={<Navigate to="/inventory" replace />} />
              <Route path="*" element={<Navigate to="/inventory" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;