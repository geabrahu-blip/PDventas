export interface PrintSaleData {
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  discount: number;
  total: number;
  date?: Date;
}

export const printReceipt = (saleData: PrintSaleData) => {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Recibo Piel Divina</title>
        <style>
          @page { size: 58mm auto; margin: 0; }
          body {
            font-family: monospace;
            width: 52mm; /* Margen de seguridad para 58mm */
            margin: 0;
            padding: 2mm;
            color: black;
            font-size: 11px;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .flex-between { display: flex; justify-content: space-between; }
          .divider { border-bottom: 1px dashed black; margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size: 14px;">PIEL DIVINA</div>
        <div class="center">Cuidado Facial</div>
        <div class="center">${(saleData.date || new Date()).toLocaleString('es-BO', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</div>
        <div class="divider"></div>

        ${saleData.items.map(item => `
          <div>${item.name}</div>
          <div class="flex-between">
            <span>Cant: ${item.quantity}</span>
            <span>Bs. ${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        `).join('')}

        <div class="divider"></div>
        <div class="flex-between">
          <span>Subtotal:</span>
          <span>Bs. ${saleData.subtotal.toFixed(2)}</span>
        </div>
        ${saleData.discount > 0 ? `
        <div class="flex-between">
          <span>Descuento:</span>
          <span>- Bs. ${saleData.discount.toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="divider"></div>
        <div class="flex-between bold" style="font-size: 13px;">
          <span>TOTAL:</span>
          <span>Bs. ${saleData.total.toFixed(2)}</span>
        </div>
        <div class="divider"></div>
        <div class="center">¡Gracias por tu compra!</div>
      </body>
    </html>
  `;

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Allow time for rendering before calling print
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();

      // Clean up iframe after printing dialogue is handled
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 300);
  } else {
    // Fallback if iframe fails to initialize
    if (document.body.contains(iframe)) {
       document.body.removeChild(iframe);
    }
  }
};