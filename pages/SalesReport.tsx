import { useState, useEffect, useCallback, useMemo } from 'react';
import { Sale } from '../types';
import { getSales, cancelSale } from '../services/db';
import { FileText, Calendar, DollarSign, Trash2, Search } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { getLocalDateString, getYesterdayDateString, getThisWeekRange, getThisMonthRange } from '../utils/dateUtils';
import { useInventory } from '../context/InventoryContext';

const SalesReport = () => {
  const { showToast } = useToast();
  const { isAdmin } = useAuth();
  const { refreshInventory } = useInventory();
  const [sales, setSales] = useState<Sale[]>([]);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);

  // Filters
  const [startDate, setStartDate] = useState<string>(() => getLocalDateString());
  const [endDate, setEndDate] = useState<string>(() => getLocalDateString());
  // Active quick filter to style buttons
  const [activeFilter, setActiveFilter] = useState<'hoy' | 'ayer' | 'semana' | 'mes' | 'todas' | 'custom'>('hoy');

  const loadData = useCallback(async () => {
    try {
      // Vendors strictly see today
      if (!isAdmin) {
        const today = getLocalDateString();
        const salesData = await getSales(today, today);
        setSales(salesData);
        return;
      }

      // Admin sees based on range
      if (activeFilter === 'todas') {
        const salesData = await getSales();
        setSales(salesData);
      } else {
        const salesData = await getSales(startDate, endDate);
        setSales(salesData);
      }
    } catch (error) {
      console.error('Error loading sales:', error);
      showToast('Error al cargar ventas', 'error');
    }
  }, [showToast, startDate, endDate, isAdmin, activeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setFilterHoy = () => {
    const today = getLocalDateString();
    setStartDate(today);
    setEndDate(today);
    setActiveFilter('hoy');
  };

  const setFilterAyer = () => {
    const ayer = getYesterdayDateString();
    setStartDate(ayer);
    setEndDate(ayer);
    setActiveFilter('ayer');
  };

  const setFilterSemana = () => {
    const { start, end } = getThisWeekRange();
    setStartDate(start);
    setEndDate(end);
    setActiveFilter('semana');
  };

  const setFilterMes = () => {
    const { start, end } = getThisMonthRange();
    setStartDate(start);
    setEndDate(end);
    setActiveFilter('mes');
  };

  const setFilterTodas = () => {
    setStartDate('');
    setEndDate('');
    setActiveFilter('todas');
  };

  const handleCustomReport = () => {
    setActiveFilter('custom');
    loadData();
  };

  const handleDeleteClick = (sale: Sale) => {
    setSaleToDelete(sale);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!saleToDelete) return;

    try {
      showToast('Anulando venta...', 'info');
      await cancelSale(saleToDelete.id, saleToDelete.items);

      // Actualizar inventario local para reflejar la devolución del stock en otras vistas
      refreshInventory();

      showToast('Venta anulada correctamente. Stock devuelto.', 'success');
      loadData();
    } catch (error) {
      console.error('Error canceling sale:', error);
      showToast('Hubo un error al anular la venta', 'error');
    } finally {
      setIsDeleteModalOpen(false);
      setSaleToDelete(null);
    }
  };

  const totalSalesAmount = sales.reduce((sum, sale) => sum + sale.total, 0);

  const totalCashSales = sales.reduce((sum, sale) => {
    if (sale.paymentMethod === 'Cash') return sum + sale.total;
    if (sale.paymentMethod === 'Mixto' && sale.amountCash) return sum + sale.amountCash;
    return sum;
  }, 0);

  const totalQRSales = sales.reduce((sum, sale) => {
    if (sale.paymentMethod === 'QR') return sum + sale.total;
    if (sale.paymentMethod === 'Mixto' && sale.amountQR) return sum + sale.amountQR;
    return sum;
  }, 0);

  // Used to display the header dynamically
  const displayTitle = useMemo(() => {
    if (!isAdmin) return 'Ventas de Hoy';

    if (activeFilter === 'todas') return 'Todas las Ventas';
    if (startDate === endDate) return `Ventas en ${new Date(startDate + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`;

    return `Ventas desde ${new Date(startDate + 'T12:00:00').toLocaleDateString('es-ES')} hasta ${new Date(endDate + 'T12:00:00').toLocaleDateString('es-ES')}`;
  }, [isAdmin, activeFilter, startDate, endDate]);


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {displayTitle}
        </h1>
      </div>

      {/* Filters Interface (Only Admin) */}
      {isAdmin ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-gray-200 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-gray-800">Filtrar Ventas por Período</h2>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-4">
            {/* Quick Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-3">Selección Rápida</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={setFilterHoy}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm ${activeFilter === 'hoy' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                >
                  <Calendar className="w-4 h-4" /> Hoy
                </button>
                <button
                  onClick={setFilterAyer}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm ${activeFilter === 'ayer' ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-orange-500 text-white hover:bg-orange-600'}`}
                >
                  <Calendar className="w-4 h-4" /> Ayer
                </button>
                <button
                  onClick={setFilterSemana}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm ${activeFilter === 'semana' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-red-500 text-white hover:bg-red-600'}`}
                >
                  <Calendar className="w-4 h-4" /> Semana
                </button>
                <button
                  onClick={setFilterMes}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm ${activeFilter === 'mes' ? 'bg-purple-700 text-white hover:bg-purple-800' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                >
                  <Calendar className="w-4 h-4" /> Mes
                </button>
                <button
                  onClick={setFilterTodas}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm ${activeFilter === 'todas' ? 'bg-green-700 text-white hover:bg-green-800' : 'bg-green-600 text-white hover:bg-green-700'}`}
                >
                  <Search className="w-4 h-4" /> Todas
                </button>
              </div>
            </div>

            {/* Custom Period */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-3">Período Personalizado</label>
              <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Fecha Inicio *</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setActiveFilter('custom');
                      }}
                      className="w-full border-gray-200 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm py-2 px-3"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Fecha Fin *</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setActiveFilter('custom');
                      }}
                      className="w-full border-gray-200 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm py-2 px-3"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCustomReport}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Search className="w-4 h-4" /> Generar Reporte
                </button>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
            <span>Período seleccionado: {activeFilter !== 'todas' ? `${startDate} - ${endDate}` : 'Todos los registros'}</span>
            <span className="text-indigo-600 font-medium">Reporte en tiempo real</span>
          </div>
        </div>
      ) : (
        <div className="bg-teal-50 p-4 rounded-lg border border-teal-100 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-teal-600" />
          <span className="text-teal-800 font-medium">Estás visualizando las ventas de hoy.</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
             Total Ventas QR
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            Bs. {(totalQRSales || 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
             Total Ventas Efectivo
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            Bs. {(totalCashSales || 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
           <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
             Ventas Realizadas
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {sales.length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
             Total Neto
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            Bs. {(totalSalesAmount || 0).toFixed(2)}
          </p>
        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Anular Venta"
        message="¿Estás seguro de anular esta venta? Se eliminará el registro financiero y se devolverá el stock al inventario, registrándose como una ENTRADA en el Kárdex."
        confirmText="Anular Venta"
        onConfirm={confirmDelete}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setSaleToDelete(null);
        }}
      />

      {/* Sales Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Fecha y Hora</th>
                <th className="px-6 py-4">Sucursal</th>
                <th className="px-6 py-4">Vendedor</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Productos</th>
                <th className="px-6 py-4">Pago</th>
                <th className="px-6 py-4 text-right">Total</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {new Date(sale.date).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    Bodega Central
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {sale.userName || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {sale.clientName}
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-xs">
                    <ul className="list-disc list-inside">
                      {sale.items.map((item, idx) => (
                        <li key={idx}>{item.quantity}x {item.name}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 items-start">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        sale.paymentMethod === 'QR' ? 'bg-purple-100 text-purple-800' :
                        sale.paymentMethod === 'Mixto' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {sale.paymentMethod}
                      </span>
                      {sale.paymentMethod === 'Mixto' && (
                        <div className="text-[10px] text-gray-500 whitespace-nowrap">
                          EF: {sale.amountCash} | QR: {sale.amountQR}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-teal-600">
                    Bs. {(sale.total || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleDeleteClick(sale)}
                      className="p-1 text-gray-400 hover:text-red-600 rounded-full transition-colors"
                      title="Anular venta y devolver stock"
                    >
                      <Trash2 className="w-5 h-5 mx-auto" />
                    </button>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    No se encontraron ventas para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SalesReport;
