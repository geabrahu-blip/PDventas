import React, { useState, useMemo, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../context/ToastContext';
import { processPOSSale } from '../services/db';
import { InventoryItem } from '../types';
import { Search, ShoppingCart, Plus, Minus, CreditCard, Banknote, Package, Sparkles, Trash2 } from 'lucide-react';
import Receipt, { ReceiptData } from '../components/Receipt';

interface CartItem {
  product: InventoryItem;
  quantity: number;
}

const POS = () => {
  const { inventory, refreshInventory } = useInventory();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clientName, setClientName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'QR'>('Cash');
  const [globalDiscount, setGlobalDiscount] = useState<number | ''>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSaleData, setLastSaleData] = useState<ReceiptData | null>(null);
  const [activeTab, setActiveTab] = useState<'catalog' | 'cart'>('catalog');

  useEffect(() => {
    const handleAfterPrint = () => {
      // Clear the receipt data to hide it and prepare for next sale
      setLastSaleData(null);
    };

    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);


  // Filter products for the catalog
  const filteredProducts = useMemo(() => {
    if (!inventory) return [];
    const searchLower = searchTerm.toLowerCase();
    return inventory.filter(p =>
      p.units > 0 && // Only show products with stock
      (p.name.toLowerCase().includes(searchLower) ||
       (p.barcode && p.barcode.toLowerCase().includes(searchLower)) ||
       (p.brand && p.brand.toLowerCase().includes(searchLower)))
    );
  }, [inventory, searchTerm]);

  // Derived calculations
  const totalItems = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.product.sellingPrice * item.quantity), 0);
  }, [cart]);

  const total = useMemo(() => {
    const discountAmount = Number(globalDiscount) || 0;
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, globalDiscount]);

  // Cart operations
  const addToCart = (product: InventoryItem) => {
    setCart(prevCart => {
      const existing = prevCart.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.units) {
          showToast('No hay suficiente stock disponible', 'error');
          return prevCart;
        }
        showToast('Producto sumado al carrito', 'success');
        return prevCart.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      showToast('Producto agregado al carrito', 'success');
      return [...prevCart, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.product.id === productId) {
          const newQuantity = item.quantity + delta;
          if (newQuantity > 0 && newQuantity <= item.product.units) {
            return { ...item, quantity: newQuantity };
          }
          if (newQuantity > item.product.units) {
             showToast('Límite de stock alcanzado', 'error');
          }
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId));
  };

  const handleProcessSale = async () => {
    if (cart.length === 0) {
      showToast('El carrito está vacío', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const saleItems = cart.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.sellingPrice,
        subtotal: item.product.sellingPrice * item.quantity
      }));

      await processPOSSale(
        clientName.trim(), // Empty string is handled in the DB layer (defaults to 'Cliente Ocasional')
        saleItems,
        subtotal,
        total,
        Number(globalDiscount) || 0,
        paymentMethod
      );

      showToast('Venta procesada exitosamente', 'success');

      // Save data for the receipt
      setLastSaleData({
        items: cart.map(item => ({
          product: item.product,
          quantity: item.quantity,
          subtotal: item.product.sellingPrice * item.quantity
        })),
        subtotal,
        total,
        globalDiscount: Number(globalDiscount) || 0,
        clientName,
        paymentMethod,
        date: new Date()
      });

      // Delay de sincronización para la tiquetera:
      setTimeout(() => {
        window.print();
      }, 300);

      // Reset POS state
      setCart([]);
      setClientName('');
      setGlobalDiscount('');
      setPaymentMethod('Cash');
      setSearchTerm('');

      // Refresh global inventory to reflect new stock
      await refreshInventory();

    } catch (error: any) {
      console.error("Error processing sale:", error);
      showToast(error.message || 'Error al procesar la venta', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Receipt data={lastSaleData} />

      <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4 lg:gap-6 bg-slate-50 lg:p-2">

      {/* Mobile Tabs */}
      <div className="lg:hidden flex bg-white border-b border-slate-200 sticky top-14 z-40 shrink-0">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'catalog' ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Productos
        </button>
        <button
          onClick={() => setActiveTab('cart')}
          className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'cart' ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Ver Carrito
          {totalItems > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'cart' ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-600'}`}>
              {totalItems}
            </span>
          )}
        </button>
      </div>

      {/* Left Panel: Catalog */}
      <div className={`${activeTab === 'catalog' ? 'flex' : 'hidden'} lg:flex w-full lg:w-2/3 flex-col h-full bg-white lg:rounded-2xl lg:shadow-sm lg:border lg:border-slate-200 overflow-hidden`}>
        {/* Header & Search */}
        <div className="p-4 lg:p-5 border-b border-slate-100 flex items-center justify-between gap-4 shrink-0">
          <h2 className="hidden lg:flex text-xl font-semibold text-slate-800 items-center gap-2">
            <Sparkles className="w-6 h-6 text-cyan-500" />
            Catálogo
          </h2>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar esencia, crema..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-cyan-500 focus:border-cyan-500 bg-slate-50 transition-colors"
            />
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              No se encontraron productos disponibles.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredProducts.map(product => {
                const inCartItem = cart.find(c => c.product.id === product.id);
                const availableStock = product.units - (inCartItem ? inCartItem.quantity : 0);
                const isOutOfStockForCart = availableStock <= 0;
                const isLowStock = product.units < 5;

                return (
                  <div
                    key={product.id}
                    onClick={() => !isOutOfStockForCart && addToCart(product)}
                    className={`bg-white border rounded-2xl overflow-hidden transition-all duration-300 flex flex-col cursor-pointer group
                      ${isOutOfStockForCart ? 'opacity-60 grayscale border-slate-200' : 'border-slate-100 hover:border-cyan-200 hover:shadow-md'}
                    `}
                  >
                    <div className="aspect-square bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
                       {product.image ? (
                          <img src={product.image} alt={product.name} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-100/50 rounded-xl">
                            <Package className="w-8 h-8 text-cyan-300/50" />
                          </div>
                        )}
                        {/* Stock Badge */}
                        <div className={`absolute top-3 right-3 text-[10px] font-semibold px-2.5 py-1 rounded-full shadow-sm backdrop-blur-sm border
                          ${isLowStock
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
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Cart & Checkout */}
      <div className={`${activeTab === 'cart' ? 'flex' : 'hidden'} lg:flex w-full lg:w-1/3 flex-col h-full bg-white lg:rounded-2xl lg:shadow-sm lg:border lg:border-slate-200 overflow-hidden pb-28 lg:pb-0`}>
        <div className="hidden lg:flex p-5 border-b border-slate-100 items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-cyan-500" />
            Venta Actual
          </h2>
          <span className="bg-cyan-50 text-cyan-700 border border-cyan-100 px-2.5 py-1 rounded-full text-xs font-medium">
            {cart.reduce((sum, item) => sum + item.quantity, 0)} ítems
          </span>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto max-h-[40vh] border-b border-slate-100 mb-2 p-3 lg:p-5 space-y-3 bg-slate-50/30">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                <ShoppingCart className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm text-slate-500">El carrito está vacío</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="flex flex-row items-center bg-white border border-slate-100 p-3 rounded-2xl shadow-sm hover:border-slate-200 transition-colors gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">{item.product.name}</h4>
                  <div className="text-[11px] text-slate-500 font-medium mt-0.5">Bs. {item.product.sellingPrice} c/u</div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-0.5">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="p-1.5 text-slate-600 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold text-slate-800">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      disabled={item.quantity >= item.product.units}
                      className="p-1.5 text-slate-600 hover:bg-white hover:shadow-sm rounded-lg transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-right w-16">
                    <div className="text-sm font-bold text-slate-900">Bs. {item.quantity * item.product.sellingPrice}</div>
                  </div>

                  <button onClick={() => removeFromCart(item.product.id)} className="text-red-400 hover:text-red-600 transition-colors p-1.5 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Checkout Section */}
        <div className="p-3 lg:p-5 bg-white space-y-3 lg:space-y-5 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)] z-10">

          <div className="space-y-3 lg:space-y-4">
            <div>
              <label className="block text-[10px] lg:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 lg:mb-2">Cliente (Opcional)</label>
              <input
                type="text"
                placeholder="Cliente Ocasional"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-2 lg:px-4 lg:py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-cyan-500 focus:border-cyan-500 transition-colors bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[10px] lg:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 lg:mb-2">Método de Pago</label>
              <div className="grid grid-cols-2 gap-2 lg:gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Cash')}
                  className={`flex flex-row lg:flex-col items-center justify-center gap-1.5 lg:gap-2 py-2 lg:py-3 px-2 text-sm font-medium border-2 rounded-xl transition-all ${
                    paymentMethod === 'Cash'
                      ? 'border-cyan-400 bg-cyan-50 text-cyan-700 shadow-sm'
                      : 'border-slate-100 text-slate-600 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Banknote className={`w-4 h-4 lg:w-6 lg:h-6 ${paymentMethod === 'Cash' ? 'text-cyan-500' : 'text-slate-400'}`} />
                  <span>Efectivo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('QR')}
                  className={`flex flex-row lg:flex-col items-center justify-center gap-1.5 lg:gap-2 py-2 lg:py-3 px-2 text-sm font-medium border-2 rounded-xl transition-all ${
                    paymentMethod === 'QR'
                      ? 'border-cyan-400 bg-cyan-50 text-cyan-700 shadow-sm'
                      : 'border-slate-100 text-slate-600 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard className={`w-4 h-4 lg:w-6 lg:h-6 ${paymentMethod === 'QR' ? 'text-cyan-500' : 'text-slate-400'}`} />
                  <span>QR / Transf.</span>
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 space-y-3">
            <div className="flex justify-between items-center text-slate-500">
              <span className="font-medium">Subtotal</span>
              <span className="font-semibold text-slate-700">Bs. {subtotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center text-slate-500">
              <span className="font-medium">Descuento Global (Bs):</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={globalDiscount}
                onChange={(e) => setGlobalDiscount(e.target.value ? Number(e.target.value) : '')}
                className="w-24 text-right px-2 py-1 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-700 font-semibold"
              />
            </div>

            <div className="flex justify-between items-end pt-2 border-t border-slate-100">
              <span className="text-slate-500 font-medium">Total a Pagar</span>
              <span className="text-3xl font-bold text-slate-900 tracking-tight">Bs. {total.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={handleProcessSale}
            disabled={cart.length === 0 || isProcessing}
            className="w-full py-4 bg-cyan-500 text-white rounded-xl font-bold text-base hover:bg-cyan-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-[0_4px_14px_0_rgba(6,182,212,0.39)] hover:shadow-[0_6px_20px_rgba(6,182,212,0.23)] disabled:shadow-none active:scale-[0.98]"
          >
            {isProcessing ? (
              <span className="animate-pulse flex items-center gap-2">
                <Sparkles className="w-5 h-5 animate-spin" /> Procesando...
              </span>
            ) : (
              <>
                <ShoppingCart className="w-5 h-5" />
                Cobrar Venta
              </>
            )}
          </button>
        </div>
      </div>

    </div>
    </>
  );
};

export default POS;
