export interface PrintSaleData {
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  discount: number;
  total: number;
  date?: Date;
}

export const printReceipt = (saleData: PrintSaleData) => {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Recibo Piel Divina</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body {
            font-family: monospace;
            margin: 0;
            padding: 0;
            color: black;
            font-size: 12px;
            display: flex;
            justify-content: center;
          }
          .receipt {
            width: 72mm; /* Margen de seguridad para 78mm-80mm */
            margin: 0 auto;
            padding: 2mm;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .flex-between { display: flex; justify-content: space-between; }
          .divider { border-bottom: 1px dashed black; margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="receipt">
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
        </div>
      </body>
    </html>
  `;

  if (isMobile) {
    // Para móviles, intentamos abrir una nueva ventana o pestaña con el HTML.
    // Esto previene el bug de Android donde se imprime la pantalla principal en vez del Iframe.
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Cerrar la ventana tan pronto termine de imprimir o cancele el diálogo
      printWindow.onafterprint = () => {
        printWindow.close();
      };

      // Permitir renderizado
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 500);
    } else {
      // Fallback si el navegador bloquea los popups en móvil:
      // Inyectamos un iframe visible pero fuera del área visible usando z-index o posicionamiento.
      // Ocultar la visibilidad usando position fixed previene que interfiera visualmente
      // pero permite al navegador imprimir el iframe.
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1000);
        }, 500);
      }
    }
  } else {
    // Comportamiento original para escritorio
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

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
  }
};