import ProductForm from "../components/ProductForm";
import React, { useState, useEffect, useCallback } from 'react';
import { TableVirtuoso, Virtuoso } from 'react-virtuoso';
import { InventoryItem } from '../types';
import { updateInventoryItem, deleteInventoryItem, syncAllToPublicCatalog, addProduct, adjustProductStock, getPaginatedInventoryItems, searchInventoryItems } from '../services/db';
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { Package, Search, Trash2, Edit3, Plus, RefreshCw, Box, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';

const Inventory = () => {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const { updateLocalInventoryItem, removeLocalInventoryItem } = useInventory();

  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const lastDocRef = React.useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const isFirstRender = React.useRef(true);
  const [hasMore, setHasMore] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);
  const [inputValue, setInputValue] = useState('');
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




  const fetchInventory = useCallback(async (reset: boolean = false) => {
    try {
      if (reset) {
        setIsLoading(true);
        setProducts([]);
        setHasMore(true);
        lastDocRef.current = null;
      } else {
        setIsLoadingMore(true);
      }

      const currentLastDoc = reset ? null : lastDocRef.current;
      const result = await getPaginatedInventoryItems(currentLastDoc, 20);

      setProducts(prev => {
        const newProducts = reset ? (result.items || []) : [...prev, ...(result.items || [])];
        // simple dedup by id just in case
        const seen = new Set();
        return newProducts.filter(p => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
      });

      lastDocRef.current = result.lastDoc;
      setHasMore(result.items.length === 20);
    } catch (error) {
      console.error("Error loading inventory:", error);
      showToast("Error al cargar el inventario", "error");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [showToast]);

  useEffect(() => { fetchInventory(true); }, [fetchInventory]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setSearchTerm(inputValue);
      if (inputValue.trim() === '') {
        setIsSearching(false);
        fetchInventory(true);
        return;
      }

      setIsSearching(true);
      setIsLoading(true);
      try {
        const results = await searchInventoryItems(inputValue);
        setProducts(results);
        setHasMore(false); // Disable pagination during search
      } catch (error) {
        console.error("Search error:", error);
        showToast("Error en la búsqueda", "error");
      } finally {
        setIsLoading(false);
      }
    }, 1500);

    return () => clearTimeout(delayDebounceFn);
  }, [inputValue, fetchInventory, showToast]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore && !isSearching) {
      fetchInventory(false);
    }
  };

  const refreshInventoryLocal = () => fetchInventory(true);


  // Safe default to prevent length/map crashes on completely undefined inventory
  // const products managed locally now








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
      setProducts(prev => prev.filter(p => p.id !== itemToDelete));
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

  // Search is now server-side or handled by the search function, so filteredProducts is just products
  const filteredProducts = products;


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
              onClick={() => setIsAddProductOpen(true)}
              className="bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-700 flex items-center justify-center gap-2 w-full sm:w-auto transition-colors"
            >
              <Plus className="w-5 h-5" />
              Añadir Producto
            </button>
          )}
        </div>
      </div>

      {/* Añadir Producto Modal (Fullscreen on mobile, inline/modal on desktop depending on preference, here we make it modal-like for consistency) */}
      {isAddProductOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center md:p-4 z-50 backdrop-blur-sm overflow-y-auto">
          <div className="w-full h-full md:h-auto md:max-w-4xl md:my-8 relative">
          <ProductForm
            onCancelEdit={() => setIsAddProductOpen(false)}
            onAdd={async (product) => {
              try {
                await addProduct(product as any); // Type assertion needed due to Product vs Omit<Product, 'id'> matching
                await refreshInventoryLocal();
                showToast('Producto añadido al inventario exitosamente', 'success');
                setIsAddProductOpen(false);
              } catch (e: any) {
                console.error(e);
                // Propagate the error so ProductForm doesn't clear and shows the specific message
                throw e;
              }
            }}
          />
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-lg shadow flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative w-full sm:max-w-md">
          {isSearching || isLoading ? (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 text-teal-500 w-5 h-5 animate-spin" />
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          )}
          <input
            type="text"
            placeholder="Buscar por código, nombre, marca..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-lg shadow h-[calc(100vh-250px)]">
        {filteredProducts.length === 0 ? (
          <div className="flex justify-center items-center h-full text-gray-500">
            No se encontraron productos en el inventario.
          </div>
        ) : (
          <TableVirtuoso
            style={{ height: '100%' }}
            data={filteredProducts}
            components={{
              Table: ({ style, ...props }) => (
                <table {...props} style={{ ...style, width: '100%', textAlign: 'left', fontSize: '0.875rem' }} className="min-w-full" />
              ),
              TableHead: React.forwardRef((props, ref) => (
                <thead {...props} ref={ref} className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200 sticky top-0 z-10" />
              )),
              TableRow: (props: any) => {
                const item = props.item; // virtuso passes item to TableRow if components.TableRow is used
                let bgClass = "hover:bg-gray-50";
                if (item) {
                  if (item.units === 0) bgClass = "bg-red-50 hover:bg-red-100/50";
                  else if (item.units > 0 && item.units <= 2) bgClass = "bg-orange-50/50 hover:bg-orange-50";
                }
                return <tr {...props} className={`${bgClass} border-b border-gray-100 last:border-0`} />;
              },
              TableBody: React.forwardRef((props, ref) => (
                <tbody {...props} ref={ref} className="divide-y divide-gray-200" />
              )),
            }}
            fixedHeaderContent={() => (
              <tr>
                <th className="px-6 py-4 bg-gray-50">Producto</th>
                <th className="px-6 py-4 bg-gray-50 text-center">Stock</th>
                <th className="px-6 py-4 bg-gray-50 text-right">Precio Venta</th>
                <th className="px-6 py-4 bg-gray-50 text-center">Acciones</th>
              </tr>
            )}
            itemContent={(_, product) => (
              <>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-gray-100 rounded overflow-hidden">
                      {product.image ? (
                        <img loading="lazy" src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-full h-full p-2 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap mt-1">
                        {product.brand && <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{product.brand}</span>}
                        {(product as any).categoryType && <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{(product as any).categoryType}</span>}
                        {product.capacity && <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-medium">{product.capacity}</span>}
                        {product.gender && <span className="bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded">{product.gender}</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`inline-flex items-center justify-center min-w-[3rem] px-2.5 py-1 rounded-full text-xs font-bold shadow-sm border ${product.units === 0 ? 'bg-red-100 text-red-700 border-red-200' : (product.units > 0 && product.units <= 2) ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-white text-slate-700 border-slate-200'}`}>
                    {product.units}
                  </span>
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
              </>
            )}
          />
        )}
      </div>

      {/* Mobile Grid View */}
      <div className="md:hidden">
        {filteredProducts.length === 0 ? (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center text-gray-500">
            No se encontraron productos en el inventario.
          </div>
        ) : (
          <Virtuoso
            useWindowScroll
            data={filteredProducts}
            itemContent={(_, product) => {
              let bgClass = "bg-white";
              if (product.units === 0) bgClass = "bg-red-50";
              else if (product.units > 0 && product.units <= 2) bgClass = "bg-orange-50/50";

              return (
              <div className={`${bgClass} p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3 mb-4`}>
                <div className="flex gap-3">
                  <div className="h-16 w-16 shrink-0 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center border border-gray-100">
                    {product.image ? (
                      <img loading="lazy" src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-medium text-gray-900 text-sm leading-tight line-clamp-2">{product.name}</h3>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${product.units === 0 ? 'bg-red-100 text-red-700 border-red-200' : (product.units > 0 && product.units <= 2) ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                        {product.units} ud.
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {product.category && <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] text-gray-600">{product.category}</span>}
                      {product.capacity && <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] text-gray-600 font-medium">{product.capacity}</span>}
                      {product.gender && <span className="bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-100 text-[10px]">{product.gender}</span>}
                    </div>

                    <div className="mt-2 text-sm font-bold text-slate-800">
                      Bs. {(product.sellingPrice || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                    <button
                      onClick={() => handleOpenAdjust(product)}
                      className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Box className="w-4 h-4" /> Ajustar
                    </button>
                    <button
                      onClick={() => handleOpenEdit(product)}
                      className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] bg-teal-50 text-teal-600 hover:bg-teal-100 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Edit3 className="w-4 h-4" /> Editar
                    </button>
                    <button
                      onClick={() => handleDeleteItem(product.id)}
                      className="flex items-center justify-center min-w-[44px] min-h-[44px] bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}}
          />
        )}
      </div>

      {/* Botón Cargar Más Manual */}
      {hasMore && !isSearching && searchTerm === '' && filteredProducts.length > 0 && (
        <div className="flex justify-center mt-6">
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="flex items-center gap-2 px-6 py-2 bg-teal-50 text-teal-600 border border-teal-100 rounded-md hover:bg-teal-100 transition-colors font-medium disabled:opacity-50"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Cargando...
              </>
            ) : (
              'Cargar más productos'
            )}
          </button>
        </div>
      )}

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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center md:p-4 z-50 backdrop-blur-sm overflow-y-auto">
          <div className="w-full h-full md:h-auto md:max-w-4xl md:my-8">
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
