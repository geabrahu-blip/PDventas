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
            className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
          >
            Ver todos
          </button>
        )}
      </div>

      <div
        ref={carouselRef}
        className="flex overflow-x-auto gap-3 md:gap-4 snap-x pb-4 scrollbar-hide hide-scrollbar px-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onTouchStart={handleInteraction}
        onMouseDown={handleInteraction}
      >
        {products.map(product => {
          const displayImage = product.image;
          const displayPrice = product.sellingPrice;
          const displayCapacity = product.capacity;

          return (
            <div key={product.id} className="w-[42vw] sm:w-[220px] md:w-[28vw] flex-shrink-0 snap-start bg-white rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden hover:shadow-[0_10px_30px_rgba(20,184,166,0.1)] transition-all duration-300 group flex flex-col">
              {/* Image Container */}
              <div className="h-36 sm:h-48 bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden flex items-center justify-center p-4 cursor-pointer" onClick={() => onAddToCart(product)}>
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
                  <span className="absolute top-2 left-2 bg-white/90 backdrop-blur-md text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-primary-900 shadow-sm border border-gray-100">
                    {product.gender}
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="p-3 sm:p-4 flex-1 flex flex-col cursor-pointer" onClick={() => onAddToCart(product)}>
                <div className="mb-2">
                  {product.brand && (
                    <p className="text-[8px] sm:text-[9px] font-bold text-primary-600 uppercase tracking-widest mb-1 line-clamp-1">
                      {product.brand}
                    </p>
                  )}
                  <h3 className="font-bold text-gray-900 text-xs sm:text-sm leading-tight line-clamp-2">
                    {product.name}
                  </h3>
                </div>

                <div className="flex flex-wrap gap-1 mb-2">
                  {displayCapacity && (
                    <span className="bg-gray-50 border border-gray-100 text-gray-600 text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-md font-semibold">
                      {displayCapacity}
                    </span>
                  )}
                  {product.categoryType && (
                    <span className="bg-gray-50 border border-gray-100 text-gray-600 text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-md font-semibold">
                      {product.categoryType}
                    </span>
                  )}
                </div>

                {/* Price and Action */}
                <div className="mt-auto pt-3 border-t border-gray-50 flex items-end justify-between">
                  <div>
                    <p className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Precio</p>
                    <p className="text-sm sm:text-base font-black text-gray-900">
                      Bs. {(displayPrice || 0).toFixed(2)}
                    </p>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToCart(product);
                    }}
                    className="bg-primary-600 text-white px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold hover:bg-primary-700 transition-colors shadow-sm whitespace-nowrap"
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
