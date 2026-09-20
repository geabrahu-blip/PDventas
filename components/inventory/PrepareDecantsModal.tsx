import React, { useState } from 'react';
import { InventoryItem } from '../../types';
import { X, Beaker, CheckCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface PrepareDecantsModalProps {
  product: InventoryItem;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { count5ml: number; count10ml: number; count30ml: number }) => Promise<void>;
}

export default function PrepareDecantsModal({ product, isOpen, onClose, onConfirm }: PrepareDecantsModalProps) {
  const { showToast } = useToast();
  const [count5ml, setCount5ml] = useState(0);
  const [count10ml, setCount10ml] = useState(0);
  const [count30ml, setCount30ml] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Extract numeric capacity from strings like '100 ml'
  const capacityMatch = product.capacity?.match(/(\d+)/);
  const capacityMl = capacityMatch ? parseInt(capacityMatch[0], 10) : 0;

  const currentRemaining = product.openedBottle?.remainingMl || 0;
  const totalAvailableMl = capacityMl + currentRemaining; // Opening 1 new bottle + current opened bottle

  const mlToUse = (count5ml * 5) + (count10ml * 10) + (count30ml * 30);
  const remainingAfterPreparation = totalAvailableMl - mlToUse;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (product.units < 1 && currentRemaining < mlToUse) {
      showToast('No hay stock de botellas selladas para abrir.', 'error');
      return;
    }

    if (capacityMl === 0 && currentRemaining === 0) {
      showToast('El producto no tiene una capacidad válida en ml.', 'error');
      return;
    }

    if (mlToUse === 0) {
      showToast('Debes preparar al menos 1 decant.', 'error');
      return;
    }

    if (remainingAfterPreparation < 0) {
      showToast('No hay suficientes mililitros para esa cantidad de decants.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm({ count5ml, count10ml, count30ml });
      setCount5ml(0);
      setCount10ml(0);
      setCount30ml(0);
      onClose();
    } catch (error) {
      console.error(error);
      showToast('Error al preparar decants', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-teal-100 text-teal-600 rounded-lg">
              <Beaker className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Preparar Decants</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <div className="mb-4 text-sm text-gray-600">
            Producto: <span className="font-semibold text-gray-900">{product.name}</span>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800 mb-6">
            Al confirmar, se abrirá <strong>1 botella sellada ({capacityMl}ml)</strong>.
            El remanente actual es <strong>{currentRemaining}ml</strong>.
            Total disponible para usar: <strong>{totalAvailableMl}ml</strong>.
          </div>

          <form id="decants-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
              <div>
                <span className="block font-medium text-gray-900">Decants 5ml</span>
                <span className="text-xs text-gray-500">Stock actual: {product.decants?.['5ml']?.stock || 0}</span>
              </div>
              <input
                type="number"
                min="0"
                value={count5ml}
                onChange={(e) => setCount5ml(parseInt(e.target.value) || 0)}
                className="w-20 text-center border border-gray-300 rounded-lg py-1 px-2"
              />
            </div>
            <div className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
              <div>
                <span className="block font-medium text-gray-900">Decants 10ml</span>
                <span className="text-xs text-gray-500">Stock actual: {product.decants?.['10ml']?.stock || 0}</span>
              </div>
              <input
                type="number"
                min="0"
                value={count10ml}
                onChange={(e) => setCount10ml(parseInt(e.target.value) || 0)}
                className="w-20 text-center border border-gray-300 rounded-lg py-1 px-2"
              />
            </div>
            <div className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
              <div>
                <span className="block font-medium text-gray-900">Decants 30ml</span>
                <span className="text-xs text-gray-500">Stock actual: {product.decants?.['30ml']?.stock || 0}</span>
              </div>
              <input
                type="number"
                min="0"
                value={count30ml}
                onChange={(e) => setCount30ml(parseInt(e.target.value) || 0)}
                className="w-20 text-center border border-gray-300 rounded-lg py-1 px-2"
              />
            </div>
          </form>

          <div className="mt-6 border-t border-gray-100 pt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Mililitros a utilizar:</span>
              <span className="font-semibold text-gray-900">{mlToUse}ml</span>
            </div>
            <div className={`flex justify-between text-sm ${remainingAfterPreparation < 0 ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
              <span>Mililitros que quedarán (Frasco abierto):</span>
              <span>{remainingAfterPreparation}ml</span>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="decants-form"
            disabled={isSubmitting || remainingAfterPreparation < 0 || mlToUse === 0}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            {isSubmitting ? 'Procesando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}