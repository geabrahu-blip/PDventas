import React, { useState, useMemo, useEffect } from 'react';
import { VirtuosoGrid } from 'react-virtuoso';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { processPOSSale } from '../services/db';
import { InventoryItem } from '../types';
import { Search, ShoppingCart, Plus, Minus, CreditCard, Banknote, Package, Sparkles, Trash2 } from 'lucide-react';
import { printReceipt } from '../utils/printReceipt';

interface CartItem {
  product: InventoryItem;
  quantity: number;
}

const POS = () => {
  const { inventory, refreshInventory } = useInventory();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clientName, setClientName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'QR' | 'Mixto'>('Cash');
  const [mixedAmountQR, setMixedAmountQR] = useState<number | ''>('');
  const [mixedAmountCash, setMixedAmountCash] = useState<number | ''>('');
  const [globalDiscount, setGlobalDiscount] = useState<number | ''>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'catalog' | 'cart'>('catalog');

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

    if (paymentMethod === 'Mixto') {
      const qrAmt = Number(mixedAmountQR) || 0;
      const cashAmt = Number(mixedAmountCash) || 0;
      if (qrAmt + cashAmt !== total) {
        showToast('La suma de los montos debe ser igual al total a pagar', 'error');
        return;
      }
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
        paymentMethod,
        user?.id,
        user?.name,
        paymentMethod === 'Mixto' ? Number(mixedAmountCash) || 0 : undefined,
        paymentMethod === 'Mixto' ? Number(mixedAmountQR) || 0 : undefined
      );

      showToast('Venta procesada exitosamente', 'success');

      // IMPRESIÓN CON IFRAME OCULTO
      printReceipt({
        items: cart.map(item => ({
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.sellingPrice
        })),
        subtotal,
        discount: Number(globalDiscount) || 0,
        total,
        date: new Date(),
        paymentMethod,
        amountCash: paymentMethod === 'Mixto' ? Number(mixedAmountCash) || 0 : undefined,
        amountQR: paymentMethod === 'Mixto' ? Number(mixedAmountQR) || 0 : undefined
      });

      // Reset POS state
      setCart([]);
      setClientName('');
      setGlobalDiscount('');
      setPaymentMethod('Cash');
      setMixedAmountQR('');
      setMixedAmountCash('');
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
      <div className="h-[calc(100vh-8rem)] min-h-[550px] flex flex-col lg:flex-row gap-4 lg:gap-6 bg-slate-50 lg:p-2">

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
        <div className="flex-1 p-5 bg-slate-50/50 min-h-0 relative">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm absolute inset-0">
              No se encontraron productos disponibles.
            </div>
          ) : (
            <div className="h-full w-full absolute inset-0 p-5">
              <VirtuosoGrid
                style={{ height: '100%', width: '100%' }}
                totalCount={filteredProducts.length}
                listClassName="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-5 pb-10"
                itemClassName="flex flex-col h-full"
                itemContent={(index) => {
                  const product = filteredProducts[index];
                  const inCartItem = cart.find(c => c.product.id === product.id);
                  const availableStock = product.units - (inCartItem ? inCartItem.quantity : 0);
                  const isOutOfStockForCart = availableStock <= 0;
                  const isLowStock = product.units > 0 && product.units <= 2;

                  return (
                    <div
                      key={product.id}
                      onClick={() => !isOutOfStockForCart && addToCart(product)}
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
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Cart & Checkout */}
      <div className={`${activeTab === 'cart' ? 'flex' : 'hidden'} lg:flex w-full lg:w-1/3 flex-col h-full bg-white lg:rounded-2xl lg:shadow-sm lg:border lg:border-slate-200 overflow-y-auto lg:overflow-hidden pb-28 lg:pb-0`}>
        <div className="hidden lg:flex p-5 lg:p-3 border-b border-slate-100 items-center justify-between shrink-0">
          <h2 className="text-lg lg:text-base font-semibold text-slate-800 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 lg:w-4 lg:h-4 text-cyan-500" />
            Venta Actual
          </h2>
          <span className="bg-cyan-50 text-cyan-700 border border-cyan-100 px-2.5 py-1 rounded-full text-xs font-medium">
            {cart.reduce((sum, item) => sum + item.quantity, 0)} ítems
          </span>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto min-h-0 border-b border-slate-100 mb-2 lg:mb-0 p-3 lg:p-3 space-y-3 lg:space-y-2 bg-slate-50/30">
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
        <div className="p-3 lg:p-4 bg-white space-y-3 lg:space-y-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)] z-10 shrink-0">

          <div className="space-y-3 lg:space-y-3">
            <div>
              <label className="block text-[10px] lg:text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Cliente (Opcional)</label>
              <input
                type="text"
                placeholder="Cliente Ocasional"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-2 lg:px-3 lg:py-1.5 text-sm border border-slate-200 rounded-xl lg:rounded-lg focus:ring-cyan-500 focus:border-cyan-500 transition-colors bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[10px] lg:text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Método de Pago</label>
              <div className="grid grid-cols-3 gap-2 lg:gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Cash')}
                  className={`flex flex-row lg:flex-col items-center justify-center gap-1.5 lg:gap-1 py-2 lg:py-2 px-2 text-sm lg:text-xs font-medium border-2 lg:border rounded-xl lg:rounded-lg transition-all ${
                    paymentMethod === 'Cash'
                      ? 'border-cyan-400 bg-cyan-50 text-cyan-700 shadow-sm'
                      : 'border-slate-100 text-slate-600 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Banknote className={`w-4 h-4 lg:w-5 lg:h-5 ${paymentMethod === 'Cash' ? 'text-cyan-500' : 'text-slate-400'}`} />
                  <span>Efectivo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('QR')}
                  className={`flex flex-row lg:flex-col items-center justify-center gap-1.5 lg:gap-1 py-2 lg:py-2 px-2 text-sm lg:text-xs font-medium border-2 lg:border rounded-xl lg:rounded-lg transition-all ${
                    paymentMethod === 'QR'
                      ? 'border-cyan-400 bg-cyan-50 text-cyan-700 shadow-sm'
                      : 'border-slate-100 text-slate-600 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard className={`w-4 h-4 lg:w-5 lg:h-5 ${paymentMethod === 'QR' ? 'text-cyan-500' : 'text-slate-400'}`} />
                  <span>QR / Transf.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Mixto')}
                  className={`flex flex-row lg:flex-col items-center justify-center gap-1.5 lg:gap-1 py-2 lg:py-2 px-2 text-sm lg:text-xs font-medium border-2 lg:border rounded-xl lg:rounded-lg transition-all ${
                    paymentMethod === 'Mixto'
                      ? 'border-cyan-400 bg-cyan-50 text-cyan-700 shadow-sm'
                      : 'border-slate-100 text-slate-600 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex -space-x-1">
                    <Banknote className={`w-4 h-4 lg:w-4 lg:h-4 ${paymentMethod === 'Mixto' ? 'text-cyan-500' : 'text-slate-400'}`} />
                    <CreditCard className={`w-4 h-4 lg:w-4 lg:h-4 ${paymentMethod === 'Mixto' ? 'text-cyan-500' : 'text-slate-400'}`} />
                  </div>
                  <span>Mixto</span>
                </button>
              </div>
            </div>

            {paymentMethod === 'Mixto' && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Monto en QR</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={mixedAmountQR}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMixedAmountQR(val ? Number(val) : '');
                      if (val) {
                        const newQR = Number(val);
                        if (newQR <= total) {
                          setMixedAmountCash(Number((total - newQR).toFixed(2)));
                        } else {
                          setMixedAmountCash(0);
                        }
                      } else {
                        setMixedAmountCash(total);
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-cyan-500 focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Monto Efectivo</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={mixedAmountCash}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMixedAmountCash(val ? Number(val) : '');
                      if (val) {
                        const newCash = Number(val);
                        if (newCash <= total) {
                          setMixedAmountQR(Number((total - newCash).toFixed(2)));
                        } else {
                          setMixedAmountQR(0);
                        }
                      } else {
                        setMixedAmountQR(total);
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-cyan-500 focus:border-cyan-500"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 lg:pt-2 space-y-3 lg:space-y-2">
            <div className="flex justify-between items-center text-slate-500 text-sm lg:text-xs">
              <span className="font-medium">Subtotal</span>
              <span className="font-semibold text-slate-700">Bs. {subtotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center text-slate-500 text-sm lg:text-xs">
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
              <span className="text-slate-500 font-medium text-sm lg:text-xs">Total a Pagar</span>
              <span className="text-3xl lg:text-2xl font-bold text-slate-900 tracking-tight">Bs. {total.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={handleProcessSale}
            disabled={cart.length === 0 || isProcessing}
            className="w-full py-4 lg:py-3 bg-cyan-500 text-white rounded-xl font-bold text-base lg:text-sm hover:bg-cyan-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-[0_4px_14px_0_rgba(6,182,212,0.39)] hover:shadow-[0_6px_20px_rgba(6,182,212,0.23)] disabled:shadow-none active:scale-[0.98]"
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
