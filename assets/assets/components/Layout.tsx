import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Store, ShoppingCart, FileText, Menu, X } from 'lucide-react';
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
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
              {isAdmin && (
                <>
                  <Link
                    to="/inventory"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive('/inventory') ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    Inventario General
                  </Link>
                </>
              )}
              <Link
                to="/pos"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${isActive('/pos') ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <ShoppingCart className="w-4 h-4" /> POS
              </Link>
              {isAdmin && (
                <>
                  <Link
                    to="/stores"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${isActive('/stores') ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <Store className="w-4 h-4" /> Tiendas y Usuarios
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
            {!isAdmin && (
              <div className="hidden md:flex items-center gap-1 text-xs text-teal-600 bg-teal-50 px-2 py-1 rounded-full">
                <Store className="w-3 h-3" />
                Sucursal Asignada
              </div>
            )}
            <button
              onClick={logout}
              className="hidden md:block p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="h-5 w-5" />
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Menú principal"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-200 shadow-lg absolute w-full left-0">
            <nav className="flex flex-col px-4 pt-2 pb-4 space-y-2">
              {isAdmin && (
                <Link
                  to="/inventory"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-md text-base font-medium transition-colors ${isActive('/inventory') ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  Inventario General
                </Link>
              )}
              <Link
                to="/pos"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`px-4 py-3 rounded-md text-base font-medium transition-colors flex items-center gap-2 ${isActive('/pos') ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <ShoppingCart className="w-5 h-5" /> POS
              </Link>
              {isAdmin && (
                <>
                  <Link
                    to="/stores"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`px-4 py-3 rounded-md text-base font-medium transition-colors flex items-center gap-2 ${isActive('/stores') ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <Store className="w-5 h-5" /> Tiendas y Usuarios
                  </Link>
                  <Link
                    to="/reports"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`px-4 py-3 rounded-md text-base font-medium transition-colors flex items-center gap-2 ${isActive('/reports') ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <FileText className="w-5 h-5" /> Reportes
                  </Link>
                </>
              )}

              <div className="border-t border-gray-200 mt-2 pt-4 px-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-sm font-medium text-gray-900">{user.name}</span>
                    <span className="block text-xs text-gray-500 capitalize">{user.role === 'admin' ? 'Admin' : 'Vendedor'}</span>
                  </div>
                  {!isAdmin && (
                    <div className="flex items-center gap-1 text-xs text-teal-600 bg-teal-50 px-2 py-1 rounded-full">
                      <Store className="w-3 h-3" />
                      Sucursal Asignada
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                  className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                >
                  <LogOut className="h-5 w-5" /> Cerrar sesión
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <InventoryProvider>
          <Outlet />
        </InventoryProvider>
      </main>
    </div>
  );
}