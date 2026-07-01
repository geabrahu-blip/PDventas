import React, { useState, useEffect, useCallback } from 'react';
import { KardexLog } from '../types';
import { getKardexLogs, getPaginatedInventoryItems } from '../services/db';
import { Activity, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

const Kardex = () => {
  const [logs, setLogs] = useState<KardexLog[]>([]);
  const [inventoryMap, setInventoryMap] = useState<Record<string, string>>({});
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  // Date filtering state
  const [filterType, setFilterType] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const getDateRange = useCallback((type: string, start?: string, end?: string): { startDate?: number, endDate?: number } => {
    const now = new Date();

    if (type === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return { startDate: startOfDay, endDate: undefined }; // End date is now, effectively
    }

    if (type === 'yesterday') {
      const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
      const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - 1;
      return { startDate: startOfYesterday, endDate: endOfYesterday };
    }

    if (type === 'week') {
      const firstDayOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).setHours(0,0,0,0);
      return { startDate: firstDayOfWeek, endDate: undefined };
    }

    if (type === 'month') {
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return { startDate: firstDayOfMonth, endDate: undefined };
    }

    if (type === 'custom' && start && end) {
      const customStart = new Date(start).getTime();
      const customEnd = new Date(end).setHours(23,59,59,999);
      return { startDate: customStart, endDate: customEnd };
    }

    return { startDate: undefined, endDate: undefined }; // 'all' or fallback
  }, []);

  const fetchLogs = useCallback(async (isInitial: boolean = false, type = filterType, cStart = customStartDate, cEnd = customEndDate) => {
    if (isInitial) setIsLoading(true);
    else setIsFetchingMore(true);

    try {
      const { startDate, endDate } = getDateRange(type, cStart, cEnd);

      const currentLastDoc = isInitial ? null : lastDoc;

      const [logsResponse, inventoryResponse] = await Promise.all([
        getKardexLogs(currentLastDoc, 50, startDate, endDate),
        // Solo obtener inventario si es la carga inicial (no en el botón 'cargar más')
        isInitial ? getPaginatedInventoryItems(null, 500) : Promise.resolve(null)
      ]);

      if (inventoryResponse) {
        const map: Record<string, string> = {};
        inventoryResponse.items.forEach(item => {
          map[item.id] = item.name;
        });
        setInventoryMap(map);
      }

      setLogs(prev => {
        if (isInitial) return logsResponse.items;

        const existingIds = new Set(prev.map(l => l.id));
        const newLogs = logsResponse.items.filter(log => !existingIds.has(log.id));
        return [...prev, ...newLogs];
      });

      setLastDoc(logsResponse.lastDoc);
      setHasMore(logsResponse.lastDoc !== null);
    } catch (error) {
      console.error("Error fetching Kardex logs:", error);
    } finally {
      setIsLoading(false);
      setIsFetchingMore(false);
    }
  }, [filterType, customStartDate, customEndDate, lastDoc, getDateRange]);

  useEffect(() => {
    // Cuando el componente monta o cambia el filtro, hacemos carga inicial
    // Se usa un timer mínimo para evitar llamadas asíncronas bloqueantes dentro del render cycle (TDZ/cascade renders)
    const timer = setTimeout(() => {
      fetchLogs(true);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  // Trigger para filtro personalizado cuando el usuario cambia fechas de inicio/fin
  useEffect(() => {
    if (filterType === 'custom' && customStartDate && customEndDate) {
      const timer = setTimeout(() => {
        fetchLogs(true);
      }, 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customStartDate, customEndDate]);

  const loadMoreLogs = () => {
    fetchLogs(false);
  };

  const getProductName = (productId: string) => {
    return inventoryMap[productId] || 'Producto Desconocido';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Activity className="w-6 h-6 text-blue-600" />
          Historial de Movimientos (Kárdex)
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="border-gray-300 rounded-md shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="today">Hoy</option>
            <option value="yesterday">Ayer</option>
            <option value="week">Esta Semana</option>
            <option value="month">Este Mes</option>
            <option value="all">Todo el Historial</option>
            <option value="custom">Personalizado...</option>
          </select>

          {filterType === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="border-gray-300 rounded-md shadow-sm text-sm"
              />
              <span className="text-gray-500 text-sm">a</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="border-gray-300 rounded-md shadow-sm text-sm"
              />
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>

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
                    No hay movimientos registrados en el Kárdex en este periodo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {hasMore && (
            <div className="p-4 border-t border-gray-200 flex justify-center bg-gray-50">
              <button
                onClick={loadMoreLogs}
                disabled={isFetchingMore}
                className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {isFetchingMore ? 'Cargando...' : 'Cargar más movimientos'}
              </button>
            </div>
          )}
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
            No hay registros en el Kárdex en este periodo.
          </div>
        )}
        {hasMore && logs.length > 0 && (
          <div className="flex justify-center pt-4 pb-8 relative z-10">
            <button
              onClick={loadMoreLogs}
              disabled={isFetchingMore}
              className="px-6 py-2.5 bg-white shadow-sm border border-slate-200 rounded-full text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-colors"
            >
              {isFetchingMore ? 'Cargando...' : 'Cargar más registros'}
            </button>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
};

export default Kardex;
