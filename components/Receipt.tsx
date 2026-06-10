import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const node = document.createElement('div');
    node.id = 'printable-receipt-portal';
    // Ensure it's hidden on screen, but visible when printing overrides happen
    node.className = 'hidden print:block';
    document.body.appendChild(node);
    setPortalNode(node);

    return () => {
      if (document.body.contains(node)) {
        document.body.removeChild(node);
      }
    };
  }, []);

  if (!data || !portalNode) return null;

  return createPortal(
    <>
      <style>
        {`
@media print {
  /* Ocultamos absolutamente TODA la app de React */
  #root {
    display: none !important;
  }
  /* Hacemos visible ÚNICAMENTE el portal del ticket */
  #printable-receipt-portal {
    display: block !important;
    width: 58mm !important;
    margin: 0 !important;
    padding: 0 !important;
    background: white;
  }
  @page {
    size: 58mm auto;
    margin: 0;
  }
}
        `}
      </style>
      <div className="text-[11px] font-mono text-black w-[58mm] p-2">
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
    </>,
    portalNode
  );
};

export default Receipt;