import React, { memo } from 'react';
import { Package } from 'lucide-react';
import { InventoryItem } from '../types';

interface ProductCardProps {
  product: InventoryItem;
  cartQuantity: number;
  onAddToCart: (product: InventoryItem) => void;
}

export const ProductCard = memo(({ product, cartQuantity, onAddToCart }: ProductCardProps) => {
  const availableStock = product.units - cartQuantity;
  const isOutOfStockForCart = availableStock <= 0;
  const isLowStock = product.units > 0 && product.units <= 2;

  return (
    <div
      onClick={() => !isOutOfStockForCart && onAddToCart(product)}
      className={`h-full w-full bg-white border rounded-2xl overflow-hidden transition-all duration-300 flex flex-col cursor-pointer group
        ${isOutOfStockForCart ? 'opacity-60 grayscale border-slate-200' : 'border-slate-100 hover:border-cyan-200 hover:shadow-md'}
      `}
    >
      <div className="aspect-square bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
         {product.image ? (
            <img loading="lazy" src={product.image} alt={product.name} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-100/50 rounded-xl">
              <Package className="w-8 h-8 text-cyan-300/50" />
            </div>
          )}
          {/* Stock Badge */}
          <div className={`absolute top-3 right-3 text-[10px] font-semibold px-2.5 py-1 rounded-full shadow-sm backdrop-blur-sm border
            ${isOutOfStockForCart ? 'bg-red-50/90 text-red-600 border-red-100' : isLowStock
              ? 'bg-orange-50/90 text-orange-600 border-orange-100'
              : 'bg-white/90 text-slate-600 border-slate-200'}
          `}>
            {product.units} {product.units === 1 ? 'ud' : 'uds'}
          </div>
      </div>
      <div className="p-4 flex flex-col flex-1 border-t border-slate-50/50">
        <h3 className="text-sm font-medium text-slate-800 leading-snug line-clamp-2 mb-1.5 group-hover:text-cyan-600 transition-colors" title={product.name}>
          {product.name}
        </h3>

        <div className="flex flex-col gap-1.5 mb-3 mt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {product.category && (
              <span className="bg-slate-100 text-slate-600 text-[11px] font-medium px-2 py-0.5 rounded-md truncate max-w-[100px]">
                {product.category}
              </span>
            )}
            {product.capacity && (
              <span className="bg-slate-100 text-slate-600 text-[11px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap">
                {product.capacity}
              </span>
            )}
          </div>
          {product.gender && (
            <div className="flex">
              <span className="bg-cyan-50 text-cyan-700 text-[11px] font-medium px-2 py-0.5 rounded-md border border-cyan-100 truncate max-w-full">
                {product.gender}
              </span>
            </div>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between">
          <span className="text-base font-semibold text-slate-900">Bs. {product.sellingPrice}</span>
        </div>
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';
