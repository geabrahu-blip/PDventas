import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Stores from './pages/Stores';
import StoreInventory from './pages/StoreInventory';
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
            <Route path="/stores" element={<Stores />} />
            <Route path="/pos" element={<StoreInventory />} />
            <Route path="/reports" element={<SalesReport />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;