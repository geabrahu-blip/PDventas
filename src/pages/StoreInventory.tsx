import { useState, useEffect, useMemo } from 'react';
import { InventoryItem, SaleItem, Sale } from '../types';
import { addSale, updateInventoryItem } from '../services/db';
import { Store as StoreIcon, AlertTriangle, ShoppingCart, CreditCard, QrCode, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';

const StoreInventory = () => {
  const { user, isAdmin } = useAuth();
  const { inventory: globalInventory, stores: globalStores, isLoading, refreshInventory } = useInventory();
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // POS State
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [clientName, setClientName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'QR'>('Cash');
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);

  // Derived Stores
  const stores = useMemo(() => {
    const allStores = [{ id: 'bodega', name: 'Bodega Central' }, ...globalStores];
    if (!isAdmin && user?.storeId) {
      return allStores.filter(s => s.id === user.storeId);
    }
    return allStores;
  }, [globalStores, isAdmin, user?.storeId]);

  useEffect(() => {
    if (!selectedStoreId && stores.length > 0) {
      if (!isAdmin && user?.storeId) {
        setSelectedStoreId(user.storeId);
      } else {
        setSelectedStoreId('bodega');
      }
    }
  }, [stores, selectedStoreId, isAdmin, user?.storeId]);

  // Derived Products
  const products = useMemo(() => {
    if (!selectedStoreId) return [];
    return globalInventory.filter(p => p.storeId === selectedStoreId);
  }, [globalInventory, selectedStoreId]);

  const addToCart = (product: InventoryItem) => {
    if (product.units <= 0) {
      alert('No hay stock disponible para este producto en esta sucursal.');
      return;
    }

    const existingItem = cart.find(item => item.productId === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.units) {
        alert('No puedes agregar más unidades de las disponibles en stock.');
        return;
      }
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        price: product.sellingPrice,
        quantity: 1,
        subtotal: product.sellingPrice
      }]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const updateCartItemPrice = (productId: string, newPrice: number) => {
    setCart(cart.map(item =>
      item.productId === productId
        ? { ...item, price: newPrice, subtotal: item.quantity * newPrice }
        : item
    ));
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const cartTotal = Math.max(0, cartSubtotal - globalDiscount);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!clientName.trim()) {
      alert('Por favor, ingresa el nombre del cliente.');
      return;
    }

    try {
      // 1. Create Sale Record
      const newSale: Omit<Sale, 'id'> = {
        storeId: selectedStoreId,
        clientName,
        items: cart,
        total: cartTotal,
        paymentMethod,
        date: new Date().toISOString()
      };

      if (globalDiscount > 0) {
        newSale.globalDiscount = globalDiscount;
      }

      await addSale(newSale);

      // 2. Update Product Inventory (Deduct stock)
      for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          // Firebase throws if we pass undefined values. Let's sanitize properly.
          const updatedProduct = {
            ...product,
            units: product.units - item.quantity
          };

          // Using JSON stringify/parse is a safe way to strip all undefined values deeply
          const sanitizedProduct = JSON.parse(JSON.stringify(updatedProduct));

          await updateInventoryItem(sanitizedProduct);
        }
      }

      // 3. Reset POS state
      setCart([]);
      setClientName('');
      setGlobalDiscount(0);
      alert('Venta registrada con éxito!');

      // Reload products to show updated stock
      await refreshInventory();

    } catch (error: any) {
      console.error('Error procesando venta:', error);
      const errorMessage = error?.message || 'Error desconocido';
      alert(`Ocurrió un error al procesar la venta. Detalles: ${errorMessage}`);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
      {/* Products Section */}
      <div className="flex-1 flex flex-col space-y-4">
        <div className="bg-white p-4 rounded-lg shadow flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
            <h1 className="text-xl font-bold flex items-center gap-2 w-full sm:w-auto">
              <StoreIcon className="w-6 h-6 text-indigo-600" />
              Punto de Venta
              {isLoading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 ml-2"></div>
              )}
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por código o nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                autoFocus
              />
            </div>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              disabled={!isAdmin} // Lock for regular users
              className="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 w-full sm:w-auto disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="" disabled>Selecciona una sucursal</option>
              {stores.map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 bg-white p-4 rounded-lg shadow overflow-y-auto">
          {selectedStoreId ? (() => {
            const safeToLower = (val: any) => (val ? String(val).toLowerCase() : '');
            const searchLower = safeToLower(searchTerm);
            const filteredProducts = (products || []).filter(p =>
              safeToLower(p?.name).includes(searchLower) ||
              safeToLower(p?.barcode).includes(searchLower) ||
              safeToLower(p?.brand).includes(searchLower) ||
              safeToLower(p?.category).includes(searchLower) ||
              safeToLower(p?.gender).includes(searchLower)
            );

            return filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map(product => (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="border rounded-lg p-3 cursor-pointer hover:border-indigo-500 hover:shadow-md transition-all flex flex-col h-full"
                  >
                    <div className="h-32 bg-gray-100 rounded-md mb-2 overflow-hidden flex items-center justify-center">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gray-400">Sin Imagen</span>
                      )}
                    </div>
                    <h3 className="font-medium text-sm line-clamp-2 flex-1">{product.name}</h3>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {product.perfumeType && (
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-sm">
                          {product.perfumeType}
                        </span>
                      )}
                      {product.capacity && (
                        <span className="text-[10px] font-medium bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-sm">
                          {product.capacity}
                        </span>
                      )}
                      {product.gender && (
                        <span className="text-[10px] uppercase bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-sm">
                          {product.gender}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex justify-between items-end">
                      <span className="font-bold text-indigo-600">Bs. {product.sellingPrice}</span>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        product.units > 5 ? 'bg-green-100 text-green-800' :
                        product.units > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                      }`}>
                        Stock: {product.units}
                      </span>
                    </div>
                    {product.units <= 5 && product.units > 0 && (
                      <div className="mt-2 flex items-center text-xs text-yellow-600">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Poco stock
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                Esta sucursal no tiene inventario asignado.
              </div>
            );
          })() : (
            <div className="h-full flex items-center justify-center text-gray-500">
              Selecciona una sucursal para ver los productos.
            </div>
          )}
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-full lg:w-[400px] bg-white rounded-lg shadow flex flex-col h-full">
        <div className="p-4 border-b flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-bold">Carrito de Venta</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.map((item, index) => (
            <div key={index} className="flex flex-col border-b pb-3 gap-2">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-sm line-clamp-1">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.quantity} und.</p>
                </div>
                <button
                  onClick={() => removeFromCart(item.productId)}
                  className="text-red-500 hover:text-red-700 text-sm font-bold ml-2"
                >
                  &times;
                </button>
              </div>
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">Bs.</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    onChange={(e) => updateCartItemPrice(item.productId, Number(e.target.value))}
                    className="w-20 px-2 py-1 text-sm border rounded-md"
                  />
                  <span className="text-xs text-gray-500">c/u</span>
                </div>
                <span className="font-bold text-sm">Bs. {(item.subtotal || 0).toFixed(2)}</span>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              El carrito está vacío
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nombre del cliente"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPaymentMethod('Cash')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 border rounded-md ${
                  paymentMethod === 'Cash' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white hover:bg-gray-50'
                }`}
              >
                <CreditCard className="w-4 h-4" /> Efectivo
              </button>
              <button
                onClick={() => setPaymentMethod('QR')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 border rounded-md ${
                  paymentMethod === 'QR' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white hover:bg-gray-50'
                }`}
              >
                <QrCode className="w-4 h-4" /> QR
              </button>
            </div>
          </div>

          <div className="pt-2 border-t space-y-2 mb-4">
            <div className="flex justify-between items-center text-sm text-gray-600">
              <span>Subtotal:</span>
              <span>Bs. {(cartSubtotal || 0).toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Descuento Global (Bs):</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={globalDiscount || ''}
                onChange={(e) => setGlobalDiscount(Number(e.target.value))}
                className="w-24 px-2 py-1 border rounded-md text-right text-sm"
                placeholder="0.00"
              />
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <span className="font-bold text-lg">Total a Pagar:</span>
              <span className="font-bold text-2xl text-indigo-600">Bs. {(cartTotal || 0).toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${
              cart.length > 0 ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            Confirmar Venta
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoreInventory;
