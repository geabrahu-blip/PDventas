import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import SalesReport from './pages/SalesReport';
import Inventory from './pages/Inventory';
import Catalog from './pages/Catalog';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
          <Route path="/catalogo" element={<Catalog />} />
          <Route element={<Layout />}>
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/reports" element={<SalesReport />} />
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