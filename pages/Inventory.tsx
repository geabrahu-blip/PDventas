import ProductForm from "../components/ProductForm";
import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { updateInventoryItem, deleteInventoryItem, syncAllToPublicCatalog, addProduct } from '../services/db';
import { Package, Search, Trash2, Edit2, Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../context/ToastContext';

const Inventory = () => {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const { inventory: rawProducts, isLoading, refreshInventory, updateLocalInventoryItem, removeLocalInventoryItem } = useInventory();
  const [isSyncing, setIsSyncing] = useState(false);

  // Safe default to prevent length/map crashes on completely undefined inventory
  const products = rawProducts || [];
  const [searchTerm, setSearchTerm] = useState('');

  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [editWholesalePrice, setEditWholesalePrice] = useState<number | ''>('');
  const [editSellingPrice, setEditSellingPrice] = useState<number | ''>('');
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);

  const handleOpenEdit = (product: InventoryItem) => {
    setEditItem(product);
    setEditWholesalePrice(product.wholesalePrice);
    setEditSellingPrice(product.sellingPrice);
    setIsEditModalOpen(true);
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
      const { id, productId, ...restForm } = fullEditForm;
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


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-6 h-6 text-teal-600" />
          Inventario Central
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
                  <td className="px-6 py-4 text-center font-medium">
                    {product.units}
                  </td>
                  <td className="px-6 py-4 text-right text-emerald-600 font-medium">
                    Bs. {(product.sellingPrice || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
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
                <p className="font-medium text-gray-900">{editItem.name}</p>
                <div className="text-xs text-gray-400 mt-1">
                  Nota: Al editar aquí solo cambiará el precio de venta actual. El precio de compra histórico de este producto no se verá afectado.
                </div>
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

    </div>
  );
};

export default Inventory;
