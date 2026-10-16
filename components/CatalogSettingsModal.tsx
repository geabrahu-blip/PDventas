import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { getCatalogConfig, updateCatalogConfig } from '../services/db';
import { useInventory } from '../context/InventoryContext';

interface CatalogSettingsModalProps {
  onClose: () => void;
}

export const CatalogSettingsModal = ({ onClose }: CatalogSettingsModalProps) => {
  const { inventory } = useInventory();
  const [brands, setBrands] = useState<string[]>([]);
  const [newBrand, setNewBrand] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const existingBrands = useMemo(() => {
    const items = inventory || [];
    const uniqueBrands = new Set(items.map(i => i.brand).filter(b => !!b) as string[]);
    return Array.from(uniqueBrands).sort();
  }, [inventory]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const config = await getCatalogConfig();
        setBrands(config.featuredBrands || []);
      } catch (err) {
        console.error("Error loading config:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleAddBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (newBrand.trim() && !brands.includes(newBrand.trim())) {
      setBrands([...brands, newBrand.trim()]);
      setNewBrand('');
    }
  };

  const handleRemoveBrand = (index: number) => {
    setBrands(brands.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateCatalogConfig(brands);
      onClose();
    } catch (err) {
      console.error("Error saving config:", err);
      alert("Error al guardar la configuración");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Configuración del Catálogo</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Marcas Destacadas en Carruseles</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Agrega las marcas exactas que quieres mostrar en los carruseles principales del catálogo público. El orden importa.
                </p>

                <form onSubmit={handleAddBrand} className="flex gap-2 mb-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      list="config-brands-list"
                      value={newBrand}
                      onChange={(e) => setNewBrand(e.target.value)}
                      placeholder="Selecciona o escribe una marca (Ej: Lattafa)"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                    <datalist id="config-brands-list">
                      {existingBrands.map((b, idx) => (
                        <option key={idx} value={b} />
                      ))}
                    </datalist>
                  </div>
                  <button
                    type="submit"
                    disabled={!newBrand.trim()}
                    className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Agregar
                  </button>
                </form>

                <ul className="space-y-2">
                  {brands.map((brand, index) => (
                    <li key={index} className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg">
                      <span className="text-sm font-medium text-slate-700">{brand}</span>
                      <button
                        onClick={() => handleRemoveBrand(index)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                  {brands.length === 0 && (
                    <p className="text-xs text-slate-500 italic text-center py-4">No hay marcas destacadas configuradas.</p>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="px-5 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};
