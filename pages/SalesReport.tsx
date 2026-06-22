import { useState, useEffect, useCallback } from 'react';
import { Sale } from '../types';
import { getSales, cancelSale } from '../services/db';
import { FileText, Calendar, DollarSign, Trash2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';

const SalesReport = () => {
  const { showToast } = useToast();
  const { isAdmin } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);

  // Filters
  const [filterDate, setFilterDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const applyFilters = useCallback(() => {
    let result = sales;

    if (filterDate) {
      result = result.filter(sale => sale.date.startsWith(filterDate));
    }

    setFilteredSales(result);
  }, [sales, filterDate]);

  const loadData = useCallback(async () => {
    try {
      const salesData = await getSales();
      setSales(salesData);
    } catch (error) {
      console.error('Error loading sales:', error);
      showToast('Error al cargar ventas', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleDeleteClick = (sale: Sale) => {
    setSaleToDelete(sale);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!saleToDelete) return;

    try {
      showToast('Anulando venta...', 'info');
      await cancelSale(saleToDelete.id, saleToDelete.items);
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

  const totalSalesAmount = filteredSales.reduce((sum, sale) => sum + sale.total, 0);

  const totalCashSales = filteredSales.reduce((sum, sale) => {
    if (sale.paymentMethod === 'Cash') return sum + sale.total;
    if (sale.paymentMethod === 'Mixto' && sale.amountCash) return sum + sale.amountCash;
    return sum;
  }, 0);

  const totalQRSales = filteredSales.reduce((sum, sale) => {
    if (sale.paymentMethod === 'QR') return sum + sale.total;
    if (sale.paymentMethod === 'Mixto' && sale.amountQR) return sum + sale.amountQR;
    return sum;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-teal-600" />
          Reporte de Ventas
        </h1>
      </div>

      {/* Filters / Headers */}
      {isAdmin ? (
        <div className="bg-white p-4 rounded-lg shadow flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Calendar className="w-4 h-4" /> Fecha
            </label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <button
            onClick={() => setFilterDate('')}
            className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md"
          >
            Limpiar Filtro
          </button>
        </div>
      ) : (
        <div className="bg-teal-50 p-4 rounded-lg border border-teal-100 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-teal-600" />
          <span className="text-teal-800 font-medium">Ventas de Hoy</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-teal-500 flex flex-col justify-center">
          <p className="text-sm font-medium text-gray-500">Total Neto (Filtro Actual)</p>
          <p className="text-2xl font-bold text-gray-900 flex items-center gap-2 mt-1">
            <DollarSign className="w-5 h-5 text-teal-500" /> Bs. {(totalSalesAmount || 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500 flex flex-col justify-center">
          <p className="text-sm font-medium text-gray-500">Total Efectivo</p>
          <p className="text-2xl font-bold text-green-600 flex items-center gap-2 mt-1">
            <DollarSign className="w-5 h-5 text-green-500" /> Bs. {(totalCashSales || 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500 flex flex-col justify-center">
          <p className="text-sm font-medium text-gray-500">Total QR</p>
          <p className="text-2xl font-bold text-purple-600 flex items-center gap-2 mt-1">
            <DollarSign className="w-5 h-5 text-purple-500" /> Bs. {(totalQRSales || 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-cyan-500 flex flex-col justify-center">
          <p className="text-sm font-medium text-gray-500">Ventas Realizadas</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{filteredSales.length}</p>
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
              {filteredSales.map((sale) => (
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
              {filteredSales.length === 0 && (
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
