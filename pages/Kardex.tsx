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

      <div className="bg-white rounded-lg shadow overflow-hidden">
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
    </div>
  );
};

export default Kardex;
