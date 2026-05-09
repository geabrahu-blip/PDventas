import { useState, useEffect } from 'react';
import { Product, InventoryItem } from '../types';
import { Image as ImageIcon, Plus, Save, X, Search } from 'lucide-react';
import { getInventoryItems } from '../services/db';
import imageCompression from 'browser-image-compression';

interface ProductFormProps {
  onAdd: (product: Omit<Product, 'id'>, updatePricesAllStores?: boolean) => void;
  editingProduct?: Product;
  onCancelEdit?: () => void;
}

export default function ProductForm({ onAdd, editingProduct, onCancelEdit }: ProductFormProps) {
  const [image, setImage] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [gender, setGender] = useState('');
  const [priceBs, setPriceBs] = useState<number | ''>('');
  const [units, setUnits] = useState<number | ''>('');
  const [wholesalePrice, setWholesalePrice] = useState<number | ''>('');
  const [sellingPrice, setSellingPrice] = useState<number | ''>('');
  const [capacity, setCapacity] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [barcode, setBarcode] = useState('');
  const [updatePricesAllStores, setUpdatePricesAllStores] = useState(false);

  // Autocomplete State
  const [existingBrands, setExistingBrands] = useState<string[]>([]);
  const [globalProducts, setGlobalProducts] = useState<InventoryItem[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);

  useEffect(() => {
    // Load existing data for autocompletion
    getInventoryItems().then(items => {
      // Create a unique list of products based on name+brand+category
      const uniqueProducts: InventoryItem[] = [];
      const seen = new Set();

      for (const item of items) {
        const key = `${item.name.toLowerCase()}-${(item.brand || '').toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueProducts.push(item);
        }
      }

      setGlobalProducts(uniqueProducts);

      const brands = new Set(items.map(i => i.brand).filter(b => !!b) as string[]);
      setExistingBrands(Array.from(brands).sort());
    });
  }, []);

  const handleSelectExistingProduct = (p: InventoryItem) => {
    setName(p.name);
    setBrand(p.brand || '');
    setCategory(p.category || '');
    setGender(p.gender || '');
    setCapacity(p.capacity || '');
    setExpirationDate(p.expirationDate || '');
    setBarcode(p.barcode || '');
    setImage(p.image || '');
    setPriceBs(p.priceBs || '');
    setWholesalePrice(p.wholesalePrice || '');
    setSellingPrice(p.sellingPrice || '');

    // Reset search
    setShowProductSearch(false);

    // Auto focus the units field if possible, but user will naturally click it
  };

  useEffect(() => {
    if (editingProduct) {
      setImage(editingProduct.image || '');
      setName(editingProduct.name);
      setBrand(editingProduct.brand || '');
      setCategory(editingProduct.category || '');
      setGender(editingProduct.gender || '');
      setCapacity(editingProduct.capacity || '');
      setExpirationDate(editingProduct.expirationDate || '');
      setBarcode(editingProduct.barcode || '');
      setPriceBs(editingProduct.priceBs);
      setUnits(editingProduct.units);
      setWholesalePrice(editingProduct.wholesalePrice);
      setSellingPrice(editingProduct.sellingPrice);
      setUpdatePricesAllStores(false);
    } else {
      resetForm();
    }
  }, [editingProduct]);

  const resetForm = () => {
    setImage('');
    setName('');
    setBrand('');
    setCategory('');
    setGender('');
    setCapacity('');
    setExpirationDate('');
    setBarcode('');
    setPriceBs('');
    setUnits('');
    setWholesalePrice('');
    setSellingPrice('');
    setUpdatePricesAllStores(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const options = {
          maxSizeMB: 0.1, // compress down to ~100kb max
          maxWidthOrHeight: 800,
          useWebWorker: true,
        };
        const compressedFile = await imageCompression(file, options);

        const reader = new FileReader();
        reader.onloadend = () => {
          setImage(reader.result as string);
        };
        reader.readAsDataURL(compressedFile);
      } catch (error) {
        console.error('Error compressing image:', error);
        // Fallback to uncompressed if compression fails
        const reader = new FileReader();
        reader.onloadend = () => {
          setImage(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || priceBs === '' || units === '' || wholesalePrice === '' || sellingPrice === '') return;

    const totalPrice = Number(priceBs) * Number(units);

    // We await onAdd here so if there's an error we don't clear the form
    await onAdd({
      name,
      brand,
      category,
      gender,
      capacity,
      expirationDate,
      barcode,
      image,
      priceBs: Number(priceBs),
      units: Number(units),
      wholesalePrice: Number(wholesalePrice),
      sellingPrice: Number(sellingPrice),
      totalPrice,
    }, updatePricesAllStores);

    resetForm();
  };

  const currentTotal = priceBs !== '' && units !== ''
    ? (Number(priceBs) * Number(units)).toFixed(2)
    : '0.00';

  const filteredProducts = globalProducts.filter(p =>
    p.name.toLowerCase().includes(name.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(name.toLowerCase()))
  ).slice(0, 5); // Limit to top 5 results

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          {editingProduct ? (
            <>
              <Save className="h-5 w-5 text-teal-600" />
              Editar Producto
            </>
          ) : (
            <>
              <Plus className="h-5 w-5 text-primary-600" />
              Agregar Nuevo Producto
            </>
          )}
        </h2>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Imagen */}
        <div className="col-span-1 md:col-span-2 lg:col-span-4 flex gap-4 items-start">
          <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
            {image ? (
              <img src={image} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="h-8 w-8 text-gray-400" />
            )}
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Imagen del Producto</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
          </div>
        </div>

        {/* Código de Barras */}
        <div className="col-span-1">
          <label htmlFor="prod-barcode" className="block text-sm font-medium text-gray-700 mb-1">Código (SKU/Balanza)</label>
          <input
            id="prod-barcode"
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            className="w-full px-3 py-2 border border-blue-100 bg-blue-50/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Ej. CERA-100"
          />
        </div>

        {/* Nombre, Marca, Categoría */}
        <div className="col-span-1 md:col-span-1 lg:col-span-3 relative">
          <label htmlFor="prod-name" className="block text-sm font-medium text-gray-700 mb-1">Nombre del Producto</label>
          <input
            id="prod-name"
            type="text"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!editingProduct) setShowProductSearch(true);
            }}
            onFocus={() => { if (!editingProduct) setShowProductSearch(true); }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Busca por nombre o código..."
          />
          {!editingProduct && showProductSearch && name && (
            <>
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 shadow-xl rounded-md overflow-hidden">
                {filteredProducts.length > 0 ? (
                  <ul className="max-h-60 overflow-y-auto">
                    {filteredProducts.map(p => (
                      <li
                        key={p.id}
                        onClick={() => handleSelectExistingProduct(p)}
                        className="px-4 py-2 hover:bg-teal-50 cursor-pointer flex items-center gap-3 border-b border-gray-50 last:border-0"
                      >
                        {p.image ? (
                          <img src={p.image} className="w-8 h-8 rounded object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900 line-clamp-1">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.brand || 'Sin marca'} {p.capacity ? `· ${p.capacity}` : ''}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-4 py-3 text-sm text-gray-500">No se encontraron productos similares.</div>
                )}
              </div>
              <div className="fixed inset-0 z-40" onClick={() => setShowProductSearch(false)} />
            </>
          )}
        </div>

        <div className="col-span-1">
          <label htmlFor="prod-brand" className="block text-sm font-medium text-gray-700 mb-1">Marca (Opcional)</label>
          <input
            id="prod-brand"
            type="text"
            list="brands-list"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Ej. Carolina Herrera"
          />
          <datalist id="brands-list">
            {existingBrands.map((b, idx) => (
              <option key={idx} value={b} />
            ))}
          </datalist>
        </div>

        <div className="col-span-1">
          <label htmlFor="prod-category" className="block text-sm font-medium text-gray-700 mb-1">Categoría (Opcional)</label>
          <input
            id="prod-category"
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Ej. EDP, EDT, Splash"
          />
        </div>

        <div className="col-span-1">
          <label htmlFor="prod-gender" className="block text-sm font-medium text-gray-700 mb-1">Público / Género</label>
          <select
            id="prod-gender"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Seleccionar...</option>
            <option value="Mujer">Mujer</option>
            <option value="Varón">Varón</option>
            <option value="Unisex">Unisex</option>
          </select>
        </div>

        <div className="col-span-1">
          <label htmlFor="prod-capacity" className="block text-sm font-medium text-gray-700 mb-1">Presentación (ml/g)</label>
          <input
            id="prod-capacity"
            type="text"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Ej. 236ml"
          />
        </div>

        <div className="col-span-1 md:col-span-2 lg:col-span-4">
          <div className="w-full sm:w-1/4">
            <label htmlFor="prod-expiration" className="block text-sm font-medium text-gray-700 mb-1">Vencimiento (Opcional)</label>
            <input
              id="prod-expiration"
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>
        </div>

        <div className="col-span-1 md:col-span-4 lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 border-t border-gray-100 pt-4">
          <div className="col-span-1">
            <label htmlFor="prod-units" className="block text-sm font-medium text-gray-700 mb-1">Unidades</label>
            <input
              id="prod-units"
              type="number"
              min="1"
              required
              value={units}
              onChange={(e) => setUnits(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="col-span-1">
            <label htmlFor="prod-price-bs" className="block text-sm font-medium text-gray-700 mb-1">Precio Compra (Bs)</label>
            <input
              id="prod-price-bs"
              type="number"
              step="0.01"
              required
              value={priceBs}
              onChange={(e) => setPriceBs(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="col-span-1">
            <label htmlFor="prod-price-mayor" className="block text-sm font-medium text-gray-700 mb-1">Precio x Mayor</label>
            <input
              id="prod-price-mayor"
              type="number"
              step="0.01"
              required
              value={wholesalePrice}
              onChange={(e) => setWholesalePrice(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="col-span-1">
            <label htmlFor="prod-price-unidad" className="block text-sm font-medium text-gray-700 mb-1">Precio Unidad</label>
            <input
              id="prod-price-unidad"
              type="number"
              step="0.01"
              required
              value={sellingPrice}
              onChange={(e) => setSellingPrice(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {editingProduct && (
          <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-2 mb-2 p-3 bg-teal-50 rounded-lg border border-teal-100 flex items-start gap-3">
            <div className="flex items-center h-5">
              <input
                id="update-prices-all-stores"
                type="checkbox"
                checked={updatePricesAllStores}
                onChange={(e) => setUpdatePricesAllStores(e.target.checked)}
                className="w-4 h-4 text-teal-600 bg-white border-gray-300 rounded focus:ring-teal-500"
              />
            </div>
            <div className="text-sm">
              <label htmlFor="update-prices-all-stores" className="font-medium text-teal-900 cursor-pointer">
                Actualizar precios en todas las sucursales
              </label>
              <p className="text-teal-700 mt-1">
                Si marcas esto, los nuevos precios de venta reemplazarán los precios en todas las tiendas donde haya stock de este producto.
                Si lo dejas desmarcado, los precios solo se actualizarán en Bodega y se respetarán los precios personalizados de otras tiendas.
                (Nota: Las etiquetas y fotos siempre se actualizarán en todas las tiendas).
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="text-sm">
          <span className="text-gray-500">Costo Total del Lote: </span>
          <span className="text-lg font-bold text-gray-900">Bs. {currentTotal}</span>
        </div>

        <div className="flex gap-2">
          {editingProduct && onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
          )}
          <button
            type="submit"
            className={`px-6 py-2 rounded-lg font-medium transition-colors text-white ${editingProduct ? 'bg-teal-600 hover:bg-teal-700' : 'bg-primary-600 hover:bg-primary-700'}`}
          >
            {editingProduct ? 'Actualizar Producto' : 'Guardar Producto'}
          </button>
        </div>
      </div>
    </form>
  );
}