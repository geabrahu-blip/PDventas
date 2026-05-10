import { useState, useEffect } from 'react';
import { Sale, Store } from '../types';
import { getSales, getStores, deleteSale } from '../services/db';
import { FileText, Calendar, Filter, DollarSign, Trash2, Printer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ReceiptModal from '../components/ReceiptModal';

const SalesReport = () => {
  const { isAdmin } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);

  // Receipt state
  const [selectedReceipt, setSelectedReceipt] = useState<Sale | null>(null);

  // Filters
  const [filterStore, setFilterStore] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [sales, filterStore, filterDate]);

  const loadData = async () => {
    const [salesData, storesData] = await Promise.all([getSales(), getStores()]);
    setSales(salesData);
    setStores(storesData);
  };

  const applyFilters = () => {
    let result = sales;

    if (filterStore !== 'all') {
      result = result.filter(sale => sale.storeId === filterStore);
    }

    if (filterDate) {
      result = result.filter(sale => sale.date.startsWith(filterDate));
    }

    setFilteredSales(result);
  };

  const getStoreName = (storeId: string) => {
    if (storeId === 'bodega') return 'Bodega Central';
    const store = stores.find(s => s.id === storeId);
    return store ? store.name : 'Desconocida';
  };

  const handleDelete = async (saleId: string) => {
    if (confirm('¿Estás seguro de eliminar esta venta? Se regresará el stock a la sucursal correspondiente.')) {
      await deleteSale(saleId);
      loadData();
    }
  };

  const totalSalesAmount = filteredSales.reduce((sum, sale) => sum + sale.total, 0);

  return (
    <div className="space-y-6">
      {/* Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm print:bg-white print:p-0 print:backdrop-blur-none">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden print:shadow-none print:w-full print:max-w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center print:hidden">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Printer className="w-5 h-5 text-teal-600" />
                Comprobante de Venta
              </h2>
              <button onClick={() => setSelectedReceipt(null)} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>

            <div className="p-6 text-sm text-gray-800" id="printable-receipt">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold uppercase mb-1">Piel Divina</h3>
                <p className="text-xs text-gray-500 uppercase">{getStoreName(selectedReceipt.storeId)}</p>
                <div className="border-b border-dashed border-gray-400 my-4"></div>
                <h4 className="font-bold uppercase tracking-wider mb-2">Comprobante de Venta</h4>
              </div>

              <div className="mb-4 space-y-1">
                <div className="flex justify-between">
                  <span className="font-semibold">Fecha:</span>
                  <span>{new Date(selectedReceipt.date).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Cliente:</span>
                  <span className="uppercase">{selectedReceipt.clientName || 'Cliente Genérico'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Atendido por:</span>
                  <span className="uppercase">Vendedor</span>
                </div>
              </div>

              <div className="border-b border-dashed border-gray-400 my-4"></div>

              <table className="w-full text-left mb-4">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="py-2 font-semibold w-12">Cant.</th>
                    <th className="py-2 font-semibold">Descripción</th>
                    <th className="py-2 font-semibold text-right">P. Unit</th>
                    <th className="py-2 font-semibold text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedReceipt.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 align-top">{item.quantity}</td>
                      <td className="py-2 align-top pr-2">{item.name}</td>
                      <td className="py-2 align-top text-right whitespace-nowrap">{(item.price || 0).toFixed(2)}</td>
                      <td className="py-2 align-top text-right whitespace-nowrap">{(item.quantity * (item.price || 0)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-b border-dashed border-gray-400 my-4"></div>

              <div className="flex justify-between items-center font-bold text-lg">
                <span>TOTAL A PAGAR:</span>
                <span>Bs. {(selectedReceipt.total || 0).toFixed(2)}</span>
              </div>

              <div className="mt-2 text-right text-xs text-gray-600">
                Método de pago: <span className="uppercase font-semibold">{selectedReceipt.paymentMethod}</span>
              </div>

              <div className="mt-8 text-center text-xs text-gray-500 uppercase">
                <p>¡Gracias por su compra!</p>
                <p>Vuelva pronto</p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 print:hidden">
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-teal-600" />
          Reporte de Ventas
        </h1>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <Filter className="w-4 h-4" /> Sucursal
          </label>
          <select
            value={filterStore}
            onChange={(e) => setFilterStore(e.target.value)}
            className="border-gray-300 rounded-md shadow-sm focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="all">Todas las sucursales</option>
            {stores.map(store => (
              <option key={store.id} value={store.id}>{store.name}</option>
            ))}
          </select>
        </div>

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
          onClick={() => { setFilterStore('all'); setFilterDate(''); }}
          className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md"
        >
          Limpiar Filtros
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-teal-500">
          <p className="text-sm font-medium text-gray-500">Total Ingresos (Filtro Actual)</p>
          <p className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-500" /> Bs. {(totalSalesAmount || 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-sm font-medium text-gray-500">Ventas Realizadas</p>
          <p className="text-2xl font-bold text-gray-900">{filteredSales.length}</p>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Fecha y Hora</th>
                <th className="px-6 py-4">Sucursal</th>
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
                    {getStoreName(sale.storeId)}
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
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      sale.paymentMethod === 'QR' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {sale.paymentMethod}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-teal-600">
                    Bs. {(sale.total || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setSelectedReceipt(sale)}
                        className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                        title="Imprimir / Ver Recibo"
                      >
                        <Printer className="w-5 h-5" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(sale.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Eliminar venta y devolver stock"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
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
