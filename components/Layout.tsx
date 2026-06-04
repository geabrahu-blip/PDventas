import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Store, ShoppingCart, FileText, Menu, X, Activity } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { InventoryProvider } from '../context/InventoryContext';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col print:bg-white pb-16 md:pb-0">
      {/* Desktop Header */}
      <header className="hidden md:block bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <img src="/logo_piel_divina.jpeg" alt="Logo Piel Divina" className="h-10 w-10 rounded-full object-cover shadow-sm border border-teal-100" />
              <Link to="/" className="text-xl font-bold text-gray-900">
                Piel Divina
              </Link>
            </div>

            {/* Nav Links */}
            <nav className="hidden md:flex space-x-4">
              <Link
                to="/pos"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${isActive('/pos') ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <ShoppingCart className="w-4 h-4" /> POS
              </Link>
              {isAdmin && (
                <>
                  <Link
                    to="/inventory"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive('/inventory') ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    Inventario
                  </Link>
                  <Link
                    to="/kardex"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${isActive('/kardex') ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <Activity className="w-4 h-4" /> Kárdex
                  </Link>
                  <Link
                    to="/reports"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${isActive('/reports') ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <FileText className="w-4 h-4" /> Reportes
                  </Link>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-sm font-medium text-gray-900">{user.name}</span>
              <span className="text-xs text-gray-500 capitalize">{user.role === 'admin' ? 'Admin' : 'Vendedor'}</span>
            </div>
            <button
              onClick={logout}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Top Header (Minimal) */}
      <header className="md:hidden bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50 flex items-center justify-between px-4 h-14 print:hidden">
        <div className="flex items-center gap-2">
          <img src="/logo_piel_divina.jpeg" alt="Logo Piel Divina" className="h-8 w-8 rounded-full object-cover shadow-sm border border-teal-100" />
          <span className="font-bold text-gray-900">Piel Divina</span>
        </div>
        <button
          onClick={logout}
          className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
          title="Cerrar sesión"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 flex items-center justify-around pb-safe pt-1 print:hidden shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <Link
          to="/pos"
          className={`flex flex-col items-center p-2 min-w-[64px] ${isActive('/pos') ? 'text-teal-600' : 'text-slate-500'}`}
        >
          <ShoppingCart className="w-6 h-6 mb-1" />
          <span className="text-[10px] font-medium">POS</span>
        </Link>
        {isAdmin && (
          <>
            <Link
              to="/inventory"
              className={`flex flex-col items-center p-2 min-w-[64px] ${isActive('/inventory') ? 'text-teal-600' : 'text-slate-500'}`}
            >
              <Store className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-medium">Inventario</span>
            </Link>
            <Link
              to="/kardex"
              className={`flex flex-col items-center p-2 min-w-[64px] ${isActive('/kardex') ? 'text-teal-600' : 'text-slate-500'}`}
            >
              <Activity className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-medium">Kárdex</span>
            </Link>
            <Link
              to="/reports"
              className={`flex flex-col items-center p-2 min-w-[64px] ${isActive('/reports') ? 'text-teal-600' : 'text-slate-500'}`}
            >
              <FileText className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-medium">Reportes</span>
            </Link>
          </>
        )}
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8 print:p-0 print:m-0 print:w-full print:max-w-none">
        <InventoryProvider>
          <Outlet />
        </InventoryProvider>
      </main>
    </div>
  );
}