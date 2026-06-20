import { useInventory } from '../context/InventoryContext';
import { AlertTriangle, PackageX, PackageMinus } from 'lucide-react';

export default function Alerts() {
  const { inventory: items, isLoading: loading } = useInventory();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  // Safe check
  const products = items || [];
  const outOfStock = products.filter(item => item.units === 0);
  const lowStock = products.filter(item => item.units > 0 && item.units <= 2);

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
                {outOfStock.map(product => (
                  <li key={product.id} className="flex items-center gap-3 p-3 bg-red-50/50 rounded-xl border border-red-50">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                      <PackageX className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800 line-clamp-1">{product.name}</p>
                      <p className="text-xs text-slate-500">{product.brand} - {product.capacity}</p>
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
            <h2 className="font-semibold text-orange-800">Poco Stock (1 o 2 unid.)</h2>
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
                {lowStock.map(product => (
                  <li key={product.id} className="flex items-center justify-between gap-3 p-3 bg-orange-50/50 rounded-xl border border-orange-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                        <span className="font-bold text-orange-600">{product.units}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800 line-clamp-1">{product.name}</p>
                        <p className="text-xs text-slate-500">{product.brand} - {product.capacity}</p>
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