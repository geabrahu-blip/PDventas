import React, { useState, useEffect } from 'react';
import { KardexLog } from '../types';
import { getKardexLogs } from '../services/db';
import { useInventory } from '../context/InventoryContext';
import { Activity, ArrowDownRight, ArrowUpRight } from 'lucide-react';

const Kardex = () => {
  const [logs, setLogs] = useState<KardexLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { inventory } = useInventory(); // To map productId to product name

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const fetchedLogs = await getKardexLogs();
        setLogs(fetchedLogs);
      } catch (error) {
        console.error("Error fetching Kardex logs:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const getProductName = (productId: string) => {
    const product = inventory.find(p => p.id === productId);
    return product ? product.name : 'Producto Desconocido';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Activity className="w-6 h-6 text-blue-600" />
          Historial de Movimientos (Kárdex)
        </h1>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Producto</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4 text-center">Cantidad</th>
                <th className="px-6 py-4">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.map((log) => {
                const isEntry = log.quantity >= 0;
                return (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {new Date(log.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {getProductName(log.productId)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        isEntry ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {isEntry ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {isEntry ? 'Entrada' : 'Salida'}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-center font-bold ${
                        isEntry ? 'text-green-600' : 'text-red-600'
                      }`}>
                      {isEntry ? '+' : ''}{log.quantity}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {log.reason || '-'}
                    </td>
                  </tr>
                );
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No hay movimientos registrados en el Kárdex.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Timeline/Feed View */}
      <div className="md:hidden space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
        {logs.map((log) => {
          const isEntry = log.quantity >= 0;
          return (
            <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm ${isEntry ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                {isEntry ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl shadow-sm bg-white border border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-bold text-sm ${isEntry ? 'text-green-600' : 'text-red-600'}`}>
                    {isEntry ? 'ENTRADA' : 'SALIDA'}
                  </span>
                  <time className="text-xs font-medium text-slate-500">
                    {new Date(log.date).toLocaleDateString()} {new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </time>
                </div>
                <div className="text-slate-900 font-semibold text-sm mb-1 leading-tight">
                  {getProductName(log.productId)}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 line-clamp-1 pr-2">{log.reason || 'Sin motivo'}</span>
                  <span className={`font-black shrink-0 ${isEntry ? 'text-green-600' : 'text-red-600'}`}>
                    {isEntry ? '+' : ''}{log.quantity}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {logs.length === 0 && (
          <div className="text-center py-8 text-gray-500 relative z-10 bg-gray-50 rounded-xl">
            No hay registros en el Kárdex todavía.
          </div>
        )}
      </div>
    </div>
  );
};

export default Kardex;
