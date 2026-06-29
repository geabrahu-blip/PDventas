import React, { useState, useEffect } from 'react';
import { AlertTriangle, PackageX, PackageMinus, Package } from "lucide-react";
import { getInventoryItems } from "../services/db";
import { InventoryItem } from "../types";

export default function Alerts() {
  const [loading, setLoading] = useState(true);
  const [outOfStock, setOutOfStock] = useState<InventoryItem[]>([]);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const items = await getInventoryItems();
        // Safe check
        const products = items || [];
        setOutOfStock(products.filter((item) => item.units === 0));
        setLowStock(products.filter((item) => item.units > 0 && item.units <= 2));
      } catch (error) {
        console.error("Error fetching alerts data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-orange-500" />
          Alertas de Stock
        </h1>
        <p className="text-slate-600 text-sm mt-1">
          Monitorea los productos agotados y con bajo inventario.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Productos Agotados */}
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden flex flex-col">
          <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-2 shrink-0">
            <PackageX className="w-5 h-5 text-red-600" />
            <h2 className="font-semibold text-red-800">Productos Agotados</h2>
            <span className="ml-auto bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded-full">
              {outOfStock.length}
            </span>
          </div>

          <div className="p-4 flex-1 overflow-y-auto max-h-[500px]">
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

        {/* Productos con Poco Stock */}
        <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden flex flex-col">
          <div className="bg-orange-50 p-4 border-b border-orange-100 flex items-center gap-2 shrink-0">
            <PackageMinus className="w-5 h-5 text-orange-600" />
            <h2 className="font-semibold text-orange-800">
              Poco Stock (1 o 2 unid.)
            </h2>
            <span className="ml-auto bg-orange-100 text-orange-800 text-xs font-bold px-2 py-1 rounded-full">
              {lowStock.length}
            </span>
          </div>

          <div className="p-4 flex-1 overflow-y-auto max-h-[500px]">
            {lowStock.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                No hay productos con poco stock.
              </p>
            ) : (
              <ul className="space-y-3">
                {lowStock.map((product) => (
                  <li
                    key={product.id}
                    className="flex items-center justify-between gap-3 p-3 bg-orange-50/50 rounded-xl border border-orange-50"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden relative border border-orange-200">
                        {product.image ? (
                          <>
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-orange-900/10"></div>
                          </>
                        ) : (
                          <Package className="w-6 h-6 text-orange-400" />
                        )}
                        <div className="absolute -bottom-1 -right-1 bg-orange-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border border-white">
                          {product.units}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 line-clamp-1">
                          {product.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {product.brand} - {product.capacity}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
