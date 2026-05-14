import React from 'react';
import { Sale } from '../types';
import { Printer } from 'lucide-react';

interface ReceiptModalProps {
  sale: Sale | null;
  onClose: () => void;
  getStoreName: (storeId: string) => string;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, onClose, getStoreName }) => {
  if (!sale) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 print:p-0 print:bg-white">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md print:shadow-none print:max-w-none">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center print:hidden">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Printer className="w-5 h-5 text-teal-600" />
            Comprobante de Venta
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            &times;
          </button>
        </div>

        <div className="p-6 text-sm text-gray-800" id="printable-receipt">
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold uppercase mb-1">Piel Divina</h3>
            <p className="text-xs text-gray-500 uppercase">{getStoreName(sale.storeId)}</p>
            <div className="border-b border-dashed border-gray-400 my-4"></div>
            <h4 className="font-bold uppercase tracking-wider mb-2">Comprobante de Venta</h4>
          </div>

          <div className="mb-4 space-y-1">
            <div className="flex justify-between">
              <span className="font-semibold">Fecha:</span>
              <span>{new Date(sale.date).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Cliente:</span>
              <span className="uppercase">{sale.clientName || 'Cliente Genérico'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Atendido por:</span>
              <span className="uppercase">Vendedor</span>
            </div>
          </div>

          <div className="border-b border-dashed border-gray-400 my-4"></div>

          <table className="w-full mb-4">
            <thead>
              <tr className="text-left border-b border-gray-200">
                <th className="pb-2 font-semibold w-12">Cant.</th>
                <th className="pb-2 font-semibold">Descripción</th>
                <th className="pb-2 font-semibold text-right">P. Unit</th>
                <th className="pb-2 font-semibold text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100 last:border-0">
                  <td className="py-2">{item.quantity}</td>
                  <td className="py-2 pr-2">{item.name}</td>
                  <td className="py-2 text-right">{item.price.toFixed(2)}</td>
                  <td className="py-2 text-right">{(item.price * item.quantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-b border-dashed border-gray-400 my-4"></div>

          {sale.globalDiscount && sale.globalDiscount > 0 ? (
            <div className="mb-4">
              <div className="flex justify-between font-medium text-gray-600 mb-1">
                <span>Subtotal:</span>
                <span>Bs. {(sale.total + sale.globalDiscount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-medium text-red-500 mb-1">
                <span>Descuento:</span>
                <span>- Bs. {sale.globalDiscount.toFixed(2)}</span>
              </div>
            </div>
          ) : null}

          <div className="flex justify-between items-center text-lg font-bold mb-6">
            <span>TOTAL A PAGAR:</span>
            <span>Bs. {sale.total.toFixed(2)}</span>
          </div>

          <div className="text-center text-xs text-gray-500 mb-2">
            <p>Método de pago: <span className="uppercase font-semibold">{sale.paymentMethod}</span></p>
          </div>

          <div className="text-center text-xs text-gray-500 mt-6">
            <p>¡GRACIAS POR SU COMPRA!</p>
            <p>VUELVA PRONTO</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cerrar
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
