import { useState, useEffect } from 'react';
import { Product, InventoryItem } from '../types';
import { Image as ImageIcon, Plus, Save, X, Search } from 'lucide-react';
import { getInventoryItems } from '../services/db';
import imageCompression from 'browser-image-compression';
import { useToast } from '../context/ToastContext';

interface ProductFormProps {
  onAdd: (product: Omit<Product, 'id'>) => void;
  editingProduct?: Product;
  onCancelEdit?: () => void;
}

export default function ProductForm({ onAdd, editingProduct, onCancelEdit }: ProductFormProps) {
  const { showToast } = useToast();
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

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Autocomplete State
  const [existingBrands, setExistingBrands] = useState<string[]>([]);
  const [globalProducts, setGlobalProducts] = useState<InventoryItem[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);

  useEffect(() => {
    // Load existing data for autocompletion
    getInventoryItems().then(items => {
      // Create a unique list of products based on name+brand+capacity
      const uniqueProducts: InventoryItem[] = [];
      const seen = new Set();

      for (const item of items) {
        const key = `${item.name.toLowerCase()}-${(item.brand || '').toLowerCase()}-${(item.capacity || '').toLowerCase()}`;
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
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const options = {
          maxSizeMB: 0.15, // max 150kb
          maxWidthOrHeight: 600,
          useWebWorker: true,
          fileType: 'image/webp',
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

    if (!name) {
      showToast('El nombre del producto es obligatorio', 'error');
      return;
    }
    if (units === '') {
      showToast('La cantidad de unidades es obligatoria', 'error');
      return;
    }
    if (priceBs === '') {
      showToast('El precio de compra es obligatorio', 'error');
      return;
    }
    if (wholesalePrice === '') {
      showToast('El precio por mayor es obligatorio', 'error');
      return;
    }
    if (sellingPrice === '') {
      showToast('El precio por unidad es obligatorio', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
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
      });

      if (!editingProduct) {
        resetForm();
      }
    } catch (error: any) {
      console.error('Error submitting form:', error);
      showToast(error.message || 'Error inesperado al guardar el producto.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentTotal = priceBs !== '' && units !== ''
    ? (Number(priceBs) * Number(units)).toFixed(2)
    : '0.00';

  const filteredProducts = globalProducts.filter(p =>
    p.name.toLowerCase().includes(name.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(name.toLowerCase()))
  ).slice(0, 5); // Limit to top 5 results

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-none md:rounded-2xl border-0 md:border border-gray-200 p-4 md:p-6 space-y-6 relative min-h-screen md:min-h-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          {editingProduct ? (
            <>
              <Save className="h-5 w-5 text-teal-600" />
              Editar Producto
            </>
          ) : (
            <>
              <Plus className="h-5 w-5 text-teal-600" />
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
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
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
            className="w-full px-3 py-2 border border-blue-100 bg-blue-50/50 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Ej. CeraVe, The Ordinary, La Roche-Posay"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Ej. Suero, Crema Hidratante, Protector Solar, Limpiador"
          />
        </div>

        <div className="col-span-1">
          <label htmlFor="prod-gender" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Piel</label>
          <select
            id="prod-gender"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">Seleccionar...</option>
            <option value="Todo tipo de piel">Todo tipo de piel</option>
            <option value="Piel Grasa">Piel Grasa</option>
            <option value="Piel Seca">Piel Seca</option>
            <option value="Piel Mixta">Piel Mixta</option>
            <option value="Piel Sensible">Piel Sensible</option>
            <option value="Piel con manchas">Piel con manchas</option>
          </select>
        </div>

        <div className="col-span-1">
          <label htmlFor="prod-capacity" className="block text-sm font-medium text-gray-700 mb-1">Presentación (ml/g)</label>
          <input
            id="prod-capacity"
            type="text"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Ej. 30ml, 50ml"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            />
          </div>
        </div>

        <div className="col-span-1 md:col-span-2 lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 border-t border-gray-100 pt-4">
          <div className="col-span-1">
            <label htmlFor="prod-units" className="block text-sm font-medium text-gray-700 mb-1">Unidades</label>
            <input
              id="prod-units"
              type="number"
              min="1"
              required
              value={units}
              onChange={(e) => setUnits(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
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
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 rounded-lg font-medium transition-colors text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting
              ? (editingProduct ? 'Actualizando...' : 'Guardando...')
              : (editingProduct ? 'Actualizar Producto' : 'Guardar Producto')}
          </button>
        </div>
      </div>
    </form>
  );
}