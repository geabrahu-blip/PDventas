import React from 'react';
import { InventoryItem } from '../types';

export interface ReceiptData {
  items: { product: InventoryItem; quantity: number; subtotal: number }[];
  subtotal: number;
  total: number;
  globalDiscount: number;
  clientName: string;
  paymentMethod: 'Cash' | 'QR';
  date: Date;
}

interface ReceiptProps {
  data: ReceiptData | null;
}

const Receipt: React.FC<ReceiptProps> = ({ data }) => {
  if (!data) return null;

  return (
    <div className="hidden print:block print:w-[80mm] print:mx-auto print:bg-white print:text-black print:text-[12px] print:font-mono p-4">
      {/* Header */}
      <div className="text-center mb-4 border-b border-black border-dashed pb-4">
        <h1 className="text-lg font-bold tracking-widest">PIEL DIVINA</h1>
        <p className="text-sm mt-1">Nota de Venta</p>
        <p className="text-[10px] text-gray-700 mt-1">
          {data.date.toLocaleString('es-BO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>

      {/* Client Info */}
      <div className="mb-4">
        <p className="font-bold">
          <span className="font-normal text-gray-700">Cliente: </span>
          {data.clientName || 'Cliente Ocasional'}
        </p>
      </div>

      {/* Items Table */}
      <table className="w-full text-left mb-4">
        <thead className="border-b border-black border-dashed">
          <tr>
            <th className="py-1 w-1/6">Cant.</th>
            <th className="py-1 w-1/2">Producto</th>
            <th className="py-1 text-right w-1/3">Subtotal</th>
          </tr>
        </thead>
        <tbody className="border-b border-black border-dashed">
          {data.items.map((item, idx) => (
            <tr key={idx} className="align-top">
              <td className="py-1">{item.quantity}</td>
              <td className="py-1 pr-1 truncate max-w-[40mm]">
                {item.product.name}
                <div className="text-[9px] text-gray-600">Bs. {item.product.sellingPrice} c/u</div>
              </td>
              <td className="py-1 text-right font-medium">Bs. {item.subtotal.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      {data.globalDiscount > 0 && (
        <>
          <div className="flex justify-between items-center mb-1 text-sm">
            <span>Subtotal:</span>
            <span>Bs. {data.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center mb-2 text-sm">
            <span>Descuento Global:</span>
            <span>- Bs. {data.globalDiscount.toFixed(2)}</span>
          </div>
        </>
      )}
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold text-sm">TOTAL:</span>
        <span className="font-black text-lg">Bs. {data.total.toFixed(2)}</span>
      </div>

      <div className="flex justify-between items-center text-[10px] mb-6 border-t border-black border-dashed pt-2">
        <span className="text-gray-700">Método de Pago:</span>
        <span className="font-bold uppercase">{data.paymentMethod === 'Cash' ? 'Efectivo' : 'QR'}</span>
      </div>

      {/* Footer */}
      <div className="text-center mt-8">
        <p className="font-bold italic">¡Gracias por su compra!</p>
        <p className="text-[10px] text-gray-600 mt-2">Vuelva pronto</p>
      </div>
    </div>
  );
};

export default Receipt;