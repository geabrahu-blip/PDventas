import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, PackageX, PackageMinus, Package, Loader2, Plus, ListTodo, Search, MessageSquare, CheckCircle2, Clock, XCircle, FileText } from "lucide-react";
import { getPaginatedInventoryItems, getRestockItems, addRestockItem, updateRestockItem, deleteRestockItem } from "../services/db";
import { InventoryItem, RestockItem, RestockStatus } from "../types";
import { useAuth } from "../context/AuthContext";
import { useInventory } from "../context/InventoryContext";
import { useToast } from "../context/ToastContext";

export default function Alerts() {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();
  const { inventory } = useInventory(); // Using context for simple search

  const [loading, setLoading] = useState(true);
  const [outOfStock, setOutOfStock] = useState<InventoryItem[]>([]);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);

  // Paginación
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = React.useRef<any>(null);

  // Lista de reposición
  const [restockList, setRestockList] = useState<RestockItem[]>([]);
  const [loadingRestock, setLoadingRestock] = useState(true);

  // Formulario nueva reposición
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [requestedQuantity, setRequestedQuantity] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Edición Admin
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [editStatus, setEditStatus] = useState<RestockStatus>('PENDIENTE');

  const fetchAlerts = useCallback(async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        lastDocRef.current = null;
      } else {
        setIsLoadingMore(true);
      }

      const currentLastDoc = reset ? null : lastDocRef.current;
      const response = await getPaginatedInventoryItems(currentLastDoc, 20);
      const products = response?.items || [];

      const newOutOfStock = products.filter((item) => item.units === 0);
      const newLowStock = products.filter((item) => item.units > 0 && item.units <= 2);

      setOutOfStock(prev => reset ? newOutOfStock : [...(prev || []), ...newOutOfStock]);
      setLowStock(prev => reset ? newLowStock : [...(prev || []), ...newLowStock]);

      lastDocRef.current = response.lastDoc;
      setHasMore(products.length === 20);
    } catch (error) {
      console.error("Error fetching alerts data:", error);
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  const fetchRestock = useCallback(async () => {
    try {
      setLoadingRestock(true);
      const items = await getRestockItems();
      setRestockList(items);
    } catch (error) {
      console.error("Error fetching restock items:", error);
      showToast("Error al cargar la lista de reposición", "error");
    } finally {
      setLoadingRestock(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchAlerts(true);
    fetchRestock();
  }, [fetchAlerts, fetchRestock]);

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchAlerts(false);
    }
  };

  // Buscador filtrado
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return inventory.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase()))
    ).slice(0, 5);
  }, [searchTerm, inventory]);

  const handleAddRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim() || requestedQuantity < 1) return;

    try {
      setIsSubmitting(true);

      const newItem = {
        productId: selectedProduct?.id,
        productName: selectedProduct ? `${selectedProduct.name} ${selectedProduct.brand ? '- ' + selectedProduct.brand : ''}` : searchTerm,
        requestedQuantity,
        status: 'PENDIENTE' as RestockStatus,
        createdBy: user?.name || 'Desconocido',
      };

      const added = await addRestockItem(newItem);
      setRestockList(prev => [added, ...prev]);

      showToast("Añadido a la lista de reposición", "success");

      // Reset form
      setSearchTerm('');
      setSelectedProduct(null);
      setRequestedQuantity(1);
    } catch (error) {
      console.error("Error al añadir reposición", error);
      showToast("Error al añadir el producto", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminUpdate = async (item: RestockItem) => {
    try {
      const updatedItem = {
        ...item,
        status: editStatus,
        adminNotes: adminNotes
      };

      await updateRestockItem(updatedItem);
      setRestockList(prev => prev.map(p => p.id === item.id ? updatedItem : p));
      setEditingItem(null);
      showToast("Estado actualizado", "success");
    } catch (error) {
      console.error("Error actualizando", error);
      showToast("Error al actualizar", "error");
    }
  };

  const handleDeleteRestock = async (id: string) => {
    if (window.confirm("¿Eliminar este ítem de la lista?")) {
      try {
        await deleteRestockItem(id);
        setRestockList(prev => prev.filter(p => p.id !== id));
        showToast("Ítem eliminado", "success");
      } catch (error) {
        console.error("Error al eliminar", error);
        showToast("Error al eliminar", "error");
      }
    }
  };

  const getStatusIcon = (status: RestockStatus) => {
    switch (status) {
      case 'PENDIENTE': return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'COMPRADO': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'COMPRADO_PARCIAL': return <AlertTriangle className="w-5 h-5 text-blue-500" />;
      case 'AGOTADO_PROVEEDOR': return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusText = (status: RestockStatus) => {
    switch (status) {
      case 'PENDIENTE': return 'Pendiente';
      case 'COMPRADO': return 'Comprado';
      case 'COMPRADO_PARCIAL': return 'Comprado Parcial';
      case 'AGOTADO_PROVEEDOR': return 'Agotado en Prov.';
    }
  };

  const getStatusBg = (status: RestockStatus) => {
    switch (status) {
      case 'PENDIENTE': return 'bg-yellow-50 border-yellow-200';
      case 'COMPRADO': return 'bg-green-50 border-green-200';
      case 'COMPRADO_PARCIAL': return 'bg-blue-50 border-blue-200';
      case 'AGOTADO_PROVEEDOR': return 'bg-red-50 border-red-200';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* SECCIÓN ALERTAS DE STOCK */}
      <section className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            Alertas de Stock
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Monitorea los productos agotados y con bajo inventario.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Productos Agotados */}
          <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden flex flex-col">
            <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-2 shrink-0">
              <PackageX className="w-5 h-5 text-red-600" />
              <h2 className="font-semibold text-red-800">Productos Agotados</h2>
              <span className="ml-auto bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded-full">
                {outOfStock.length}
              </span>
            </div>

            <div className="p-4 flex-1 overflow-y-auto max-h-[300px] md:max-h-[400px]">
              {outOfStock.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No hay productos agotados. ¡Excelente!
                </p>
              ) : (
                <ul className="space-y-3">
                  {outOfStock.map((product) => (
                    <li
                      key={product.id}
                      className="flex items-center gap-3 p-3 bg-red-50/50 rounded-xl border border-red-50"
                    >
                      <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden relative border border-red-200">
                        {product.image ? (
                          <>
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-red-900/10"></div>
                          </>
                        ) : (
                          <Package className="w-6 h-6 text-red-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 line-clamp-1">
                          {product.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {product.brand} - {product.capacity}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Productos con Poco Stock */}
          <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden flex flex-col">
            <div className="bg-orange-50 p-4 border-b border-orange-100 flex items-center gap-2 shrink-0">
              <PackageMinus className="w-5 h-5 text-orange-600" />
              <h2 className="font-semibold text-orange-800">
                Poco Stock (1 o 2 unid.)
              </h2>
              <span className="ml-auto bg-orange-100 text-orange-800 text-xs font-bold px-2 py-1 rounded-full">
                {lowStock.length}
              </span>
            </div>

            <div className="p-4 flex-1 overflow-y-auto max-h-[300px] md:max-h-[400px]">
              {lowStock.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No hay productos con poco stock.
                </p>
              ) : (
                <ul className="space-y-3">
                  {lowStock.map((product) => (
                    <li
                      key={product.id}
                      className="flex items-center justify-between gap-3 p-3 bg-orange-50/50 rounded-xl border border-orange-50"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden relative border border-orange-200">
                          {product.image ? (
                            <>
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-orange-900/10"></div>
                            </>
                          ) : (
                            <Package className="w-6 h-6 text-orange-400" />
                          )}
                          <div className="absolute -bottom-1 -right-1 bg-orange-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border border-white">
                            {product.units}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 line-clamp-1">
                            {product.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {product.brand} - {product.capacity}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Botón Cargar Más Manual */}
        {hasMore && (
          <div className="flex justify-center mt-6">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="flex items-center gap-2 px-6 py-2 bg-teal-50 text-teal-600 border border-teal-100 rounded-md hover:bg-teal-100 transition-colors font-medium disabled:opacity-50"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Cargando alertas...
                </>
              ) : (
                'Cargar más productos'
              )}
            </button>
          </div>
        )}
      </section>

      <hr className="border-slate-200" />

      {/* SECCIÓN LISTA DE REPOSICIÓN */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ListTodo className="w-6 h-6 text-blue-500" />
            Lista de Reposición
          </h2>
          <p className="text-slate-600 text-sm mt-1">
            Anota los productos que se necesitan reponer o sugerencias de clientes.
          </p>
        </div>

        {/* Formulario para añadir (Vendedor y Admin) */}
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
          <form onSubmit={handleAddRestock} className="flex flex-col md:flex-row gap-4 items-start md:items-end">
            <div className="flex-1 w-full relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Producto a reponer / Sugerencia
              </label>
              <div className="relative">
                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setSelectedProduct(null);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  placeholder="Buscar producto o escribir sugerencia..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                  required
                />
              </div>

              {/* Autocomplete Dropdown */}
              {showDropdown && filteredProducts.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  {filteredProducts.map(product => (
                    <div
                      key={product.id}
                      onMouseDown={() => {
                        setSearchTerm(`${product.name} ${product.brand ? '- ' + product.brand : ''}`);
                        setSelectedProduct(product);
                        setShowDropdown(false);
                      }}
                      className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                    >
                      <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{product.name}</p>
                        <p className="text-xs text-slate-500 truncate">{product.brand}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="w-full md:w-32 shrink-0">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cantidad
              </label>
              <input
                type="number"
                min="1"
                value={requestedQuantity}
                onChange={(e) => setRequestedQuantity(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !searchTerm.trim()}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors font-medium disabled:opacity-50 shrink-0"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              <span>Añadir a lista</span>
            </button>
          </form>
          {!selectedProduct && searchTerm.trim() && (
            <p className="text-xs text-blue-600 flex items-center gap-1 mt-2">
              <FileText className="w-3 h-3" />
              Se añadirá como texto libre / sugerencia de clientela
            </p>
          )}
        </div>

        {/* Lista de ítems */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              Artículos Solicitados
              <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-1 rounded-full">
                {restockList.length}
              </span>
            </h3>
          </div>

          <div className="divide-y divide-slate-100">
            {loadingRestock ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : restockList.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <ListTodo className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-600 font-medium">La lista está vacía</p>
                <p className="text-slate-500 text-sm mt-1">Añade productos que necesites reponer arriba.</p>
              </div>
            ) : (
              restockList.map((item) => (
                <div key={item.id} className={`p-4 transition-colors ${getStatusBg(item.status)}`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-slate-800 break-words flex items-center gap-2">
                          {!item.productId && <FileText className="w-4 h-4 text-slate-400 shrink-0" title="Sugerencia libre" />}
                          {item.productName}
                        </h4>
                        <div className="flex items-center gap-2 md:hidden">
                           <span className="px-2 py-1 bg-white rounded-lg border border-slate-200 text-sm font-bold text-slate-700 shrink-0 shadow-sm">
                            Cant: {item.requestedQuantity}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                          Por: {item.createdBy}
                        </span>
                      </div>

                      {item.adminNotes && (
                        <div className="mt-2 text-sm text-slate-700 bg-white/60 p-2 rounded-lg border border-slate-200/50">
                          <strong>Nota Admin:</strong> {item.adminNotes}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden md:flex items-center gap-2">
                         <span className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-sm font-bold text-slate-700 shadow-sm">
                          Cant: {item.requestedQuantity}
                        </span>
                      </div>

                      {editingItem === item.id ? (
                        // Formulario de edición admin
                        <div className="flex flex-col gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-lg z-10 w-full md:w-auto">
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as RestockStatus)}
                            className="text-sm border-slate-200 rounded-lg p-2"
                          >
                            <option value="PENDIENTE">Pendiente</option>
                            <option value="COMPRADO">Comprado</option>
                            <option value="COMPRADO_PARCIAL">Comprado Parcialmente</option>
                            <option value="AGOTADO_PROVEEDOR">Agotado en Proveedor</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Nota opcional..."
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            className="text-sm border-slate-200 rounded-lg p-2"
                          />
                          <div className="flex justify-end gap-2 mt-1">
                            <button onClick={() => setEditingItem(null)} className="px-3 py-1 text-xs text-slate-500 bg-slate-100 rounded-lg">Cancelar</button>
                            <button onClick={() => handleAdminUpdate(item)} className="px-3 py-1 text-xs text-white bg-slate-800 rounded-lg">Guardar</button>
                          </div>
                        </div>
                      ) : (
                        // Vista normal de estado
                        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                            {getStatusIcon(item.status)}
                            <span className="text-xs font-semibold text-slate-700">
                              {getStatusText(item.status)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 ml-2">
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setEditingItem(item.id);
                                  setEditStatus(item.status);
                                  setAdminNotes(item.adminNotes || '');
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                title="Actualizar estado"
                              >
                                Actualizar
                              </button>
                            )}
                            {(isAdmin || item.status === 'PENDIENTE') && (
                              <button
                                onClick={() => handleDeleteRestock(item.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                title="Eliminar"
                              >
                                <PackageX className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
