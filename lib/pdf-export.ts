export interface PdfExportItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface PdfExportMetadata {
  storeName: string;
  storeCode?: string;
  storeCity?: string;
  referenceMonth: string;
  totalItems: number;
  totalAmount: number;
  items: PdfExportItem[];
}

function toWinAnsiHex(text: string): string {
  let hex = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // WinAnsiEncoding compartilha 0x20..0xFF com ISO-8859-1 para caracteres do português
    const byte = code >= 32 && code <= 255 ? code : 63; // '?' fallback
    hex += byte.toString(16).padStart(2, "0").toUpperCase();
  }
  return `<${hex}>`;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
    .format(Number.isFinite(value) ? value : 0)
    .replace(/\u00A0/g, " ");
}

function truncateText(text: string, maxChars: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  return clean.slice(0, maxChars - 3) + "...";
}

/**
 * Gera um arquivo PDF 1.4 válido (A4 retrato) com cabeçalho, tabela estilizada
 * de itens do pedido e rodapé consolidado, iniciando o download automaticamente no navegador.
 */
export function downloadOrderItemsPdf(meta: PdfExportMetadata): void {
  const pdfBytes = generateOrderItemsPdfBytes(meta);
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);

  const safeStore = meta.storeName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .toLowerCase();
  const monthSlug = meta.referenceMonth.slice(0, 7);

  const link = document.createElement("a");
  link.href = url;
  link.download = `itens-pedido-${safeStore}-${monthSlug}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function generateOrderItemsPdfBytes(
  meta: PdfExportMetadata
): Uint8Array {
  const pageWidth = 595.28; // A4 width pt
  const pageHeight = 841.89; // A4 height pt
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2;
  const rowsPerPage = 24;

  const itemChunks: PdfExportItem[][] = [];
  if (meta.items.length === 0) {
    itemChunks.push([]);
  } else {
    for (let i = 0; i < meta.items.length; i += rowsPerPage) {
      itemChunks.push(meta.items.slice(i, i + rowsPerPage));
    }
  }

  const pageStreams: string[] = [];

  itemChunks.forEach((chunk, pageIndex) => {
    const ops: string[] = [];

    // Faixa superior Verde Oliva (#556b2f -> R:0.333, G:0.420, B:0.184)
    ops.push("0.333 0.420 0.184 rg");
    ops.push(`${marginX} ${pageHeight - 95} ${contentWidth} 55 re f`);

    // Título no cabeçalho
    ops.push("BT");
    ops.push("1 1 1 rg");
    ops.push("/F2 15 Tf");
    ops.push(
      `1 0 0 1 ${marginX + 16} ${pageHeight - 64} Tm ${toWinAnsiHex(
        "RELATÓRIO DE ITENS DO PEDIDO"
      )} Tj`
    );
    ops.push("/F1 9.5 Tf");
    const subHeader = `Loja: ${meta.storeName}${
      meta.storeCode ? ` (${meta.storeCode})` : ""
    }${meta.storeCity ? ` - ${meta.storeCity}` : ""}   |   Referência: ${meta.referenceMonth.slice(
      0,
      7
    )}`;
    ops.push(
      `1 0 0 1 ${marginX + 16} ${pageHeight - 81} Tm ${toWinAnsiHex(
        truncateText(subHeader, 90)
      )} Tj`
    );
    ops.push("ET");

    // Cabeçalho da Tabela
    const tableTop = pageHeight - 125;
    const rowHeight = 22;

    ops.push("0.945 0.961 0.976 rg"); // slate-100
    ops.push(`${marginX} ${tableTop} ${contentWidth} ${rowHeight} re f`);
    ops.push("0.796 0.835 0.882 RG 0.7 w"); // borda
    ops.push(`${marginX} ${tableTop} ${contentWidth} ${rowHeight} re S`);

    // Colunas: # (40pt), Produto (255pt), Qtd (65pt), Vlr. Unit. (75pt), Total (80pt)
    const colX = {
      idx: marginX + 8,
      name: marginX + 42,
      qty: marginX + 305,
      unit: marginX + 375,
      total: marginX + 450,
    };

    ops.push("BT");
    ops.push("0.200 0.255 0.333 rg");
    ops.push("/F2 9 Tf");
    ops.push(`1 0 0 1 ${colX.idx} ${tableTop + 7} Tm ${toWinAnsiHex("#")} Tj`);
    ops.push(
      `1 0 0 1 ${colX.name} ${tableTop + 7} Tm ${toWinAnsiHex("PRODUTO")} Tj`
    );
    ops.push(
      `1 0 0 1 ${colX.qty} ${tableTop + 7} Tm ${toWinAnsiHex("QTD")} Tj`
    );
    ops.push(
      `1 0 0 1 ${colX.unit} ${tableTop + 7} Tm ${toWinAnsiHex("VLR. UNIT.")} Tj`
    );
    ops.push(
      `1 0 0 1 ${colX.total} ${tableTop + 7} Tm ${toWinAnsiHex("TOTAL")} Tj`
    );
    ops.push("ET");

    let currentY = tableTop - rowHeight;

    chunk.forEach((item, idx) => {
      const globalIdx = pageIndex * rowsPerPage + idx + 1;

      if (idx % 2 === 1) {
        ops.push("0.973 0.980 0.988 rg"); // zebra
        ops.push(`${marginX} ${currentY} ${contentWidth} ${rowHeight} re f`);
      }

      ops.push("0.886 0.910 0.941 RG 0.5 w");
      ops.push(`${marginX} ${currentY} ${contentWidth} ${rowHeight} re S`);

      ops.push("BT");
      ops.push("0.059 0.090 0.165 rg");
      ops.push("/F1 9.5 Tf");
      ops.push(
        `1 0 0 1 ${colX.idx} ${currentY + 7} Tm ${toWinAnsiHex(
          String(globalIdx)
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${colX.name} ${currentY + 7} Tm ${toWinAnsiHex(
          truncateText(item.product_name, 46)
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${colX.qty} ${currentY + 7} Tm ${toWinAnsiHex(
          String(item.quantity).replace(".", ",")
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${colX.unit} ${currentY + 7} Tm ${toWinAnsiHex(
          formatBRL(item.unit_price)
        )} Tj`
      );
      ops.push("/F2 9.5 Tf");
      ops.push(
        `1 0 0 1 ${colX.total} ${currentY + 7} Tm ${toWinAnsiHex(
          formatBRL(item.total_price)
        )} Tj`
      );
      ops.push("ET");

      currentY -= rowHeight;
    });

    // Na última página, exibe linha de totais consolidados
    if (pageIndex === itemChunks.length - 1) {
      ops.push("0.925 0.945 0.895 rg");
      ops.push(`${marginX} ${currentY} ${contentWidth} ${rowHeight + 2} re f`);
      ops.push("0.333 0.420 0.184 RG 0.8 w");
      ops.push(`${marginX} ${currentY} ${contentWidth} ${rowHeight + 2} re S`);

      ops.push("BT");
      ops.push("0.059 0.090 0.165 rg");
      ops.push("/F2 10 Tf");
      ops.push(
        `1 0 0 1 ${colX.name} ${currentY + 7} Tm ${toWinAnsiHex(
          `TOTAL CONSOLIDADO (${meta.items.length} ${
            meta.items.length === 1 ? "produto" : "produtos"
          })`
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${colX.qty} ${currentY + 7} Tm ${toWinAnsiHex(
          String(meta.totalItems).replace(".", ",")
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${colX.total} ${currentY + 7} Tm ${toWinAnsiHex(
          formatBRL(meta.totalAmount)
        )} Tj`
      );
      ops.push("ET");
    }

    // Rodapé da página
    ops.push("BT");
    ops.push("0.45 0.50 0.58 rg");
    ops.push("/F1 8 Tf");
    const generatedAt = new Date().toLocaleString("pt-BR");
    ops.push(
      `1 0 0 1 ${marginX} 28 Tm ${toWinAnsiHex(
        `Controle de Pedidos • Gerado em ${generatedAt} • Página ${
          pageIndex + 1
        } de ${itemChunks.length}`
      )} Tj`
    );
    ops.push("ET");

    pageStreams.push(ops.join("\n"));
  });

  // Montagem dos objetos PDF
  // Obj 1: Catalog
  // Obj 2: Pages
  // Obj 3: Font F1 (Helvetica)
  // Obj 4: Font F2 (Helvetica-Bold)
  // Para cada página i: Obj (5 + i*2) = Page, Obj (6 + i*2) = Content Stream
  const objects: string[] = [];
  const pageObjectIds: number[] = [];

  for (let i = 0; i < pageStreams.length; i++) {
    pageObjectIds.push(5 + i * 2);
  }

  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjectIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] /Count ${pageObjectIds.length} >>\nendobj\n`
  );
  objects.push(
    "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n"
  );
  objects.push(
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n"
  );

  for (let i = 0; i < pageStreams.length; i++) {
    const pageObjId = 5 + i * 2;
    const streamObjId = 6 + i * 2;
    const streamContent = pageStreams[i];

    objects.push(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamObjId} 0 R >>\nendobj\n`
    );
    objects.push(
      `${streamObjId} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`
    );
  }

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) {
    bytes[i] = pdf.charCodeAt(i) & 0xff;
  }
  return bytes;
}
