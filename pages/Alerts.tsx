import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, PackageX, Package, Loader2, Calendar, TrendingUp } from "lucide-react";
import { getPaginatedInventoryItems, getSalesSummaryByDate, DailySalesSummary } from "../services/db";
import { InventoryItem } from "../types";
import { getYesterdayDateString, getLocalDateString } from "../utils/dateUtils";
import { useAuth } from "../context/AuthContext";
import { useInventory } from "../context/InventoryContext";
import { useToast } from "../context/ToastContext";

export default function Alerts() {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();
  const { inventory } = useInventory(); // Using context for simple search

  const [loading, setLoading] = useState(true);
  const [outOfStock, setOutOfStock] = useState<InventoryItem[]>([]);

  // Paginación
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = React.useRef<any>(null);

  const fetchAlerts = useCallback(async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        lastDocRef.current = null;
      } else {
        setIsLoadingMore(true);
      }

      const currentLastDoc = reset ? null : lastDocRef.current;
      const response = await getPaginatedInventoryItems(currentLastDoc, 20);
      const products = response?.items || [];

      const newOutOfStock = products.filter((item) => item.units === 0);

      setOutOfStock(prev => reset ? newOutOfStock : [...(prev || []), ...newOutOfStock]);

      lastDocRef.current = response.lastDoc;
      setHasMore(products.length === 20);
    } catch (error) {
      console.error("Error fetching alerts data:", error);
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  const fetchSuggestions = useCallback(async (dateStr: string) => {
    try {
      setLoadingSuggestions(true);
      const suggestions = await getSalesSummaryByDate(dateStr);

      // Enrich with inventory details from context to avoid extra db reads
      const enrichedSuggestions = suggestions.map(item => {
        const invItem = inventory.find(p => p.id === item.productId || p.productId === item.productId);
        if (invItem) {
          let currentStock: number | string = invItem.units;
          if (item.variationType === '5ml') currentStock = invItem.decants5ml || 0;
          if (item.variationType === '10ml') currentStock = invItem.decants10ml || 0;
          if (item.variationType === '30ml') currentStock = invItem.decants30ml || 0;
          if (item.variationType === 'opened') currentStock = `${invItem.openedBottleMl || 0}ml`;

          return {
            ...item,
            brand: invItem.brand,
            capacity: invItem.capacity,
            image: invItem.image,
            currentStock
          };
        }
        return item;
      });

      setSalesSuggestions(enrichedSuggestions);
    } catch (error) {
      console.error("Error fetching sales suggestions:", error);
      showToast("Error al cargar sugerencias de reposición", "error");
    } finally {
      setLoadingSuggestions(false);
    }
  }, [showToast, inventory]);

  useEffect(() => {
    fetchAlerts(true);
  }, [fetchAlerts]);

  useEffect(() => {
    fetchSuggestions(suggestionsDate);
  }, [fetchSuggestions, suggestionsDate]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchAlerts(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* SECCIÓN ALERTAS DE STOCK */}
      <section className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            Alertas de Stock
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Monitorea los productos agotados y con bajo inventario.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Productos Agotados */}
          <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden flex flex-col">
            <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-2 shrink-0">
              <PackageX className="w-5 h-5 text-red-600" />
              <h2 className="font-semibold text-red-800">Productos Agotados</h2>
              <span className="ml-auto bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded-full">
                {outOfStock.length}
              </span>
            </div>

            <div className="p-4 flex-1 overflow-y-auto max-h-[300px] md:max-h-[400px]">
              {outOfStock.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No hay productos agotados. ¡Excelente!
                </p>
              ) : (
                <ul className="space-y-3">
                  {outOfStock.map((product) => (
                    <li
                      key={product.id}
                      className="flex items-center gap-3 p-3 bg-red-50/50 rounded-xl border border-red-50"
                    >
                      <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden relative border border-red-200">
                        {product.image ? (
                          <>
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-red-900/10"></div>
                          </>
                        ) : (
                          <Package className="w-6 h-6 text-red-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 line-clamp-1">
                          {product.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {product.brand} - {product.capacity}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

                  </div>

        {/* Botón Cargar Más Manual */}
        {hasMore && (
          <div className="flex justify-center mt-6">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="flex items-center gap-2 px-6 py-2 bg-teal-50 text-teal-600 border border-teal-100 rounded-md hover:bg-teal-100 transition-colors font-medium disabled:opacity-50"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Cargando alertas...
                </>
              ) : (
                'Cargar más productos'
              )}
            </button>
          </div>
        )}
      </section>

      <hr className="border-slate-200" />

      {/* SECCIÓN SUGERENCIAS (VENDIDOS AYER) */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-indigo-500" />
              Sugerencias de Reposición
            </h2>
            <p className="text-slate-600 text-sm mt-1">
              Sugerencias basadas en las ventas de la fecha seleccionada.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-500" />
            <input
              type="date"
              value={suggestionsDate}
              max={getLocalDateString()}
              onChange={(e) => setSuggestionsDate(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-indigo-50/50">
            <h3 className="font-semibold text-indigo-900 flex items-center gap-2">
              Vendidos el {new Date(suggestionsDate + 'T00:00:00').toLocaleDateString()}
              <span className="bg-indigo-200 text-indigo-800 text-xs font-bold px-2 py-1 rounded-full">
                {salesSuggestions.length}
              </span>
            </h3>
          </div>

          <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
            {loadingSuggestions ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : salesSuggestions.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-600 font-medium">No hay ventas registradas este día.</p>
                <p className="text-slate-500 text-sm mt-1">No hay sugerencias de reposición.</p>
              </div>
            ) : (
              salesSuggestions.map((item) => (
                <div key={`${item.productId}-${item.variationType}`} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                  <div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-slate-200">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-6 h-6 text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 break-words">
                      {item.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                      {item.brand && <span>{item.brand}</span>}
                      {item.brand && item.capacity && <span>•</span>}
                      {item.capacity && <span>{item.capacity}</span>}
                      {item.variationType && item.variationType !== 'sealed' && (
                         <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-medium ml-1 border border-slate-200">
                           {item.variationType === 'opened' ? 'Abierto' : item.variationType}
                         </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-4 shrink-0">
                    <div className="text-center">
                      <div className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wide">Stock Actual</div>
                      <div className="inline-flex items-center justify-center min-w-[3rem] px-2 py-1 bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200">
                        {item.currentStock !== undefined ? item.currentStock : '-'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-indigo-500 font-bold mb-1 uppercase tracking-wide">Sugerido</div>
                      <div className="inline-flex items-center justify-center min-w-[3rem] px-2 py-1 bg-indigo-100 text-indigo-800 font-bold rounded-lg border border-indigo-200">
                        +{item.quantitySold}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <hr className="border-slate-200" />

          </div>
  );
}
