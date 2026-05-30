import ProductForm from "../components/ProductForm";
import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { addTransfer, updateInventoryItem, deleteInventoryItem, processBulkTransfer, syncAllToPublicCatalog, addProduct } from '../services/db';
import { Package, ArrowRightLeft, Search, Trash2, Edit3, Truck, Plus, Minus, X, RefreshCw } from 'lucide-react';
import { collection, doc, updateDoc, increment, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../context/ToastContext';

const Inventory = () => {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const { inventory: rawProducts, stores, isLoading, refreshInventory, updateLocalInventoryItem, removeLocalInventoryItem } = useInventory();
  const [isSyncing, setIsSyncing] = useState(false);

  // Safe default to prevent length/map crashes on completely undefined inventory
  const products = rawProducts || [];
  const [searchTerm, setSearchTerm] = useState('');

  // Single Transfer state
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [transferQuantity, setTransferQuantity] = useState<number | ''>('');
  const [targetStoreId, setTargetStoreId] = useState('');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Bulk Transfer state
  const [isBulkTransferOpen, setIsBulkTransferOpen] = useState(false);
  const [transferCart, setTransferCart] = useState<{item: InventoryItem, quantity: number}[]>([]);
  const [bulkTargetStoreId, setBulkTargetStoreId] = useState('');
  const [bulkSearchTerm, setBulkSearchTerm] = useState('');

  // Full Edit State
  const [isFullEditModalOpen, setIsFullEditModalOpen] = useState(false);
  const [fullEditItem, setFullEditItem] = useState<InventoryItem | null>(null);
  const [fullEditForm, setFullEditForm] = useState<Partial<InventoryItem>>({});

  // Stock Adjustment State
  const [isStockAdjustModalOpen, setIsStockAdjustModalOpen] = useState(false);
  const [stockAdjustItem, setStockAdjustItem] = useState<InventoryItem | null>(null);
  const [stockAdjustQuantity, setStockAdjustQuantity] = useState<number | ''>('');
  const [stockAdjustDate, setStockAdjustDate] = useState<string>('');
  const [stockAdjustReason, setStockAdjustReason] = useState<string>('');

  const [isAddProductOpen, setIsAddProductOpen] = useState(false);

  const getStoreName = (storeId?: string) => {
    if (!storeId || storeId === 'bodega') return 'Bodega Central';
    const store = stores.find(s => s.id === storeId);
    return store ? store.name : 'Desconocida';
  };

  const handleOpenTransfer = (product: InventoryItem) => {
    setSelectedProduct(product);
    setTransferQuantity('');
    setTargetStoreId('');
    setIsTransferModalOpen(true);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !transferQuantity || !targetStoreId) return;

    const qty = Number(transferQuantity);
    if (qty <= 0 || qty > selectedProduct.units) {
      showToast('Cantidad inválida. Verifica el stock disponible.', 'error');
      return;
    }

    try {
      // 1. Record transfer
      await addTransfer({
        productId: selectedProduct.id,
        fromStoreId: selectedProduct.storeId || 'bodega',
        toStoreId: targetStoreId,
        quantity: qty,
        date: new Date().toISOString()
      });

      // 2. Deduct from origin
      const originUpdated = {
        ...selectedProduct,
        units: selectedProduct.units - qty
      };
      await updateInventoryItem(originUpdated);

      // 3. Add to destination (Check if product already exists in target store)
      const existingInTarget = products.find(p =>
        p.productId === selectedProduct.productId &&
        p.storeId === targetStoreId
      );

      if (existingInTarget) {
        await updateInventoryItem({
          ...existingInTarget,
          units: existingInTarget.units + qty
        });
      } else {
        // Create new inventory item record for the target store
        const newInventoryForStore: InventoryItem = {
          ...selectedProduct,
          id: crypto.randomUUID(),
          storeId: targetStoreId,
          units: qty,
        };
        await updateInventoryItem(newInventoryForStore);
      }

      setIsTransferModalOpen(false);
      await refreshInventory();
      showToast('Transferencia realizada con éxito', 'success');
    } catch (error) {
      console.error('Error transfer:', error);
      showToast('Hubo un error al realizar la transferencia', 'error');
    }
  };

  const addToTransferCart = (product: InventoryItem) => {
    const existing = transferCart.find(c => c.item.id === product.id);
    if (existing) {
      if (existing.quantity < product.units) {
        setTransferCart(transferCart.map(c => c.item.id === product.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
    } else {
      setTransferCart([...transferCart, { item: product, quantity: 1 }]);
    }
  };

  const updateTransferCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setTransferCart(transferCart.filter(c => c.item.id !== productId));
      return;
    }
    const cartItem = transferCart.find(c => c.item.id === productId);
    if (cartItem && quantity <= cartItem.item.units) {
      setTransferCart(transferCart.map(c => c.item.id === productId ? { ...c, quantity } : c));
    }
  };

  const removeFromTransferCart = (productId: string) => {
    setTransferCart(transferCart.filter(c => c.item.id !== productId));
  };

  const handleBulkTransferSubmit = async () => {
    if (transferCart.length === 0) {
      showToast('El carrito de envío está vacío.', 'error');
      return;
    }
    if (!bulkTargetStoreId) {
      showToast('Seleccione una tienda de destino.', 'error');
      return;
    }

    try {
      await processBulkTransfer(transferCart, bulkTargetStoreId, products);

      showToast('Envío múltiple realizado con éxito', 'success');
      setTransferCart([]);
      setBulkTargetStoreId('');
      setIsBulkTransferOpen(false);
      await refreshInventory();
    } catch (error) {
      console.error('Error bulk transfer:', error);
      showToast('Hubo un error al procesar el envío', 'error');
    }
  };

  const handleOpenFullEdit = (product: InventoryItem) => {
    setFullEditItem(product);
    setFullEditForm({ ...product });
    setIsFullEditModalOpen(true);
  };

  const handleOpenStockAdjust = (product: InventoryItem) => {
    setStockAdjustItem(product);
    setStockAdjustQuantity('');
    setStockAdjustDate('');
    setStockAdjustReason('');
    setIsStockAdjustModalOpen(true);
  };

  const handleStockAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockAdjustItem || stockAdjustQuantity === '' || !stockAdjustDate) return;

    const qty = Number(stockAdjustQuantity);
    if (isNaN(qty) || qty === 0) {
      showToast('Por favor ingrese una cantidad válida distinta de cero.', 'error');
      return;
    }

    try {
      // Create stock adjustment record
      const adjustmentsRef = collection(db, 'stock_adjustments');
      await addDoc(adjustmentsRef, {
        productId: stockAdjustItem.id,
        storeId: stockAdjustItem.storeId || 'bodega',
        quantity: qty,
        date: stockAdjustDate,
        reason: stockAdjustReason,
        createdAt: new Date().toISOString()
      });

      // Update the inventory item using increment
      const invRef = doc(db, 'inventory', stockAdjustItem.id);
      await updateDoc(invRef, {
        units: increment(qty)
      });

      // Update local state and trigger public_catalog update via standard path
      const updatedItem = {
        ...stockAdjustItem,
        units: stockAdjustItem.units + qty
      };
      await updateInventoryItem(updatedItem); // Ensures public catalog gets updated if needed
      updateLocalInventoryItem(updatedItem);

      setIsStockAdjustModalOpen(false);
      showToast('Stock ajustado con éxito', 'success');
    } catch (error) {
      console.error('Error adjusting stock:', error);
      showToast('Hubo un error al ajustar el stock.', 'error');
    }
  };

  const handleFullEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullEditItem) return;

    try {
      const { id: _id, productId: _productId, storeId: _storeId, units: _units, lastUpdated: _lastUpdated, ...restForm } = fullEditForm;
      const cleanForm = Object.fromEntries(
        Object.entries(restForm).filter(([_, v]) => v !== undefined)
      );

      // Update the product document
      const productRef = doc(db, 'products', fullEditItem.productId);
      await updateDoc(productRef, {
        ...cleanForm
      });

      // Since it's from the generic inventory context, we also push it through updateInventoryItem
      // so it replicates to inventory & public_catalog if needed
      const updatedInvItem = {
        ...fullEditItem,
        ...cleanForm
      } as InventoryItem;

      await updateInventoryItem(updatedInvItem);

      updateLocalInventoryItem(updatedInvItem);
      setIsFullEditModalOpen(false);
      setFullEditItem(null);
      showToast('Producto actualizado con éxito', 'success');
    } catch (error) {
      console.error('Error updating product:', error);
      showToast('Hubo un error al actualizar el producto.', 'error');
    }
  };

  const handleSyncPublicCatalog = async () => {
    if (!window.confirm('¿Quieres sincronizar el catálogo público ahora? Esto copiará todos los productos actuales a la vitrina web.')) return;

    setIsSyncing(true);
    try {
      showToast('Sincronizando el catálogo público, por favor espera...', 'info');
      const result = await syncAllToPublicCatalog();
      if (result.failed > 0) {
        showToast(`Sincronización terminada: ${result.success} exitosos, ${result.failed} errores. Revisa la consola para detalles.`, 'error');
      } else {
        showToast(`¡Catálogo sincronizado con éxito! (${result.success} productos)`, 'success');
      }
    } catch (error: any) {
      console.error('Error syncing public catalog:', error);
      showToast(`Error crítico al sincronizar: ${error.message || 'Desconocido'}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (window.confirm('¡ATENCIÓN! Estás a punto de borrar este registro del Inventario General por completo.\n\nÚnicamente usa esto si añadiste el producto por error. ¿Estás seguro de continuar?')) {
      try {
        await deleteInventoryItem(id);
        removeLocalInventoryItem(id);
        showToast('Registro eliminado del inventario', 'info');
      } catch (error) {
        console.error('Error deleting item:', error);
        showToast('Hubo un error al eliminar el registro.', 'error');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  const safeToLower = (val: any) => (val ? String(val).toLowerCase() : '');
  const searchLower = safeToLower(searchTerm);

  const filteredProducts = (products || []).filter(p =>
    safeToLower(p?.name).includes(searchLower) ||
    safeToLower(p?.barcode).includes(searchLower) ||
    safeToLower(p?.brand).includes(searchLower) ||
    safeToLower(p?.category).includes(searchLower) ||
    safeToLower(p?.gender).includes(searchLower)
  );

  if (isBulkTransferOpen) {
    const bulkSearchLower = safeToLower(bulkSearchTerm);
    const bulkFiltered = (products || []).filter(p =>
      p?.units > 0 &&
      (safeToLower(p?.name).includes(bulkSearchLower) ||
      safeToLower(p?.barcode).includes(bulkSearchLower) ||
      safeToLower(p?.brand).includes(bulkSearchLower) ||
      safeToLower(p?.category).includes(bulkSearchLower))
    );

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-teal-600" />
            Nuevo Envío Múltiple
          </h1>
          <button
            onClick={() => setIsBulkTransferOpen(false)}
            className="text-gray-500 hover:text-gray-700 font-medium self-start sm:self-auto"
          >
            &larr; Volver al Inventario
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Side: Products Search */}
          <div className="w-full lg:w-2/3 flex flex-col gap-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar productos por código, nombre, marca..."
                  value={bulkSearchTerm}
                  onChange={(e) => setBulkSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {bulkFiltered.map(product => {
                const inCart = transferCart.find(c => c.item.id === product.id);
                const availableUnits = product.units - (inCart ? inCart.quantity : 0);

                return (
                  <div key={product.id} className="bg-white p-4 rounded-lg shadow border border-gray-100 flex flex-col">
                    <div className="flex gap-3 mb-3">
                      <div className="h-16 w-16 bg-gray-100 rounded overflow-hidden shrink-0">
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-full h-full p-3 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 leading-tight">{product.name}</h3>
                        <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-1">
                           {product.brand && <span className="bg-gray-100 px-1 py-0.5 rounded">{product.brand}</span>}
                           {product.capacity && <span className="bg-gray-100 px-1 py-0.5 rounded">{product.capacity}</span>}
                        </div>
                        <div className="text-xs mt-1 text-teal-600 font-medium">Origen: {getStoreName(product.storeId)}</div>
                      </div>
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-sm text-gray-600 font-medium">Disp: {availableUnits}</span>
                      <button
                        onClick={() => addToTransferCart(product)}
                        disabled={availableUnits <= 0}
                        className="px-3 py-1.5 bg-teal-50 text-teal-600 rounded hover:bg-teal-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm font-medium"
                      >
                        <Plus className="w-4 h-4" /> Agregar
                      </button>
                    </div>
                  </div>
                );
              })}
              {bulkFiltered.length === 0 && (
                <div className="col-span-full py-8 text-center text-gray-500 bg-white rounded-lg shadow">
                  No se encontraron productos disponibles con ese término de búsqueda.
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Cart */}
          <div className="w-full lg:w-1/3">
            <div className="bg-white rounded-lg shadow p-4 sticky top-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-teal-600" />
                Carrito de Envío
              </h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Destino del Envío</label>
                <select
                  value={bulkTargetStoreId}
                  onChange={(e) => setBulkTargetStoreId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500 bg-gray-50"
                >
                  <option value="" disabled>Seleccione destino...</option>
                  <option value="bodega">Bodega Central</option>
                  {stores.map(store => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3 max-h-[50vh] overflow-y-auto mb-4 pr-1">
                {transferCart.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No hay productos en el envío
                  </div>
                ) : (
                  transferCart.map((cartItem) => (
                    <div key={cartItem.item.id} className="flex flex-col gap-2 p-3 bg-gray-50 rounded-md border border-gray-100">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{cartItem.item.name}</div>
                          <div className="text-xs text-gray-500">De: {getStoreName(cartItem.item.storeId)}</div>
                        </div>
                        <button onClick={() => removeFromTransferCart(cartItem.item.id)} className="text-gray-400 hover:text-red-500 p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateTransferCartQuantity(cartItem.item.id, cartItem.quantity - 1)}
                            className="p-1 rounded-full bg-white border border-gray-300 hover:bg-gray-100"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium">{cartItem.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateTransferCartQuantity(cartItem.item.id, cartItem.quantity + 1)}
                            disabled={cartItem.quantity >= cartItem.item.units}
                            className="p-1 rounded-full bg-white border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-xs text-gray-500">
                          Max: {cartItem.item.units}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={handleBulkTransferSubmit}
                disabled={transferCart.length === 0 || !bulkTargetStoreId}
                className="w-full py-3 bg-teal-600 text-white rounded-md font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Truck className="w-5 h-5" />
                Confirmar Envío ({transferCart.reduce((sum, i) => sum + i.quantity, 0)} ítems)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-6 h-6 text-teal-600" />
          Inventario Global y Transferencias
        </h1>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:justify-end w-full sm:w-auto">
          {isAdmin && (
            <>
              <button
                onClick={handleSyncPublicCatalog}
                disabled={isSyncing}
                className="bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2 w-full sm:w-auto"
                title="Sincronizar todos los productos a la Vitrina Pública"
              >
                <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                Sincronizar
              </button>
            </>
          )}
          <button
            onClick={() => setIsBulkTransferOpen(true)}
            className="bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-700 flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <Truck className="w-5 h-5" />
            Envío Múltiple
          </button>
          {isAdmin && (
            <button
              onClick={() => setIsAddProductOpen(!isAddProductOpen)}
              className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Plus className="w-5 h-5" />
              {isAddProductOpen ? 'Cerrar Formulario' : 'Añadir Producto'}
            </button>
          )}
        </div>
      </div>

      {isAddProductOpen && isAdmin && (
        <div className="mb-6">
          <ProductForm
            onAdd={async (product) => {
              try {
                await addProduct(product as any); // Type assertion needed due to Product vs Omit<Product, 'id'> matching
                await refreshInventory();
                showToast('Producto añadido al inventario exitosamente', 'success');
                setIsAddProductOpen(false);
              } catch (e) {
                console.error(e);
                showToast('Error al añadir producto', 'error');
              }
            }}
          />
        </div>
      )}

      <div className="bg-white p-4 rounded-lg shadow flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por código, nombre, marca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Producto</th>
                <th className="px-6 py-4">Ubicación</th>
                <th className="px-6 py-4 text-center">Stock</th>
                <th className="px-6 py-4 text-right">Precio Venta</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-gray-100 rounded overflow-hidden">
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-full h-full p-2 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{product.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap mt-1">
                          {product.brand && <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{product.brand}</span>}
                          {product.categoryType && <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{product.categoryType}</span>}
                          {product.capacity && <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-medium">{product.capacity}</span>}
                          {product.gender && <span className="bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded">{product.gender}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      (!product.storeId || product.storeId === 'bodega')
                        ? 'bg-teal-100 text-teal-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {getStoreName(product.storeId)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-medium">
                    {product.units}
                  </td>
                  <td className="px-6 py-4 text-right text-emerald-600 font-medium">
                    Bs. {(product.sellingPrice || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleOpenTransfer(product)}
                        disabled={product.units === 0}
                        className="inline-flex items-center p-1.5 bg-teal-50 text-teal-600 rounded-md hover:bg-teal-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Transferir stock"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleOpenStockAdjust(product)}
                        className="inline-flex items-center p-1.5 bg-amber-50 text-amber-600 rounded-md hover:bg-amber-100 transition-colors"
                        title="Ajustar Stock"
                      >
                        <Package className="w-4 h-4" />
                      </button>

                      {isAdmin && (
                        <>
                          <button
                            onClick={() => handleOpenFullEdit(product)}
                            className="inline-flex items-center p-1.5 text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                            title="Editar Completo"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(product.id)}
                            className="inline-flex items-center p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors"
                            title="Eliminar por error"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No se encontraron productos en el inventario.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Adjust Modal */}
      {isStockAdjustModalOpen && stockAdjustItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-amber-50">
              <h2 className="text-xl font-semibold text-amber-900 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Ajustar Stock
              </h2>
              <button onClick={() => setIsStockAdjustModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>

            <form onSubmit={handleStockAdjustSubmit} className="p-6 space-y-4">
              <div className="bg-gray-50 p-3 rounded-md mb-4">
                <p className="font-medium text-gray-900">{stockAdjustItem.name}</p>
                <p className="text-sm text-gray-500">
                  Ubicación: {getStoreName(stockAdjustItem.storeId)}
                </p>
                <p className="text-sm text-gray-700 mt-1 font-medium">
                  Stock actual: {stockAdjustItem.units}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Use números positivos para añadir stock (Entradas) y números negativos para restar (Salidas).
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad (+/-)</label>
                <input
                  type="number"
                  required
                  value={stockAdjustQuantity}
                  onChange={(e) => setStockAdjustQuantity(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Ej: 5 (entrada) o -3 (salida)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={stockAdjustDate}
                  onChange={(e) => setStockAdjustDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (Opcional)</label>
                <input
                  type="text"
                  value={stockAdjustReason}
                  onChange={(e) => setStockAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Ej: Compra de lote, Venta directa, Producto dañado"
                />
              </div>

              <div className="pt-4 flex gap-3 justify-end border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsStockAdjustModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700"
                >
                  Confirmar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Edit Modal */}
      {isFullEditModalOpen && fullEditItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-teal-50 sticky top-0 z-10 rounded-t-xl">
              <h2 className="text-xl font-semibold text-teal-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5" />
                Editar Producto Completo
              </h2>
              <button onClick={() => setIsFullEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>

            <form onSubmit={handleFullEditSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Producto</label>
                  <input
                    type="text"
                    required
                    value={fullEditForm.name || ''}
                    onChange={(e) => setFullEditForm({ ...fullEditForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
                  <input
                    type="text"
                    value={fullEditForm.brand || ''}
                    onChange={(e) => setFullEditForm({ ...fullEditForm, brand: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <input
                    type="text"
                    value={fullEditForm.category || ''}
                    onChange={(e) => setFullEditForm({ ...fullEditForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Categoría</label>
                  <input
                    type="text"
                    value={fullEditForm.categoryType || ''}
                    onChange={(e) => setFullEditForm({ ...fullEditForm, categoryType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad / Volumen</label>
                  <input
                    type="text"
                    value={fullEditForm.capacity || ''}
                    onChange={(e) => setFullEditForm({ ...fullEditForm, capacity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Género</label>
                  <select
                    value={fullEditForm.gender || 'Todos'}
                    onChange={(e) => setFullEditForm({ ...fullEditForm, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="Todos">Todos</option>
                    <option value="Varón">Varón</option>
                    <option value="Mujer">Mujer</option>
                    <option value="Unisex">Unisex</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código de Barras</label>
                  <input
                    type="text"
                    value={fullEditForm.barcode || ''}
                    onChange={(e) => setFullEditForm({ ...fullEditForm, barcode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio Venta (x Mayor)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Bs.</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={fullEditForm.wholesalePrice || ''}
                      onChange={(e) => setFullEditForm({ ...fullEditForm, wholesalePrice: e.target.value ? Number(e.target.value) : '' })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio Venta (Unidad)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">Bs.</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={fullEditForm.sellingPrice || ''}
                      onChange={(e) => setFullEditForm({ ...fullEditForm, sellingPrice: e.target.value ? Number(e.target.value) : '' })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL de la Imagen</label>
                  <input
                    type="url"
                    value={fullEditForm.image || ''}
                    onChange={(e) => setFullEditForm({ ...fullEditForm, image: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                    placeholder="https://ejemplo.com/imagen.jpg"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3 justify-end border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsFullEditModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {isTransferModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Transferir Inventario</h2>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>

            <form onSubmit={handleTransfer} className="p-6 space-y-4">
              <div className="bg-gray-50 p-3 rounded-md mb-4">
                <p className="font-medium text-gray-900">{selectedProduct.name}</p>
                <p className="text-sm text-gray-500">
                  Origen: {getStoreName(selectedProduct.storeId)} (Stock: {selectedProduct.units})
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad a transferir</label>
                <input
                  type="number"
                  min="1"
                  max={selectedProduct.units}
                  required
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destino</label>
                <select
                  required
                  value={targetStoreId}
                  onChange={(e) => setTargetStoreId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="" disabled>Selecciona un destino</option>
                  {(!selectedProduct.storeId || selectedProduct.storeId !== 'bodega') && (
                    <option value="bodega">Bodega Central</option>
                  )}
                  {stores.map(store => {
                    if (store.id !== selectedProduct.storeId) {
                      return <option key={store.id} value={store.id}>{store.name}</option>;
                    }
                    return null;
                  })}
                </select>
              </div>

              <div className="pt-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700"
                >
                  Confirmar Transferencia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
