import ProductForm from "../components/ProductForm";
import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { updateInventoryItem, deleteInventoryItem, syncAllToPublicCatalog, addProduct, adjustProductStock } from '../services/db';
import { Package, Search, Trash2, Edit3, Plus, RefreshCw, Box } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';

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
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);

  // Modal States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Adjust Stock State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedAdjustItem, setSelectedAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState<number | ''>('');
  const [adjustDate, setAdjustDate] = useState(new Date().toISOString().split('T')[0]);
  const [adjustReason, setAdjustReason] = useState('');

  const handleOpenAdjust = (product: InventoryItem) => {
    setSelectedAdjustItem(product);
    setAdjustQuantity('');
    setAdjustDate(new Date().toISOString().split('T')[0]);
    setAdjustReason('');
    setIsAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdjustItem || adjustQuantity === '' || !adjustDate) return;

    try {
      await adjustProductStock(
        selectedAdjustItem.id,
        Number(adjustQuantity),
        adjustDate,
        adjustReason
      );

      const updatedItem = {
        ...selectedAdjustItem,
        units: selectedAdjustItem.units + Number(adjustQuantity)
      };
      updateLocalInventoryItem(updatedItem);

      setIsAdjustModalOpen(false);
      setSelectedAdjustItem(null);
      showToast('Stock ajustado y registrado en el Kárdex exitosamente', 'success');
    } catch (error: any) {
      console.error('Error adjusting stock:', error);
      showToast(error.message || 'Hubo un error al ajustar el stock.', 'error');
    }
  };

  const handleOpenEdit = (product: InventoryItem) => {
    setEditItem(product);
    setIsEditModalOpen(true);
  };

  const handleUpdateProduct = async (productData: any) => {
    if (!editItem) return;

    try {
      const updatedItem = {
        ...editItem,
        ...productData
      };
      await updateInventoryItem(updatedItem);
      setIsEditModalOpen(false);
      setEditItem(null);
      updateLocalInventoryItem(updatedItem);
      showToast('Producto actualizado con éxito', 'success');
    } catch (error) {
      console.error('Error updating product:', error);
      showToast('Hubo un error al actualizar el producto.', 'error');
    }
  };

  const handleSyncPublicCatalog = async () => {
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

  const handleDeleteItem = (id: string) => {
    setItemToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteInventoryItem(itemToDelete);
      removeLocalInventoryItem(itemToDelete);
      showToast('Registro eliminado del inventario', 'info');
    } catch (error) {
      console.error('Error deleting item:', error);
      showToast('Hubo un error al eliminar el registro.', 'error');
    } finally {
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
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
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Eliminar Registro"
        message="¡ATENCIÓN! Estás a punto de borrar este registro del Inventario General por completo. Únicamente usa esto si añadiste el producto por error. ¿Estás seguro de continuar?"
        confirmText="Eliminar"
        onConfirm={confirmDelete}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setItemToDelete(null);
        }}
      />

      <ConfirmModal
        isOpen={isSyncModalOpen}
        title="Sincronizar Catálogo"
        message="¿Quieres sincronizar el catálogo público ahora? Esto copiará todos los productos actuales a la vitrina web y puede tomar unos segundos."
        confirmText="Sincronizar"
        isDestructive={false}
        onConfirm={handleSyncPublicCatalog}
        onCancel={() => setIsSyncModalOpen(false)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-6 h-6 text-teal-600" />
          Inventario Central
        </h1>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:justify-end w-full sm:w-auto">
          {isAdmin && (
            <>
              <button
                onClick={() => setIsSyncModalOpen(true)}
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
                            onClick={() => handleOpenAdjust(product)}
                            className="inline-flex items-center p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Ajustar Stock (Kárdex)"
                          >
                            <Box className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(product)}
                            className="inline-flex items-center p-1.5 text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                            title="Editar Producto"
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

      {/* Adjust Stock Modal */}
      {isAdjustModalOpen && selectedAdjustItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-blue-50">
              <h2 className="text-xl font-semibold text-blue-900 flex items-center gap-2">
                <Box className="w-5 h-5" />
                Ajustar Stock (Kárdex)
              </h2>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="p-6 space-y-4">
              <div className="bg-gray-50 p-3 rounded-md mb-4">
                <p className="font-medium text-gray-900">{selectedAdjustItem.name}</p>
                <div className="text-sm text-gray-500 mt-1 flex justify-between">
                  <span>Stock Actual:</span>
                  <span className="font-bold text-gray-900">{selectedAdjustItem.units} unid.</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cantidad a Ajustar (+ o -)
                </label>
                <input
                  type="number"
                  required
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Ej: 5 para Entrada, -2 para Salida"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Usa números positivos para entradas y negativos para salidas/mermas.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Obligatoria</label>
                <input
                  type="date"
                  required
                  value={adjustDate}
                  onChange={(e) => setAdjustDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (Opcional)</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ej: Llegada de proveedor, Producto dañado..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="pt-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!adjustQuantity || (selectedAdjustItem.units + Number(adjustQuantity) < 0)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-300"
                >
                  Confirmar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {isEditModalOpen && editItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-4xl my-8">
            <ProductForm
              editingProduct={editItem as any}
              onAdd={handleUpdateProduct}
              onCancelEdit={() => setIsEditModalOpen(false)}
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default Inventory;
