import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Package, ShoppingBag, Filter, Search, MapPin, X, Plus, Minus } from 'lucide-react';
import { getPublicInventoryItems, getAllPublicInventoryItems, PaginatedResult } from '../services/db';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

const WHATSAPP_NUMBER = "59169236994";
const TABS = ['Todos', 'Varón', 'Mujer', 'Unisex', 'Todo tipo de piel', 'Piel Grasa', 'Piel Seca', 'Piel Mixta', 'Piel Sensible', 'Piel con manchas'];
const MAPS_LINK = "https://maps.app.goo.gl/t2jfDuZRuqwrjD9X8?g_st=aw";

// Cart Item type
interface CartItem {
  product: any;
  quantity: number;
}

const Catalog = () => {
  const [rawProducts, setRawProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Global search
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [allProducts, setAllProducts] = useState<any[]>([]);

  // Server Pagination state
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState('Todos');

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const fetchCatalog = useCallback(async (reset: boolean = false) => {
    try {
      if (reset) {
        setIsLoading(true);
        setRawProducts([]);
        setHasMore(true);
      } else {
        setIsLoadingMore(true);
      }

      const currentLastDoc = reset ? null : lastDoc;
      const result: PaginatedResult = await getPublicInventoryItems(currentLastDoc, activeTab);

      setRawProducts(prev => reset ? result.items : [...prev, ...result.items]);
      setLastDoc(result.lastDoc);
      setHasMore(result.items.length === 12); // if it returns less than limit, there are no more
      setErrorMsg(null);
    } catch (error: any) {
      console.error("Error loading public catalog:", error);
      const errorStr = String(error.message || error);
      if (errorStr.includes("index") || errorStr.includes("https://console.firebase.google.com")) {
         setErrorMsg("Falta un índice en la base de datos para esta búsqueda. " + errorStr);
      } else {
         setErrorMsg(errorStr || "Error al conectar con la base de datos.");
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [activeTab, lastDoc]);

  // Initial load and tab change
  useEffect(() => {
    fetchCatalog(true);
  }, [activeTab]);

  // Lazy load all products for global search only when needed
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);

  const loadAllProducts = async () => {
    if (allProducts.length === 0 && !isGlobalLoading) {
      try {
        setIsGlobalLoading(true);
        const items = await getAllPublicInventoryItems();
        setAllProducts(items);
      } catch (err) {
        console.error("Error loading all items for search:", err);
      } finally {
        setIsGlobalLoading(false);
      }
    }
  };

  useEffect(() => {
    if (isSearching && allProducts.length === 0) {
      loadAllProducts();
    }
  }, [isSearching, allProducts.length]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore && !isSearching) {
      fetchCatalog(false);
    }
  };

  // Dedup logic (name + brand + capacity)
  const dedupedProducts = useMemo(() => {
    // If we haven't finished loading all products yet, fallback to what we have so far
    const source = isSearching && allProducts.length > 0 ? allProducts : rawProducts;
    const filtered = isSearching && searchQuery.trim() !== ''
      ? source.filter(p => p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.brand?.toLowerCase().includes(searchQuery.toLowerCase()))
      : source;

    const seen = new Set();
    const result = [];
    for (const p of filtered) {
      const key = `${p.name}-${p.brand}-${p.capacity}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(p);
      }
    }
    return result;
  }, [rawProducts, allProducts, searchQuery, isSearching]);

  // Handle Search Input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.trim() !== '') {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  };

  // Cart Functions
  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQ = item.quantity + delta;
        return { ...item, quantity: newQ > 0 ? newQ : 1 };
      }
      return item;
    }));
  };

  const cartTotal = cart.reduce((total, item) => {
    const price = item.product.sellingPrice;
    return total + (price || 0) * item.quantity;
  }, 0);

  const handleCheckout = () => {
    if (cart.length === 0) return;

    let message = `¡Hola! Me gustaría hacer un pedido:\n\n`;
    cart.forEach(item => {
      const { product, quantity } = item;
      const price = product.sellingPrice;
      message += `- ${quantity}x ${product.name} ${product.brand ? `(${product.brand})` : ''} - Bs. ${(price || 0).toFixed(2)}\n`;
    });
    message += `\nTotal: Bs. ${cartTotal.toFixed(2)}`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center flex-col gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        <p className="text-gray-500 font-medium">Cargando catálogo...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans relative">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-900 via-[#1a0b2e] to-gray-900 shadow-2xl sticky top-0 z-30 border-b border-[#D4AF37]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img src="/logo.png" alt="Logo" className="h-12 w-12 rounded-full object-cover border-2 border-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.4)]" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400 tracking-tight">
                  Piel Divina
                </h1>
                <p className="text-xs md:text-sm text-[#D4AF37] font-medium tracking-widest uppercase mt-0.5">
                  Catálogo Exclusivo
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar cosméticos..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={loadAllProducts}
                  className="block w-full pl-10 pr-10 py-2 border border-gray-700 rounded-full bg-gray-800 text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent sm:text-sm transition-all"
                />
                {isGlobalLoading && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#D4AF37]"></div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setIsCartOpen(true)}
                className="relative bg-gradient-to-br from-[#D4AF37] to-[#AA8222] p-2.5 rounded-full shadow-[0_0_15px_rgba(212,175,55,0.4)] hover:scale-105 transition-transform"
              >
                <ShoppingBag className="h-5 w-5 text-gray-900" />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                    {cart.reduce((acc, item) => acc + item.quantity, 0)}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Tabs */}
          {!isSearching && (
            <div className="flex gap-2 overflow-x-auto mt-4 pb-2 md:pb-0 scrollbar-hide">
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
                    activeTab === tab
                      ? 'bg-gradient-to-r from-[#D4AF37] to-[#AA8222] text-gray-900 shadow-[0_4px_10px_rgba(212,175,55,0.3)] transform scale-105'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white backdrop-blur-sm border border-white/5'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-opacity-5">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Dónde Encontrarnos */}
          <div className="mb-10 bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden flex flex-col md:flex-row">
             <div className="md:w-1/3 h-48 md:h-auto bg-gray-200 relative">
                <img src="/store.jpeg" alt="Nuestra Tienda" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent flex items-end p-4 md:hidden">
                   <h2 className="text-white font-bold text-lg">Dónde Encontrarnos</h2>
                </div>
             </div>
             <div className="p-6 md:p-8 flex-1 flex flex-col justify-center">
                <h2 className="hidden md:block text-2xl font-bold text-gray-900 mb-2">Dónde Encontrarnos</h2>
                <p className="text-gray-600 mb-4">Visita nuestra tienda física para descubrir estas y muchas más fragancias exclusivas.</p>
                <a
                  href={MAPS_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[#D4AF37] font-semibold hover:text-[#AA8222] transition-colors"
                >
                  <MapPin className="h-5 w-5" />
                  Ver ubicación en Google Maps
                </a>
             </div>
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
              {errorMsg}
            </div>
          )}

          {dedupedProducts.length > 0 ? (
            <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {dedupedProducts.map(product => {
                const displayImage = product.image;
                const displayPrice = product.sellingPrice;
                const displayCapacity = product.capacity;

                return (
                  <div key={product.id} className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden hover:shadow-[0_20px_40px_rgba(107,33,168,0.08)] hover:-translate-y-1 transition-all duration-300 group flex flex-col">
                    {/* Image Container */}
                    <div className="h-64 bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden flex items-center justify-center p-6">
                      {displayImage ? (
                        <img
                          src={displayImage}
                          alt={product.name}
                          loading="lazy"
                          className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-700 drop-shadow-xl"
                        />
                      ) : (
                        <Package className="w-20 h-20 text-gray-200" />
                      )}
                      {product.gender && (
                        <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-md text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full text-[#1a0b2e] shadow-sm border border-gray-100">
                          {product.gender}
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="mb-2">
                        {product.brand && (
                          <p className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest mb-1">
                            {product.brand}
                          </p>
                        )}
                        <h3 className="font-extrabold text-gray-900 text-base leading-tight line-clamp-2">
                          {product.name}
                        </h3>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {displayCapacity && (
                          <span className="bg-gray-50 border border-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-md font-semibold">
                            {displayCapacity}
                          </span>
                        )}
                        {product.categoryType && (
                          <span className="bg-gray-50 border border-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-md font-semibold">
                            {product.categoryType}
                          </span>
                        )}
                      </div>

                      {/* Price and Action */}
                      <div className="mt-auto pt-4 border-t border-gray-50 flex items-end justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Precio</p>
                          <p className="text-xl font-black text-gray-900">
                            Bs. {(displayPrice || 0).toFixed(2)}
                          </p>
                        </div>

                        <button
                          onClick={() => addToCart(product)}
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

            {hasMore && !isSearching && (
              <div className="mt-10 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="bg-white border-2 border-gray-200 text-gray-700 hover:border-[#D4AF37] hover:text-[#D4AF37] font-bold py-2.5 px-6 rounded-full shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoadingMore ? 'Cargando...' : 'Cargar más'}
                </button>
              </div>
            )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl shadow-sm border border-gray-100">
              <Filter className="w-12 h-12 text-gray-300 mb-3" />
              <h2 className="text-lg font-bold text-gray-900 mb-1">No se encontraron productos</h2>
              <p className="text-gray-500 text-sm">Prueba ajustando tu búsqueda o categoría.</p>
            </div>
          )}
        </main>
      </div>

      {/* Cart Sidebar */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setIsCartOpen(false)} />
          <div className="fixed inset-y-0 right-0 max-w-sm w-full flex">
            <div className="w-full h-full bg-white shadow-xl flex flex-col">
              <div className="px-4 py-5 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" />
                  Tu Carrito
                </h2>
                <button onClick={() => setIsCartOpen(false)} className="text-gray-400 hover:text-gray-500">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                    <ShoppingBag className="h-12 w-12 opacity-20" />
                    <p>Tu carrito está vacío</p>
                  </div>
                ) : (
                  <ul className="space-y-4">
                    {cart.map(item => {
                      const displayImage = item.product.image;
                      const displayPrice = item.product.sellingPrice;

                      return (
                        <li key={item.product.id} className="flex gap-4 border-b border-gray-100 pb-4">
                          <div className="h-16 w-16 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {displayImage ? (
                              <img src={displayImage} alt={item.product.name} className="h-full w-full object-contain" />
                            ) : (
                              <Package className="h-8 w-8 text-gray-300" />
                            )}
                          </div>
                          <div className="flex-1 flex flex-col">
                            <h3 className="text-sm font-bold text-gray-900 line-clamp-1">
                              {item.product.name}
                            </h3>
                            <p className="text-xs text-gray-500">{item.product.brand}</p>
                            <div className="flex items-center justify-between mt-auto pt-2">
                              <span className="font-bold text-gray-900">Bs. {(displayPrice || 0).toFixed(2)}</span>
                              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1">
                                <button onClick={() => updateQuantity(item.product.id, -1)} className="text-gray-500 hover:text-gray-700"><Minus className="h-3 w-3" /></button>
                                <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                                <button onClick={() => updateQuantity(item.product.id, 1)} className="text-gray-500 hover:text-gray-700"><Plus className="h-3 w-3" /></button>
                              </div>
                            </div>
                          </div>
                          <button onClick={() => removeFromCart(item.product.id)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="border-t border-gray-200 p-4 bg-gray-50">
                <div className="flex justify-between text-base font-bold text-gray-900 mb-4">
                  <p>Total</p>
                  <p>Bs. {cartTotal.toFixed(2)}</p>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={cart.length === 0}
                  className="w-full bg-[#25D366] hover:bg-[#1DA851] text-white flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                  </svg>
                  Pedir por WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Catalog;
