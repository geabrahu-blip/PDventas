import React, { useRef, useEffect, useState } from 'react';
import { Package } from 'lucide-react';

interface ProductCarouselProps {
  title: string;
  products: any[];
  onViewAll?: () => void;
  onAddToCart: (product: any) => void;
}

export default function ProductCarousel({ title, products, onViewAll, onAddToCart }: ProductCarouselProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);

  useEffect(() => {
    if (!isAutoScrolling || !carouselRef.current || !products || products.length === 0) return;

    const intervalId = setInterval(() => {
      const carousel = carouselRef.current;
      if (!carousel) return;
      const firstChild = carousel.children[0] as HTMLElement;
      if (!firstChild) return;

      const itemWidth = firstChild.offsetWidth + 16; // 16px is approx gap

      if (carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 10) {
        carousel.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        carousel.scrollBy({ left: itemWidth, behavior: 'smooth' });
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [isAutoScrolling, products]);

  const handleInteraction = () => {
    setIsAutoScrolling(false);
  };

  if (!products || products.length === 0) return null;

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">{title}</h2>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm font-semibold text-[#D4AF37] hover:text-[#AA8222] transition-colors"
          >
            Ver todos
          </button>
        )}
      </div>

      <div
        ref={carouselRef}
        className="flex overflow-x-auto gap-4 md:gap-6 snap-x pb-4 scrollbar-hide hide-scrollbar px-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onTouchStart={handleInteraction}
        onMouseDown={handleInteraction}
      >
        {products.map(product => {
          const displayImage = product.image;
          const displayPrice = product.sellingPrice;
          const displayCapacity = product.capacity;

          return (
            <div key={product.id} className="w-[75vw] sm:w-[280px] flex-shrink-0 snap-start bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden hover:shadow-[0_20px_40px_rgba(107,33,168,0.08)] transition-all duration-300 group flex flex-col">
              {/* Image Container */}
              <div className="h-48 sm:h-64 bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden flex items-center justify-center p-6 cursor-pointer" onClick={() => onAddToCart(product)}>
                {displayImage ? (
                  <img
                    src={displayImage}
                    alt={product.name}
                    loading="lazy"
                    className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-700 drop-shadow-xl"
                  />
                ) : (
                  <Package className="w-16 h-16 sm:w-20 sm:h-20 text-gray-200" />
                )}
                {product.gender && (
                  <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-md text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full text-[#1a0b2e] shadow-sm border border-gray-100">
                    {product.gender}
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="p-4 sm:p-5 flex-1 flex flex-col cursor-pointer" onClick={() => onAddToCart(product)}>
                <div className="mb-2">
                  {product.brand && (
                    <p className="text-[9px] sm:text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest mb-1">
                      {product.brand}
                    </p>
                  )}
                  <h3 className="font-extrabold text-gray-900 text-sm sm:text-base leading-tight line-clamp-2">
                    {product.name}
                  </h3>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {displayCapacity && (
                    <span className="bg-gray-50 border border-gray-100 text-gray-600 text-[9px] sm:text-[10px] px-2 py-0.5 rounded-md font-semibold">
                      {displayCapacity}
                    </span>
                  )}
                  {product.categoryType && (
                    <span className="bg-gray-50 border border-gray-100 text-gray-600 text-[9px] sm:text-[10px] px-2 py-0.5 rounded-md font-semibold">
                      {product.categoryType}
                    </span>
                  )}
                </div>

                {/* Price and Action */}
                <div className="mt-auto pt-4 border-t border-gray-50 flex items-end justify-between">
                  <div>
                    <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Precio</p>
                    <p className="text-lg sm:text-xl font-black text-gray-900">
                      Bs. {(displayPrice || 0).toFixed(2)}
                    </p>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToCart(product);
                    }}
                    className="bg-gray-900 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-[#D4AF37] transition-colors shadow-sm"
                  >
                    Añadir
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
      `}</style>
    </div>
  );
}
