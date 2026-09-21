import React, { useState } from 'react';
import { InventoryItem } from '../../types';
import { X, ShoppingBag, Droplet, DollarSign } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface VariationModalProps {
  product: InventoryItem;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (
    product: InventoryItem,
    variationType: 'sealed' | '5ml' | '10ml' | '30ml' | 'opened',
    variationPrice: number
  ) => void;
}

export default function VariationModal({ product, isOpen, onClose, onAddToCart }: VariationModalProps) {
  const { showToast } = useToast();
  const [openedPrice, setOpenedPrice] = useState<number | ''>('');

  if (!isOpen) return null;

  const handleOpenedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (openedPrice === '') {
      showToast('Ingresa un precio válido para el remate', 'error');
      return;
    }
    onAddToCart(product, 'opened', Number(openedPrice));
  };

  const handleSelect = (type: 'sealed' | '5ml' | '10ml' | '30ml', price: number) => {
    onAddToCart(product, type, price);
  };

  const hasDecants = product.hasDecants;
  const hasOpenedBottle = (product.openedBottleMl || 0) > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900 line-clamp-1">{product.name}</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <p className="text-sm text-gray-600 mb-2">Selecciona qué variante deseas vender:</p>

          {/* Sell Sealed Bottle */}
          <button
            onClick={() => handleSelect('sealed', product.sellingPrice)}
            disabled={product.units < 1}
            className={`w-full flex items-center justify-between p-4 rounded-xl border ${product.units > 0 ? 'border-teal-200 bg-teal-50 hover:bg-teal-100' : 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${product.units > 0 ? 'bg-teal-100 text-teal-600' : 'bg-gray-200 text-gray-500'}`}>
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="block font-bold text-gray-900">Frasco Sellado Completo</span>
                <span className="text-xs text-gray-500">Stock: {product.units} unidades</span>
              </div>
            </div>
            <div className="font-bold text-teal-700">Bs. {product.sellingPrice}</div>
          </button>

          {/* Sell Decants */}
          {hasDecants && (
            <div className="space-y-2 mt-4 pt-4 border-t border-gray-100">
              <h3 className="font-medium text-gray-800 flex items-center gap-2">
                <Droplet className="w-4 h-4 text-purple-500" /> Venta de Decants
              </h3>

              {['5ml', '10ml', '30ml'].map((size) => {
                let stock = 0;
                let price = 0;
                if (size === '5ml') {
                  stock = product.decants5ml || 0;
                  price = product.decant5mlPrice || 0;
                } else if (size === '10ml') {
                  stock = product.decants10ml || 0;
                  price = product.decant10mlPrice || 0;
                } else if (size === '30ml') {
                  stock = product.decants30ml || 0;
                  price = product.decant30mlPrice || 0;
                }

                if (price === 0) return null;
                const outOfStock = stock < 1;

                return (
                  <button
                    key={size}
                    onClick={() => handleSelect(size as any, price)}
                    disabled={outOfStock}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border ${!outOfStock ? 'border-purple-200 bg-purple-50 hover:bg-purple-100' : 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'}`}
                  >
                    <div className="text-left pl-2">
                      <span className="block font-bold text-gray-900">Decant {size}</span>
                      <span className="text-xs text-gray-500">Stock: {stock} listos</span>
                    </div>
                    <div className="font-bold text-purple-700">Bs. {price}</div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Remate / Opened Bottle */}
          {hasOpenedBottle && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h3 className="font-medium text-gray-800 text-orange-600 flex items-center gap-2 mb-2">
                Remate (Frasco Abierto)
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Contiene {product.openedBottleMl}ml. Ingrese el precio manual de remate para vender todo el saldo restante.
              </p>
              <form onSubmit={handleOpenedSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">Bs.</span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={openedPrice}
                    onChange={(e) => setOpenedPrice(e.target.value ? Number(e.target.value) : '')}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500"
                    placeholder="Precio"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  Rematar
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}