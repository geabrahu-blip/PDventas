import React, { useState } from 'react';
import { InventoryItem } from '../../types';
import { Droplet, X } from 'lucide-react';

interface PrepareDecantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: InventoryItem | null;
  onConfirm: (d5: number, d10: number, d30: number) => Promise<void>;
}

export default function PrepareDecantsModal({ isOpen, onClose, product, onConfirm }: PrepareDecantsModalProps) {
  const [d5, setD5] = useState<number | ''>('');
  const [d10, setD10] = useState<number | ''>('');
  const [d30, setD30] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !product) return null;

  const totalMlNeeded = (Number(d5 || 0) * 5) + (Number(d10 || 0) * 10) + (Number(d30 || 0) * 30);
  const currentOpenedMl = product.openedBottleMl || 0;

  // Try to parse capacity (e.g. "100ml" or "100 ml" -> 100)
  const capacityMatch = product.capacity?.match(/\d+/);
  const bottleCapacity = capacityMatch ? parseInt(capacityMatch[0], 10) : 0;

  let bottlesToOpen = 0;
  let remainingAfterOpen = currentOpenedMl;

  if (totalMlNeeded > currentOpenedMl) {
    if (bottleCapacity > 0) {
      const deficit = totalMlNeeded - currentOpenedMl;
      bottlesToOpen = Math.ceil(deficit / bottleCapacity);
      remainingAfterOpen = (currentOpenedMl + (bottlesToOpen * bottleCapacity)) - totalMlNeeded;
    }
  } else {
    remainingAfterOpen = currentOpenedMl - totalMlNeeded;
  }

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!d5 && !d10 && !d30) return;
    setIsSubmitting(true);
    try {
      await onConfirm(Number(d5 || 0), Number(d10 || 0), Number(d30 || 0));
      onClose();
      setD5(''); setD10(''); setD30('');
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  const isInvalid = bottleCapacity === 0 && totalMlNeeded > currentOpenedMl;
  const insufficientStock = bottlesToOpen > product.units;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-teal-50">
          <h2 className="text-xl font-semibold text-teal-900 flex items-center gap-2">
            <Droplet className="w-5 h-5 text-teal-600" />
            Preparar Decants
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-6 space-y-5">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <p className="font-semibold text-gray-900">{product.name}</p>
            <div className="flex justify-between mt-2 text-sm">
              <span className="text-gray-600">Botellas selladas: <strong className="text-gray-900">{product.units}</strong></span>
              <span className="text-gray-600">Capacidad: <strong className="text-gray-900">{bottleCapacity ? `${bottleCapacity}ml` : 'Inválida'}</strong></span>
            </div>
            <div className="flex justify-between mt-1 text-sm">
              <span className="text-gray-600">Líquido abierto actual:</span>
              <strong className="text-yellow-600">{currentOpenedMl}ml</strong>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">¿Cuántos decants vas a preparar ahora?</label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Decants 5ml</label>
                <input
                  type="number"
                  min="0"
                  value={d5}
                  onChange={(e) => setD5(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Decants 10ml</label>
                <input
                  type="number"
                  min="0"
                  value={d10}
                  onChange={(e) => setD10(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Decants 30ml</label>
                <input
                  type="number"
                  min="0"
                  value={d30}
                  onChange={(e) => setD30(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-lg border ${insufficientStock || isInvalid ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
            <h4 className="text-sm font-semibold mb-2 flex items-center justify-between">
              Resumen de Operación
              <span className="text-xs font-normal">Requiere: {totalMlNeeded}ml</span>
            </h4>
            <ul className="text-sm space-y-1">
              <li className="flex justify-between">
                <span>Botellas nuevas a abrir:</span>
                <strong className={bottlesToOpen > 0 ? 'text-blue-700' : ''}>{bottlesToOpen}</strong>
              </li>
              <li className="flex justify-between">
                <span>Líquido sobrante:</span>
                <strong>{remainingAfterOpen}ml</strong>
              </li>
            </ul>
            {insufficientStock && (
              <p className="text-xs text-red-600 mt-2 font-medium">
                No tienes suficientes botellas selladas para abrir ({bottlesToOpen} requeridas, {product.units} disponibles).
              </p>
            )}
            {isInvalid && (
              <p className="text-xs text-red-600 mt-2 font-medium">
                La capacidad de este perfume no es válida. Asegúrate de que el campo "Presentación" (ej. 100ml) contenga un número en la edición del producto.
              </p>
            )}
          </div>

          <div className="pt-4 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || totalMlNeeded === 0 || isInvalid || insufficientStock}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Procesando...' : 'Confirmar Preparación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
