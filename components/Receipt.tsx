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
            html, body, #root {
              height: auto !important;
              min-height: auto !important;
              overflow: visible !important;
              background: white !important;
            }
            @page {
              size: 58mm auto;
              margin: 0mm !important;
            }
            #receipt-print-zone {
              display: block !important;
              width: 52mm !important; /* Ancho imprimible real */
              color: black !important;
            }
          }
        `}
      </style>
      <div id="receipt-print-zone" className="hidden print:block print:absolute print:top-0 print:left-0 print:w-[52mm] print:text-black print:bg-white print:m-0 font-mono text-[12px] leading-tight mx-auto p-2">
        {/* Header */}
        <div className="text-center mb-2 border-b border-black border-dashed pb-2">
          <h1 className="text-sm font-bold tracking-widest">PIEL DIVINA</h1>
          <p className="text-[10px] mt-1">Nota de Venta</p>
          <p className="text-[9px] text-black mt-1">
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

        {/* Items Table */}
        <table className="w-full text-left mb-2 text-[10px]">
          <thead className="border-b border-black border-dashed">
            <tr>
              <th className="py-1 w-1/6">C.</th>
              <th className="py-1 w-3/6">Prod.</th>
              <th className="py-1 text-right w-2/6">Subt.</th>
            </tr>
          </thead>
          <tbody className="border-b border-black border-dashed">
            {data.items.map((item, idx) => (
              <tr key={idx} className="align-top">
                <td className="py-1">{item.quantity}</td>
                <td className="py-1 pr-1" style={{ wordBreak: 'break-word', overflowWrap: 'break-word', maxWidth: '28mm' }}>
                  {item.product.name}
                  <div className="text-[8px] text-black mt-0.5">Bs. {item.product.sellingPrice} c/u</div>
                </td>
                <td className="py-1 text-right font-bold whitespace-nowrap">Bs. {item.subtotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mb-2">
          {data.globalDiscount > 0 && (
            <>
              <div className="flex justify-between items-center mb-0.5 text-[10px]">
                <span>Subtotal:</span>
                <span>Bs. {data.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center mb-1 text-[10px]">
                <span>Desc.:</span>
                <span>- Bs. {data.globalDiscount.toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-center">
            <span className="font-bold text-[11px]">TOTAL:</span>
            <span className="font-black text-[13px]">Bs. {data.total.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex justify-between items-center text-[9px] mb-4 border-t border-black border-dashed pt-1">
          <span className="">Pago:</span>
          <span className="font-bold uppercase">{data.paymentMethod === 'Cash' ? 'Efectivo' : 'QR'}</span>
        </div>

        {/* Footer */}
        <div className="text-center mt-4">
          <p className="font-bold text-[10px]">¡Gracias por su compra!</p>
          <p className="text-[9px] mt-1">Vuelva pronto</p>
          <p className="text-[8px] mt-2 mb-4">.</p>
        </div>
      </div>
    </>
  );
};

export default Receipt;