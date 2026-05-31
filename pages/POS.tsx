import React, { useState, useMemo, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../context/ToastContext';
import { processPOSSale } from '../services/db';
import { InventoryItem } from '../types';
import { Search, ShoppingCart, Plus, Minus, X, CreditCard, Banknote, Package } from 'lucide-react';
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSaleData, setLastSaleData] = useState<ReceiptData | null>(null);

  useEffect(() => {
    const handleAfterPrint = () => {
      // Clear the receipt data to hide it and prepare for next sale
      setLastSaleData(null);
    };

    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  useEffect(() => {
    // Automatically trigger print dialog when a new sale is completed
    if (lastSaleData) {
      window.print();
    }
  }, [lastSaleData]);

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
  const total = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.product.sellingPrice * item.quantity), 0);
  }, [cart]);

  // Cart operations
  const addToCart = (product: InventoryItem) => {
    setCart(prevCart => {
      const existing = prevCart.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.units) {
          showToast('No hay suficiente stock disponible', 'error');
          return prevCart;
        }
        return prevCart.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
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
        total,
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
        total,
        clientName,
        paymentMethod,
        date: new Date()
      });

      // Reset POS state
      setCart([]);
      setClientName('');
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

    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6 print:hidden">

      {/* Left Panel: Catalog */}
      <div className="w-full lg:w-2/3 flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header & Search */}
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-teal-600" />
            Catálogo
          </h2>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar por nombre, código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500 bg-white"
            />
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500 text-sm">
              No se encontraron productos disponibles.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map(product => {
                const inCartItem = cart.find(c => c.product.id === product.id);
                const availableStock = product.units - (inCartItem ? inCartItem.quantity : 0);
                const isOutOfStockForCart = availableStock <= 0;

                return (
                  <div
                    key={product.id}
                    onClick={() => !isOutOfStockForCart && addToCart(product)}
                    className={`bg-white border rounded-lg overflow-hidden transition-all duration-200 flex flex-col cursor-pointer
                      ${isOutOfStockForCart ? 'opacity-60 grayscale border-gray-200' : 'border-teal-100 hover:border-teal-400 hover:shadow-md'}
                    `}
                  >
                    <div className="aspect-square bg-gray-100 flex items-center justify-center p-4 relative">
                       {product.image ? (
                          <img src={product.image} alt={product.name} className="w-full h-full object-contain" />
                        ) : (
                          <Package className="w-12 h-12 text-gray-300" />
                        )}
                        {/* Stock Badge */}
                        <div className="absolute top-2 right-2 bg-black/70 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                          {product.units}
                        </div>
                    </div>
                    <div className="p-3 flex flex-col flex-1">
                      <h3 className="text-sm font-medium text-gray-900 leading-tight line-clamp-2 mb-1" title={product.name}>
                        {product.name}
                      </h3>
                      <div className="mt-auto flex items-end justify-between">
                        <span className="text-sm font-bold text-teal-700">Bs. {product.sellingPrice}</span>
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
      <div className="w-full lg:w-1/3 flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-900 text-white flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Venta Actual
          </h2>
          <span className="bg-white/20 px-2 py-1 rounded text-sm font-medium">
            {cart.reduce((sum, item) => sum + item.quantity, 0)} ítems
          </span>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
              <ShoppingCart className="w-12 h-12 opacity-50" />
              <p className="text-sm">Agrega productos al carrito</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="flex flex-col bg-white border border-gray-100 p-3 rounded-lg shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-medium text-gray-800 leading-tight pr-4">{item.product.name}</span>
                  <button onClick={() => removeFromCart(item.product.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-1">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="p-1 text-gray-600 hover:bg-gray-200 rounded transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold text-gray-900">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      disabled={item.quantity >= item.product.units}
                      className="p-1 text-gray-600 hover:bg-gray-200 rounded transition-colors disabled:opacity-30"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">Bs. {item.product.sellingPrice} c/u</div>
                    <div className="text-sm font-bold text-teal-700">Bs. {item.quantity * item.product.sellingPrice}</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Checkout Section */}
        <div className="p-4 border-t border-gray-200 bg-white space-y-4">

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nombre del Cliente (Opcional)</label>
              <input
                type="text"
                placeholder="Cliente Ocasional"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Método de Pago</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Cash')}
                  className={`flex items-center justify-center gap-2 py-2 text-sm font-medium border rounded-md transition-colors ${
                    paymentMethod === 'Cash'
                      ? 'bg-teal-50 border-teal-500 text-teal-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Banknote className="w-4 h-4" /> Efectivo
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('QR')}
                  className={`flex items-center justify-center gap-2 py-2 text-sm font-medium border rounded-md transition-colors ${
                    paymentMethod === 'QR'
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <CreditCard className="w-4 h-4" /> Código QR
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3 flex justify-between items-end">
            <span className="text-gray-500 font-medium">Total a Cobrar</span>
            <span className="text-3xl font-black text-gray-900">Bs. {total.toFixed(2)}</span>
          </div>

          <button
            onClick={handleProcessSale}
            disabled={cart.length === 0 || isProcessing}
            className="w-full py-3.5 bg-gray-900 text-white rounded-lg font-bold text-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-lg"
          >
            {isProcessing ? (
              <span className="animate-pulse">Procesando...</span>
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
