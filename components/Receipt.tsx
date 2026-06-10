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
    <>
      <style>
        {`
@media print {
  body * {
    visibility: hidden;
  }
  #receipt-print-zone, #receipt-print-zone * {
    visibility: visible;
  }
  #receipt-print-zone {
    position: absolute;
    left: 0;
    top: 0;
    width: 58mm;
    margin: 0;
    padding: 0;
  }
  @page {
    size: 58mm auto;
    margin: 0;
  }
}
        `}
      </style>
      <div id="receipt-print-zone" className="text-[11px] font-mono text-black w-[58mm] p-2">
        {/* Header */}
        <div className="text-center">
          <h1 className="font-bold text-sm">PIEL DIVINA</h1>
          <p className="">Cuidado Facial</p>
          <p className="mt-1">
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
        <div className="mb-2 text-[10px]">
          <p className="font-bold">
            <span className="font-normal">Cliente: </span>
            {data.clientName || 'Cliente Ocasional'}
          </p>
        </div>

        {/* Items List */}
        <div className="border-t border-dashed border-black my-2 pt-2">
          {data.items.map((item, idx) => (
            <div key={idx} className="mb-2">
              <div className="text-slate-800 font-medium">
                {item.product.name}
              </div>
              <div className="flex justify-between">
                <span>Cant: {item.quantity}</span>
                <span>Bs. {item.subtotal.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t border-dashed border-black my-2 pt-2">
          {data.globalDiscount > 0 && (
            <>
              <div className="flex justify-between mb-1">
                <span>Subtotal:</span>
                <span>Bs. {data.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span>Descuento Global:</span>
                <span>- Bs. {data.globalDiscount.toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-center mb-1">
            <span className="font-bold text-[13px]">TOTAL A PAGAR:</span>
            <span className="font-bold text-[13px]">Bs. {data.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-dashed border-black my-2 pt-2 text-center mt-4">
          <p>¡Gracias por tu compra!</p>
          <p className="mt-2 mb-4">.</p>
        </div>
      </div>
    </>
  );
};

export default Receipt;