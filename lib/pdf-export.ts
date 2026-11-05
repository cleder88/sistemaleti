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

export interface StoreRankingPdfRow {
  store_name: string;
  store_code?: string;
  store_city?: string;
  total_items: number;
  current_month_total: number;
  historical_avg: number;
  diff_percentage: number;
}

export interface StoresRankingPdfMetadata {
  referenceMonth: string; // YYYY-MM-01 ou YYYY-MM
  rows: StoreRankingPdfRow[];
}

/**
 * Gera e baixa automaticamente o relatório em PDF com o Ranking de Gastos por Loja
 * para o mês/ano selecionado (atual ou meses anteriores).
 */
export function downloadStoresRankingPdf(
  meta: StoresRankingPdfMetadata
): void {
  const pdfBytes = generateStoresRankingPdfBytes(meta);
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);

  const monthSlug = meta.referenceMonth.slice(0, 7);

  const link = document.createElement("a");
  link.href = url;
  link.download = `ranking-gastos-lojas-${monthSlug}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function generateStoresRankingPdfBytes(
  meta: StoresRankingPdfMetadata
): Uint8Array {
  const pageWidth = 595.28; // A4 width pt
  const pageHeight = 841.89; // A4 height pt
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2;
  const rowsPerPage = 24;

  const sortedRows = [...meta.rows].sort(
    (a, b) => b.current_month_total - a.current_month_total
  );

  const totalNetworkItems = sortedRows.reduce(
    (sum, r) => sum + (Number(r.total_items) || 0),
    0
  );
  const totalNetworkAmount = sortedRows.reduce(
    (sum, r) => sum + (Number(r.current_month_total) || 0),
    0
  );

  const rowChunks: StoreRankingPdfRow[][] = [];
  if (sortedRows.length === 0) {
    rowChunks.push([]);
  } else {
    for (let i = 0; i < sortedRows.length; i += rowsPerPage) {
      rowChunks.push(sortedRows.slice(i, i + rowsPerPage));
    }
  }

  const pageStreams: string[] = [];

  rowChunks.forEach((chunk, pageIndex) => {
    const ops: string[] = [];

    // Faixa superior Verde Oliva (#556b2f)
    ops.push("0.333 0.420 0.184 rg");
    ops.push(`${marginX} ${pageHeight - 95} ${contentWidth} 55 re f`);

    ops.push("BT");
    ops.push("1 1 1 rg");
    ops.push("/F2 15 Tf");
    ops.push(
      `1 0 0 1 ${marginX + 16} ${pageHeight - 64} Tm ${toWinAnsiHex(
        "RANKING DE GASTOS POR LOJA"
      )} Tj`
    );
    ops.push("/F1 9.5 Tf");
    const subHeader = `Referência: ${meta.referenceMonth.slice(0, 7)}   |   Lojas no Período: ${
      sortedRows.length
    }   |   Total da Rede: ${formatBRL(totalNetworkAmount)}`;
    ops.push(
      `1 0 0 1 ${marginX + 16} ${pageHeight - 81} Tm ${toWinAnsiHex(
        truncateText(subHeader, 92)
      )} Tj`
    );
    ops.push("ET");

    const tableTop = pageHeight - 125;
    const rowHeight = 22;

    ops.push("0.945 0.961 0.976 rg");
    ops.push(`${marginX} ${tableTop} ${contentWidth} ${rowHeight} re f`);
    ops.push("0.796 0.835 0.882 RG 0.7 w");
    ops.push(`${marginX} ${tableTop} ${contentWidth} ${rowHeight} re S`);

    const colX = {
      rank: marginX + 8,
      store: marginX + 42,
      items: marginX + 255,
      avg: marginX + 315,
      diff: marginX + 395,
      total: marginX + 448,
    };

    ops.push("BT");
    ops.push("0.200 0.255 0.333 rg");
    ops.push("/F2 8.5 Tf");
    ops.push(
      `1 0 0 1 ${colX.rank} ${tableTop + 7} Tm ${toWinAnsiHex("POS.")} Tj`
    );
    ops.push(
      `1 0 0 1 ${colX.store} ${tableTop + 7} Tm ${toWinAnsiHex("LOJA")} Tj`
    );
    ops.push(
      `1 0 0 1 ${colX.items} ${tableTop + 7} Tm ${toWinAnsiHex("ITENS")} Tj`
    );
    ops.push(
      `1 0 0 1 ${colX.avg} ${tableTop + 7} Tm ${toWinAnsiHex("MÉDIA 3M")} Tj`
    );
    ops.push(
      `1 0 0 1 ${colX.diff} ${tableTop + 7} Tm ${toWinAnsiHex("DESVIO")} Tj`
    );
    ops.push(
      `1 0 0 1 ${colX.total} ${tableTop + 7} Tm ${toWinAnsiHex(
        "GASTO NO MÊS"
      )} Tj`
    );
    ops.push("ET");

    let currentY = tableTop - rowHeight;

    chunk.forEach((row, idx) => {
      const position = pageIndex * rowsPerPage + idx + 1;

      if (idx % 2 === 1) {
        ops.push("0.973 0.980 0.988 rg");
        ops.push(`${marginX} ${currentY} ${contentWidth} ${rowHeight} re f`);
      }

      ops.push("0.886 0.910 0.941 RG 0.5 w");
      ops.push(`${marginX} ${currentY} ${contentWidth} ${rowHeight} re S`);

      const storeLabel = `${row.store_name}${
        row.store_code ? ` (${row.store_code})` : ""
      }${row.store_city ? ` - ${row.store_city}` : ""}`;
      const diffSign = row.diff_percentage > 0 ? "+" : "";
      const diffLabel = `${diffSign}${Number(row.diff_percentage || 0)
        .toFixed(1)
        .replace(".", ",")}%`;

      ops.push("BT");
      ops.push("0.059 0.090 0.165 rg");
      ops.push("/F2 9 Tf");
      ops.push(
        `1 0 0 1 ${colX.rank} ${currentY + 7} Tm ${toWinAnsiHex(
          `${position}º`
        )} Tj`
      );
      ops.push("/F1 9 Tf");
      ops.push(
        `1 0 0 1 ${colX.store} ${currentY + 7} Tm ${toWinAnsiHex(
          truncateText(storeLabel, 36)
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${colX.items} ${currentY + 7} Tm ${toWinAnsiHex(
          String(row.total_items).replace(".", ",")
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${colX.avg} ${currentY + 7} Tm ${toWinAnsiHex(
          formatBRL(row.historical_avg)
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${colX.diff} ${currentY + 7} Tm ${toWinAnsiHex(
          diffLabel
        )} Tj`
      );
      ops.push("/F2 9 Tf");
      ops.push(
        `1 0 0 1 ${colX.total} ${currentY + 7} Tm ${toWinAnsiHex(
          formatBRL(row.current_month_total)
        )} Tj`
      );
      ops.push("ET");

      currentY -= rowHeight;
    });

    if (pageIndex === rowChunks.length - 1) {
      ops.push("0.925 0.945 0.895 rg");
      ops.push(`${marginX} ${currentY} ${contentWidth} ${rowHeight + 2} re f`);
      ops.push("0.333 0.420 0.184 RG 0.8 w");
      ops.push(`${marginX} ${currentY} ${contentWidth} ${rowHeight + 2} re S`);

      ops.push("BT");
      ops.push("0.059 0.090 0.165 rg");
      ops.push("/F2 9.5 Tf");
      ops.push(
        `1 0 0 1 ${colX.store} ${currentY + 7} Tm ${toWinAnsiHex(
          `TOTAL CONSOLIDADO DA REDE (${sortedRows.length} ${
            sortedRows.length === 1 ? "loja" : "lojas"
          })`
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${colX.items} ${currentY + 7} Tm ${toWinAnsiHex(
          String(totalNetworkItems).replace(".", ",")
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${colX.total} ${currentY + 7} Tm ${toWinAnsiHex(
          formatBRL(totalNetworkAmount)
        )} Tj`
      );
      ops.push("ET");
    }

    ops.push("BT");
    ops.push("0.45 0.50 0.58 rg");
    ops.push("/F1 8 Tf");
    const generatedAt = new Date().toLocaleString("pt-BR");
    ops.push(
      `1 0 0 1 ${marginX} 28 Tm ${toWinAnsiHex(
        `Controle de Pedidos • Ranking por Loja • Gerado em ${generatedAt} • Página ${
          pageIndex + 1
        } de ${rowChunks.length}`
      )} Tj`
    );
    ops.push("ET");

    pageStreams.push(ops.join("\n"));
  });

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

export interface MonthlyEvolutionPdfRow {
  monthLabel: string;
  rawMonth: string; // YYYY-MM
  totalItems: number;
  compras: number;
  mediaRede: number;
}

export interface MonthlyEvolutionPdfMetadata {
  storeLabel: string;
  periodLabel: string;
  rows: MonthlyEvolutionPdfRow[];
}

/**
 * Gera e baixa automaticamente o relatório em PDF da Evolução Mensal vs. Média da Rede.
 */
export function downloadMonthlyEvolutionPdf(
  meta: MonthlyEvolutionPdfMetadata
): void {
  const pdfBytes = generateMonthlyEvolutionPdfBytes(meta);
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);

  const safePeriod = meta.periodLabel
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .toLowerCase();

  const link = document.createElement("a");
  link.href = url;
  link.download = `evolucao-mensal-${safePeriod}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function generateMonthlyEvolutionPdfBytes(
  meta: MonthlyEvolutionPdfMetadata
): Uint8Array {
  const pageWidth = 595.28; // A4 width pt
  const pageHeight = 841.89; // A4 height pt
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2;
  const rowsPerPage = 24;

  const totalItemsSum = meta.rows.reduce(
    (sum, r) => sum + (Number(r.totalItems) || 0),
    0
  );
  const totalComprasSum = meta.rows.reduce(
    (sum, r) => sum + (Number(r.compras) || 0),
    0
  );
  const avgRedeOverall =
    meta.rows.length > 0
      ? meta.rows.reduce((sum, r) => sum + (Number(r.mediaRede) || 0), 0) /
        meta.rows.length
      : 0;

  const rowChunks: MonthlyEvolutionPdfRow[][] = [];
  if (meta.rows.length === 0) {
    rowChunks.push([]);
  } else {
    for (let i = 0; i < meta.rows.length; i += rowsPerPage) {
      rowChunks.push(meta.rows.slice(i, i + rowsPerPage));
    }
  }

  const pageStreams: string[] = [];

  rowChunks.forEach((chunk, pageIndex) => {
    const ops: string[] = [];

    // Faixa superior Verde Oliva (#556b2f)
    ops.push("0.333 0.420 0.184 rg");
    ops.push(`${marginX} ${pageHeight - 95} ${contentWidth} 55 re f`);

    ops.push("BT");
    ops.push("1 1 1 rg");
    ops.push("/F2 15 Tf");
    ops.push(
      `1 0 0 1 ${marginX + 16} ${pageHeight - 64} Tm ${toWinAnsiHex(
        "EVOLUÇÃO MENSAL VS. MÉDIA DA REDE"
      )} Tj`
    );
    ops.push("/F1 9.5 Tf");
    const subHeader = `Unidade: ${meta.storeLabel}   |   Período: ${
      meta.periodLabel
    }   |   Acumulado: ${formatBRL(totalComprasSum)}`;
    ops.push(
      `1 0 0 1 ${marginX + 16} ${pageHeight - 81} Tm ${toWinAnsiHex(
        truncateText(subHeader, 92)
      )} Tj`
    );
    ops.push("ET");

    const tableTop = pageHeight - 125;
    const rowHeight = 22;

    ops.push("0.945 0.961 0.976 rg");
    ops.push(`${marginX} ${tableTop} ${contentWidth} ${rowHeight} re f`);
    ops.push("0.796 0.835 0.882 RG 0.7 w");
    ops.push(`${marginX} ${tableTop} ${contentWidth} ${rowHeight} re S`);

    const colX = {
      idx: marginX + 8,
      month: marginX + 42,
      items: marginX + 165,
      compras: marginX + 245,
      media: marginX + 345,
      diff: marginX + 448,
    };

    ops.push("BT");
    ops.push("0.200 0.255 0.333 rg");
    ops.push("/F2 8.5 Tf");
    ops.push(`1 0 0 1 ${colX.idx} ${tableTop + 7} Tm ${toWinAnsiHex("#")} Tj`);
    ops.push(
      `1 0 0 1 ${colX.month} ${tableTop + 7} Tm ${toWinAnsiHex(
        "MÊS / REFERÊNCIA"
      )} Tj`
    );
    ops.push(
      `1 0 0 1 ${colX.items} ${tableTop + 7} Tm ${toWinAnsiHex(
        "QTD. ITENS"
      )} Tj`
    );
    ops.push(
      `1 0 0 1 ${colX.compras} ${tableTop + 7} Tm ${toWinAnsiHex(
        "COMPRAS NO MÊS"
      )} Tj`
    );
    ops.push(
      `1 0 0 1 ${colX.media} ${tableTop + 7} Tm ${toWinAnsiHex(
        "MÉDIA DA REDE"
      )} Tj`
    );
    ops.push(
      `1 0 0 1 ${colX.diff} ${tableTop + 7} Tm ${toWinAnsiHex(
        "DIF. VS REDE"
      )} Tj`
    );
    ops.push("ET");

    let currentY = tableTop - rowHeight;

    chunk.forEach((row, idx) => {
      const globalIdx = pageIndex * rowsPerPage + idx + 1;

      if (idx % 2 === 1) {
        ops.push("0.973 0.980 0.988 rg");
        ops.push(`${marginX} ${currentY} ${contentWidth} ${rowHeight} re f`);
      }

      ops.push("0.886 0.910 0.941 RG 0.5 w");
      ops.push(`${marginX} ${currentY} ${contentWidth} ${rowHeight} re S`);

      const diffPct =
        row.mediaRede > 0
          ? ((row.compras - row.mediaRede) / row.mediaRede) * 100
          : 0;
      const diffSign = diffPct > 0 ? "+" : "";
      const diffLabel = `${diffSign}${diffPct.toFixed(1).replace(".", ",")}%`;

      ops.push("BT");
      ops.push("0.059 0.090 0.165 rg");
      ops.push("/F1 9 Tf");
      ops.push(
        `1 0 0 1 ${colX.idx} ${currentY + 7} Tm ${toWinAnsiHex(
          String(globalIdx)
        )} Tj`
      );
      ops.push("/F2 9 Tf");
      ops.push(
        `1 0 0 1 ${colX.month} ${currentY + 7} Tm ${toWinAnsiHex(
          `${row.monthLabel.toUpperCase()} (${row.rawMonth})`
        )} Tj`
      );
      ops.push("/F1 9 Tf");
      ops.push(
        `1 0 0 1 ${colX.items} ${currentY + 7} Tm ${toWinAnsiHex(
          String(row.totalItems).replace(".", ",")
        )} Tj`
      );
      ops.push("/F2 9 Tf");
      ops.push(
        `1 0 0 1 ${colX.compras} ${currentY + 7} Tm ${toWinAnsiHex(
          formatBRL(row.compras)
        )} Tj`
      );
      ops.push("/F1 9 Tf");
      ops.push(
        `1 0 0 1 ${colX.media} ${currentY + 7} Tm ${toWinAnsiHex(
          formatBRL(row.mediaRede)
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${colX.diff} ${currentY + 7} Tm ${toWinAnsiHex(
          diffLabel
        )} Tj`
      );
      ops.push("ET");

      currentY -= rowHeight;
    });

    if (pageIndex === rowChunks.length - 1) {
      ops.push("0.925 0.945 0.895 rg");
      ops.push(`${marginX} ${currentY} ${contentWidth} ${rowHeight + 2} re f`);
      ops.push("0.333 0.420 0.184 RG 0.8 w");
      ops.push(`${marginX} ${currentY} ${contentWidth} ${rowHeight + 2} re S`);

      ops.push("BT");
      ops.push("0.059 0.090 0.165 rg");
      ops.push("/F2 9.5 Tf");
      ops.push(
        `1 0 0 1 ${colX.month} ${currentY + 7} Tm ${toWinAnsiHex(
          `CONSOLIDADO (${meta.rows.length} ${
            meta.rows.length === 1 ? "mês" : "meses"
          })`
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${colX.items} ${currentY + 7} Tm ${toWinAnsiHex(
          String(totalItemsSum).replace(".", ",")
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${colX.compras} ${currentY + 7} Tm ${toWinAnsiHex(
          formatBRL(totalComprasSum)
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${colX.media} ${currentY + 7} Tm ${toWinAnsiHex(
          formatBRL(avgRedeOverall)
        )} Tj`
      );
      ops.push("ET");
    }

    ops.push("BT");
    ops.push("0.45 0.50 0.58 rg");
    ops.push("/F1 8 Tf");
    const generatedAt = new Date().toLocaleString("pt-BR");
    ops.push(
      `1 0 0 1 ${marginX} 28 Tm ${toWinAnsiHex(
        `Controle de Pedidos • Evolução Mensal • Gerado em ${generatedAt} • Página ${
          pageIndex + 1
        } de ${rowChunks.length}`
      )} Tj`
    );
    ops.push("ET");

    pageStreams.push(ops.join("\n"));
  });

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

export interface ItemsQuantityComparisonPdfRow {
  label: string;
  total_items: number;
  historical_items_avg: number;
  network_items_avg: number;
  items_diff_percentage: number;
  current_month_total: number;
}

export interface ItemsQuantityComparisonPdfMetadata {
  periodLabel: string;
  modeLabel: string;
  rows: ItemsQuantityComparisonPdfRow[];
}

/**
 * Gera e baixa automaticamente o relatório em PDF do Comparativo de Quantidade de Produtos.
 */
export function downloadItemsQuantityComparisonPdf(
  meta: ItemsQuantityComparisonPdfMetadata
): void {
  const pdfBytes = generateItemsQuantityComparisonPdfBytes(meta);
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);

  const safePeriod = meta.periodLabel
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .toLowerCase();

  const link = document.createElement("a");
  link.href = url;
  link.download = `comparativo-quantidade-produtos-${safePeriod}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function generateItemsQuantityComparisonPdfBytes(
  meta: ItemsQuantityComparisonPdfMetadata
): Uint8Array {
  const pageWidth = 595.28; // A4 width pt
  const pageHeight = 841.89; // A4 height pt
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2;
  const rowsPerPage = 24;

  const totalItemsSum = meta.rows.reduce(
    (sum, r) => sum + (Number(r.total_items) || 0),
    0
  );
  const totalAmountSum = meta.rows.reduce(
    (sum, r) => sum + (Number(r.current_month_total) || 0),
    0
  );

  const rowChunks: ItemsQuantityComparisonPdfRow[][] = [];
  if (meta.rows.length === 0) {
    rowChunks.push([]);
  } else {
    for (let i = 0; i < meta.rows.length; i += rowsPerPage) {
      rowChunks.push(meta.rows.slice(i, i + rowsPerPage));
    }
  }

  const pageStreams: string[] = [];

  rowChunks.forEach((chunk, pageIndex) => {
    const ops: string[] = [];

    // Faixa superior Verde Oliva (#556b2f)
    ops.push("0.333 0.420 0.184 rg");
    ops.push(`${marginX} ${pageHeight - 95} ${contentWidth} 55 re f`);

    ops.push("BT");
    ops.push("1 1 1 rg");
    ops.push("/F2 14.5 Tf");
    ops.push(
      `1 0 0 1 ${marginX + 16} ${pageHeight - 64} Tm ${toWinAnsiHex(
        "COMPARATIVO EM QUANTIDADE DE PRODUTOS"
      )} Tj`
    );
    ops.push("/F1 9.5 Tf");
    const subHeader = `Visão: ${meta.modeLabel}   |   Período: ${
      meta.periodLabel
    }   |   Volume Total: ${totalItemsSum.toLocaleString("pt-BR")} unid.`;
    ops.push(
      `1 0 0 1 ${marginX + 16} ${pageHeight - 81} Tm ${toWinAnsiHex(
        truncateText(subHeader, 92)
      )} Tj`
    );
    ops.push("ET");

    const tableTop = pageHeight - 125;
    const rowHeight = 22;

    ops.push("0.945 0.961 0.976 rg");
    ops.push(`${marginX} ${tableTop} ${contentWidth} ${rowHeight} re f`);
    ops.push("0.796 0.835 0.882 RG 0.7 w");
    ops.push(`${marginX} ${tableTop} ${contentWidth} ${rowHeight} re S`);

    const colX = {
      rank: marginX + 8,
      label: marginX + 38,
      qty: marginX + 215,
      avg3m: marginX + 280,
      netAvg: marginX + 345,
      diff: marginX + 408,
      amount: marginX + 455,
    };

    ops.push("BT");
    ops.push("0.200 0.255 0.333 rg");
    ops.push("/F2 8 Tf");
    ops.push(
      `1 0 0 1 ${colX.rank} ${tableTop + 7} Tm ${toWinAnsiHex("#")} Tj`
    );
    ops.push(
      `1 0 0 1 ${colX.label} ${tableTop + 7} Tm ${toWinAnsiHex(
        "LOJA / REFERÊNCIA"
      )} Tj`
    );
    ops.push(
      `1 0 0 1 ${colX.qty} ${tableTop + 7} Tm ${toWinAnsiHex(
        "QTD. ITENS"
      )} Tj`
    );
    ops.push(
      `1 0 0 1 ${colX.avg3m} ${tableTop + 7} Tm ${toWinAnsiHex(
        "MÉDIA 3M"
      )} Tj`
    );
    ops.push(
      `1 0 0 1 ${colX.netAvg} ${tableTop + 7} Tm ${toWinAnsiHex(
        "MÉDIA REDE"
      )} Tj`
    );
    ops.push(
      `1 0 0 1 ${colX.diff} ${tableTop + 7} Tm ${toWinAnsiHex("DESVIO")} Tj`
    );
    ops.push(
      `1 0 0 1 ${colX.amount} ${tableTop + 7} Tm ${toWinAnsiHex(
        "VALOR (R$)"
      )} Tj`
    );
    ops.push("ET");

    let currentY = tableTop - rowHeight;

    chunk.forEach((row, idx) => {
      const position = pageIndex * rowsPerPage + idx + 1;

      if (idx % 2 === 1) {
        ops.push("0.973 0.980 0.988 rg");
        ops.push(`${marginX} ${currentY} ${contentWidth} ${rowHeight} re f`);
      }

      ops.push("0.886 0.910 0.941 RG 0.5 w");
      ops.push(`${marginX} ${currentY} ${contentWidth} ${rowHeight} re S`);

      const diffSign = row.items_diff_percentage > 0 ? "+" : "";
      const diffLabel = `${diffSign}${Number(row.items_diff_percentage || 0)
        .toFixed(1)
        .replace(".", ",")}%`;

      ops.push("BT");
      ops.push("0.059 0.090 0.165 rg");
      ops.push("/F2 8.5 Tf");
      ops.push(
        `1 0 0 1 ${colX.rank} ${currentY + 7} Tm ${toWinAnsiHex(
          `${position}º`
        )} Tj`
      );
      ops.push("/F1 8.5 Tf");
      ops.push(
        `1 0 0 1 ${colX.label} ${currentY + 7} Tm ${toWinAnsiHex(
          truncateText(row.label, 30)
        )} Tj`
      );
      ops.push("/F2 8.5 Tf");
      ops.push(
        `1 0 0 1 ${colX.qty} ${currentY + 7} Tm ${toWinAnsiHex(
          `${Number(row.total_items).toLocaleString("pt-BR")} un.`
        )} Tj`
      );
      ops.push("/F1 8.5 Tf");
      ops.push(
        `1 0 0 1 ${colX.avg3m} ${currentY + 7} Tm ${toWinAnsiHex(
          `${Number(row.historical_items_avg).toFixed(1).replace(".", ",")} un.`
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${colX.netAvg} ${currentY + 7} Tm ${toWinAnsiHex(
          `${Number(row.network_items_avg).toFixed(1).replace(".", ",")} un.`
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${colX.diff} ${currentY + 7} Tm ${toWinAnsiHex(
          diffLabel
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${colX.amount} ${currentY + 7} Tm ${toWinAnsiHex(
          formatBRL(row.current_month_total)
        )} Tj`
      );
      ops.push("ET");

      currentY -= rowHeight;
    });

    if (pageIndex === rowChunks.length - 1) {
      ops.push("0.925 0.945 0.895 rg");
      ops.push(`${marginX} ${currentY} ${contentWidth} ${rowHeight + 2} re f`);
      ops.push("0.333 0.420 0.184 RG 0.8 w");
      ops.push(`${marginX} ${currentY} ${contentWidth} ${rowHeight + 2} re S`);

      ops.push("BT");
      ops.push("0.059 0.090 0.165 rg");
      ops.push("/F2 9 Tf");
      ops.push(
        `1 0 0 1 ${colX.label} ${currentY + 7} Tm ${toWinAnsiHex(
          `TOTAL CONSOLIDADO (${meta.rows.length} ${
            meta.rows.length === 1 ? "registro" : "registros"
          })`
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${colX.qty} ${currentY + 7} Tm ${toWinAnsiHex(
          `${totalItemsSum.toLocaleString("pt-BR")} un.`
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${colX.amount} ${currentY + 7} Tm ${toWinAnsiHex(
          formatBRL(totalAmountSum)
        )} Tj`
      );
      ops.push("ET");
    }

    ops.push("BT");
    ops.push("0.45 0.50 0.58 rg");
    ops.push("/F1 8 Tf");
    const generatedAt = new Date().toLocaleString("pt-BR");
    ops.push(
      `1 0 0 1 ${marginX} 28 Tm ${toWinAnsiHex(
        `Controle de Pedidos • Comparativo de Quantidade de Produtos • Gerado em ${generatedAt} • Página ${
          pageIndex + 1
        } de ${rowChunks.length}`
      )} Tj`
    );
    ops.push("ET");

    pageStreams.push(ops.join("\n"));
  });

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

export interface CompleteDashboardStoreRow {
  store_name: string;
  store_code?: string;
  store_city?: string;
  total_items: number;
  current_month_total: number;
  historical_avg: number;
  network_avg: number;
  diff_percentage: number;
  historical_items_avg: number;
  network_items_avg: number;
  items_diff_percentage: number;
}

export interface CompleteDashboardMonthlyRow {
  monthLabel: string;
  rawMonth: string;
  totalItems: number;
  compras: number;
  mediaRedeValor: number;
  mediaRedeItens: number;
}

export interface CompleteDashboardReportPdfMetadata {
  referenceMonthLabel: string;
  referenceMonthSlug: string;
  storeFilterLabel: string;
  kpis: {
    totalMonthAmount: number;
    monthVariationPct: number | null;
    totalItemsVolume: number;
    itemsVariationPct: number | null;
    topValueStoreLabel: string;
    topItemsStoreLabel: string;
    alertStoresSummary: string;
  };
  storeRows: CompleteDashboardStoreRow[];
  monthlyEvolutionRows: CompleteDashboardMonthlyRow[];
}

/**
 * Gera e baixa automaticamente o Relatório Geral Consolidado em PDF contendo
 * todos os dados de todos os cards do Dashboard (KPIs, Ranking Financeiro,
 * Comparativo em Quantidade de Produtos e Evolução Mensal) para o mês atual ou anteriores.
 */
export function downloadCompleteDashboardReportPdf(
  meta: CompleteDashboardReportPdfMetadata
): void {
  const pdfBytes = generateCompleteDashboardReportPdfBytes(meta);
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);

  const safeSlug = meta.referenceMonthSlug
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .toLowerCase();

  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorio-geral-dashboard-${safeSlug}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function generateCompleteDashboardReportPdfBytes(
  meta: CompleteDashboardReportPdfMetadata
): Uint8Array {
  const pageWidth = 595.28; // A4 width pt
  const pageHeight = 841.89; // A4 height pt
  const marginX = 36;
  const contentWidth = pageWidth - marginX * 2;

  const sortedByValue = [...meta.storeRows].sort(
    (a, b) => b.current_month_total - a.current_month_total
  );
  const sortedByItems = [...meta.storeRows].sort(
    (a, b) => b.total_items - a.total_items
  );

  const totalStoreAmount = meta.storeRows.reduce(
    (s, r) => s + (Number(r.current_month_total) || 0),
    0
  );
  const totalStoreItems = meta.storeRows.reduce(
    (s, r) => s + (Number(r.total_items) || 0),
    0
  );

  const totalHistoryAmount = meta.monthlyEvolutionRows.reduce(
    (s, r) => s + (Number(r.compras) || 0),
    0
  );
  const totalHistoryItems = meta.monthlyEvolutionRows.reduce(
    (s, r) => s + (Number(r.totalItems) || 0),
    0
  );

  const pageStreams: string[] = [];

  // Helper para desenhar o banner principal de uma página
  function pushPageBanner(ops: string[], subtitleExtra: string) {
    ops.push("0.333 0.420 0.184 rg");
    ops.push(`${marginX} ${pageHeight - 90} ${contentWidth} 54 re f`);

    ops.push("BT");
    ops.push("1 1 1 rg");
    ops.push("/F2 13.5 Tf");
    ops.push(
      `1 0 0 1 ${marginX + 14} ${pageHeight - 60} Tm ${toWinAnsiHex(
        "RELATÓRIO GERAL CONSOLIDADO DO DASHBOARD (TODOS OS CARDS)"
      )} Tj`
    );
    ops.push("/F1 9 Tf");
    const sub = `Período: ${meta.referenceMonthLabel}   |   Filtro: ${meta.storeFilterLabel}   |   ${subtitleExtra}`;
    ops.push(
      `1 0 0 1 ${marginX + 14} ${pageHeight - 77} Tm ${toWinAnsiHex(
        truncateText(sub, 98)
      )} Tj`
    );
    ops.push("ET");
  }

  // =========================================================================
  // PÁGINA 1: RESUMO DOS 4 CARDS DE TOPO (KPIS) + RANKING FINANCEIRO POR LOJA
  // =========================================================================
  {
    const ops: string[] = [];
    pushPageBanner(ops, "Seções 1 e 2: KPIs Gerais e Ranking de Gastos (R$)");

    let curY = pageHeight - 115;

    // Título Seção 1
    ops.push("0.059 0.090 0.165 rg");
    ops.push(`${marginX} ${curY} ${contentWidth} 20 re f`);
    ops.push("BT 1 1 1 rg /F2 9.5 Tf");
    ops.push(
      `1 0 0 1 ${marginX + 10} ${curY + 6} Tm ${toWinAnsiHex(
        "1. INDICADORES GERAIS DO PERÍODO (CARDS DE TOPO)"
      )} Tj ET`
    );

    curY -= 56;
    const cardW = (contentWidth - 12) / 2;
    const cardH = 48;

    // KPI Box 1 (Esquerda Superior): Total em Pedidos (R$)
    ops.push("0.965 0.973 0.984 rg");
    ops.push(`${marginX} ${curY} ${cardW} ${cardH} re f`);
    ops.push("0.796 0.835 0.882 RG 0.6 w");
    ops.push(`${marginX} ${curY} ${cardW} ${cardH} re S`);

    const valPctLabel =
      meta.kpis.monthVariationPct !== null
        ? `${meta.kpis.monthVariationPct > 0 ? "+" : ""}${meta.kpis.monthVariationPct
            .toFixed(1)
            .replace(".", ",")}% vs. mês anterior`
        : "Sem base no mês anterior";

    ops.push("BT 0.35 0.40 0.48 rg /F2 7.5 Tf");
    ops.push(
      `1 0 0 1 ${marginX + 10} ${curY + 34} Tm ${toWinAnsiHex(
        "CARD 1 • TOTAL EM PEDIDOS NO MÊS (R$)"
      )} Tj`
    );
    ops.push("0.059 0.090 0.165 rg /F2 11.5 Tf");
    ops.push(
      `1 0 0 1 ${marginX + 10} ${curY + 19} Tm ${toWinAnsiHex(
        formatBRL(meta.kpis.totalMonthAmount)
      )} Tj`
    );
    ops.push("0.25 0.30 0.38 rg /F1 8 Tf");
    ops.push(
      `1 0 0 1 ${marginX + 10} ${curY + 7} Tm ${toWinAnsiHex(
        valPctLabel
      )} Tj ET`
    );

    // KPI Box 2 (Direita Superior): Volume Total de Itens (Unidades)
    const rightX = marginX + cardW + 12;
    ops.push("0.965 0.973 0.984 rg");
    ops.push(`${rightX} ${curY} ${cardW} ${cardH} re f`);
    ops.push("0.796 0.835 0.882 RG 0.6 w");
    ops.push(`${rightX} ${curY} ${cardW} ${cardH} re S`);

    const itemsPctLabel =
      meta.kpis.itemsVariationPct !== null
        ? `${meta.kpis.itemsVariationPct > 0 ? "+" : ""}${meta.kpis.itemsVariationPct
            .toFixed(1)
            .replace(".", ",")}% em qtd. vs. mês anterior`
        : "Sem base no mês anterior";

    ops.push("BT 0.35 0.40 0.48 rg /F2 7.5 Tf");
    ops.push(
      `1 0 0 1 ${rightX + 10} ${curY + 34} Tm ${toWinAnsiHex(
        "CARD 2 • VOLUME TOTAL DE PRODUTOS (UNIDADES)"
      )} Tj`
    );
    ops.push("0.059 0.090 0.165 rg /F2 11.5 Tf");
    ops.push(
      `1 0 0 1 ${rightX + 10} ${curY + 19} Tm ${toWinAnsiHex(
        `${meta.kpis.totalItemsVolume.toLocaleString("pt-BR")} unidades`
      )} Tj`
    );
    ops.push("0.25 0.30 0.38 rg /F1 8 Tf");
    ops.push(
      `1 0 0 1 ${rightX + 10} ${curY + 7} Tm ${toWinAnsiHex(
        itemsPctLabel
      )} Tj ET`
    );

    curY -= 54;

    // KPI Box 3 (Esquerda Inferior): Destaques de Maior Volume (Valor e Quantidade)
    ops.push("0.965 0.973 0.984 rg");
    ops.push(`${marginX} ${curY} ${cardW} ${cardH} re f`);
    ops.push("0.796 0.835 0.882 RG 0.6 w");
    ops.push(`${marginX} ${curY} ${cardW} ${cardH} re S`);

    ops.push("BT 0.35 0.40 0.48 rg /F2 7.5 Tf");
    ops.push(
      `1 0 0 1 ${marginX + 10} ${curY + 34} Tm ${toWinAnsiHex(
        "CARD 3 • MAIOR VOLUME NO MÊS (VALOR E QTD.)"
      )} Tj`
    );
    ops.push("0.059 0.090 0.165 rg /F2 8.5 Tf");
    ops.push(
      `1 0 0 1 ${marginX + 10} ${curY + 20} Tm ${toWinAnsiHex(
        truncateText(`Maior Gasto (R$): ${meta.kpis.topValueStoreLabel}`, 46)
      )} Tj`
    );
    ops.push("0.20 0.25 0.33 rg /F1 8.5 Tf");
    ops.push(
      `1 0 0 1 ${marginX + 10} ${curY + 8} Tm ${toWinAnsiHex(
        truncateText(`Maior Qtd. (Un.): ${meta.kpis.topItemsStoreLabel}`, 46)
      )} Tj ET`
    );

    // KPI Box 4 (Direita Inferior): Alerta de Desvio (>25%)
    ops.push("0.965 0.973 0.984 rg");
    ops.push(`${rightX} ${curY} ${cardW} ${cardH} re f`);
    ops.push("0.796 0.835 0.882 RG 0.6 w");
    ops.push(`${rightX} ${curY} ${cardW} ${cardH} re S`);

    ops.push("BT 0.35 0.40 0.48 rg /F2 7.5 Tf");
    ops.push(
      `1 0 0 1 ${rightX + 10} ${curY + 34} Tm ${toWinAnsiHex(
        "CARD 4 • ALERTA DE DESVIO (>25% ACIMA DA MÉDIA 3M)"
      )} Tj`
    );
    ops.push("0.059 0.090 0.165 rg /F2 9 Tf");
    ops.push(
      `1 0 0 1 ${rightX + 10} ${curY + 16} Tm ${toWinAnsiHex(
        truncateText(meta.kpis.alertStoresSummary, 45)
      )} Tj ET`
    );

    // Título Seção 2: Ranking de Gastos Financeiros por Loja (R$)
    curY -= 32;
    ops.push("0.059 0.090 0.165 rg");
    ops.push(`${marginX} ${curY} ${contentWidth} 20 re f`);
    ops.push("BT 1 1 1 rg /F2 9.5 Tf");
    ops.push(
      `1 0 0 1 ${marginX + 10} ${curY + 6} Tm ${toWinAnsiHex(
        "2. RANKING DE GASTOS FINANCEIROS E DETALHAMENTO POR LOJA (R$)"
      )} Tj ET`
    );

    const rowH = 19;
    curY -= rowH;

    // Cabeçalho da Tabela Seção 2
    ops.push("0.945 0.961 0.976 rg");
    ops.push(`${marginX} ${curY} ${contentWidth} ${rowH} re f`);
    ops.push("0.796 0.835 0.882 RG 0.6 w");
    ops.push(`${marginX} ${curY} ${contentWidth} ${rowH} re S`);

    const col2 = {
      rank: marginX + 6,
      store: marginX + 34,
      items: marginX + 235,
      avg3m: marginX + 290,
      netAvg: marginX + 365,
      diff: marginX + 432,
      total: marginX + 472,
    };

    ops.push("BT 0.200 0.255 0.333 rg /F2 7.5 Tf");
    ops.push(`1 0 0 1 ${col2.rank} ${curY + 6} Tm ${toWinAnsiHex("POS.")} Tj`);
    ops.push(`1 0 0 1 ${col2.store} ${curY + 6} Tm ${toWinAnsiHex("LOJA")} Tj`);
    ops.push(`1 0 0 1 ${col2.items} ${curY + 6} Tm ${toWinAnsiHex("ITENS")} Tj`);
    ops.push(
      `1 0 0 1 ${col2.avg3m} ${curY + 6} Tm ${toWinAnsiHex("MÉDIA 3M")} Tj`
    );
    ops.push(
      `1 0 0 1 ${col2.netAvg} ${curY + 6} Tm ${toWinAnsiHex("MÉDIA REDE")} Tj`
    );
    ops.push(`1 0 0 1 ${col2.diff} ${curY + 6} Tm ${toWinAnsiHex("DESVIO")} Tj`);
    ops.push(
      `1 0 0 1 ${col2.total} ${curY + 6} Tm ${toWinAnsiHex("GASTO (R$)")} Tj ET`
    );

    curY -= rowH;

    const maxStoresPage1 = Math.min(sortedByValue.length, 22);
    for (let i = 0; i < maxStoresPage1; i++) {
      const row = sortedByValue[i];
      if (i % 2 === 1) {
        ops.push("0.973 0.980 0.988 rg");
        ops.push(`${marginX} ${curY} ${contentWidth} ${rowH} re f`);
      }
      ops.push("0.886 0.910 0.941 RG 0.4 w");
      ops.push(`${marginX} ${curY} ${contentWidth} ${rowH} re S`);

      const storeLabel = `${row.store_name}${
        row.store_code ? ` (${row.store_code})` : ""
      }`;
      const diffSign = row.diff_percentage > 0 ? "+" : "";
      const diffStr = `${diffSign}${Number(row.diff_percentage || 0)
        .toFixed(1)
        .replace(".", ",")}%`;

      ops.push("BT 0.059 0.090 0.165 rg /F2 8 Tf");
      ops.push(
        `1 0 0 1 ${col2.rank} ${curY + 5.5} Tm ${toWinAnsiHex(`${i + 1}º`)} Tj`
      );
      ops.push("/F1 8 Tf");
      ops.push(
        `1 0 0 1 ${col2.store} ${curY + 5.5} Tm ${toWinAnsiHex(
          truncateText(storeLabel, 34)
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${col2.items} ${curY + 5.5} Tm ${toWinAnsiHex(
          `${row.total_items.toLocaleString("pt-BR")} un.`
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${col2.avg3m} ${curY + 5.5} Tm ${toWinAnsiHex(
          formatBRL(row.historical_avg)
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${col2.netAvg} ${curY + 5.5} Tm ${toWinAnsiHex(
          formatBRL(row.network_avg)
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${col2.diff} ${curY + 5.5} Tm ${toWinAnsiHex(diffStr)} Tj`
      );
      ops.push("/F2 8 Tf");
      ops.push(
        `1 0 0 1 ${col2.total} ${curY + 5.5} Tm ${toWinAnsiHex(
          formatBRL(row.current_month_total)
        )} Tj ET`
      );

      curY -= rowH;
    }

    // Linha Consolidada Seção 2
    ops.push("0.925 0.945 0.895 rg");
    ops.push(`${marginX} ${curY} ${contentWidth} ${rowH + 2} re f`);
    ops.push("0.333 0.420 0.184 RG 0.8 w");
    ops.push(`${marginX} ${curY} ${contentWidth} ${rowH + 2} re S`);
    ops.push("BT 0.059 0.090 0.165 rg /F2 8.5 Tf");
    ops.push(
      `1 0 0 1 ${col2.store} ${curY + 6} Tm ${toWinAnsiHex(
        `TOTAL CONSOLIDADO NO MÊS (${sortedByValue.length} ${
          sortedByValue.length === 1 ? "loja" : "lojas"
        })`
      )} Tj`
    );
    ops.push(
      `1 0 0 1 ${col2.items} ${curY + 6} Tm ${toWinAnsiHex(
        `${totalStoreItems.toLocaleString("pt-BR")} un.`
      )} Tj`
    );
    ops.push(
      `1 0 0 1 ${col2.total} ${curY + 6} Tm ${toWinAnsiHex(
        formatBRL(totalStoreAmount)
      )} Tj ET`
    );

    pageStreams.push(ops.join("\n"));
  }

  // =========================================================================
  // PÁGINA 2: COMPARATIVO EM QUANTIDADE DE PRODUTOS + EVOLUÇÃO MENSAL
  // =========================================================================
  {
    const ops: string[] = [];
    pushPageBanner(
      ops,
      "Seções 3 e 4: Comparativo de Quantidade (Unid.) e Evolução Mensal"
    );

    let curY = pageHeight - 115;
    const rowH = 19;

    // Título Seção 3: Comparativo de Consumo em Quantidade de Produtos
    ops.push("0.059 0.090 0.165 rg");
    ops.push(`${marginX} ${curY} ${contentWidth} 20 re f`);
    ops.push("BT 1 1 1 rg /F2 9.5 Tf");
    ops.push(
      `1 0 0 1 ${marginX + 10} ${curY + 6} Tm ${toWinAnsiHex(
        "3. COMPARATIVO DE CONSUMO EM QUANTIDADE DE PRODUTOS (UNIDADES POR LOJA)"
      )} Tj ET`
    );

    curY -= rowH;

    // Cabeçalho Tabela Seção 3
    ops.push("0.945 0.961 0.976 rg");
    ops.push(`${marginX} ${curY} ${contentWidth} ${rowH} re f`);
    ops.push("0.796 0.835 0.882 RG 0.6 w");
    ops.push(`${marginX} ${curY} ${contentWidth} ${rowH} re S`);

    const col3 = {
      rank: marginX + 6,
      store: marginX + 34,
      qty: marginX + 225,
      avg3m: marginX + 290,
      netAvg: marginX + 358,
      diff: marginX + 425,
      val: marginX + 472,
    };

    ops.push("BT 0.200 0.255 0.333 rg /F2 7.5 Tf");
    ops.push(`1 0 0 1 ${col3.rank} ${curY + 6} Tm ${toWinAnsiHex("POS.")} Tj`);
    ops.push(`1 0 0 1 ${col3.store} ${curY + 6} Tm ${toWinAnsiHex("LOJA")} Tj`);
    ops.push(
      `1 0 0 1 ${col3.qty} ${curY + 6} Tm ${toWinAnsiHex("QTD. PRODUTOS")} Tj`
    );
    ops.push(
      `1 0 0 1 ${col3.avg3m} ${curY + 6} Tm ${toWinAnsiHex("MÉDIA 3M (UN)")} Tj`
    );
    ops.push(
      `1 0 0 1 ${col3.netAvg} ${curY + 6} Tm ${toWinAnsiHex("REDE (UN)")} Tj`
    );
    ops.push(
      `1 0 0 1 ${col3.diff} ${curY + 6} Tm ${toWinAnsiHex("DESVIO QTD")} Tj`
    );
    ops.push(
      `1 0 0 1 ${col3.val} ${curY + 6} Tm ${toWinAnsiHex("VALOR (R$)")} Tj ET`
    );

    curY -= rowH;

    const maxStoresSec3 = Math.min(sortedByItems.length, 13);
    for (let i = 0; i < maxStoresSec3; i++) {
      const row = sortedByItems[i];
      if (i % 2 === 1) {
        ops.push("0.973 0.980 0.988 rg");
        ops.push(`${marginX} ${curY} ${contentWidth} ${rowH} re f`);
      }
      ops.push("0.886 0.910 0.941 RG 0.4 w");
      ops.push(`${marginX} ${curY} ${contentWidth} ${rowH} re S`);

      const storeLabel = `${row.store_name}${
        row.store_code ? ` (${row.store_code})` : ""
      }`;
      const diffSign = row.items_diff_percentage > 0 ? "+" : "";
      const diffStr = `${diffSign}${Number(row.items_diff_percentage || 0)
        .toFixed(1)
        .replace(".", ",")}%`;

      ops.push("BT 0.059 0.090 0.165 rg /F2 8 Tf");
      ops.push(
        `1 0 0 1 ${col3.rank} ${curY + 5.5} Tm ${toWinAnsiHex(`${i + 1}º`)} Tj`
      );
      ops.push("/F1 8 Tf");
      ops.push(
        `1 0 0 1 ${col3.store} ${curY + 5.5} Tm ${toWinAnsiHex(
          truncateText(storeLabel, 32)
        )} Tj`
      );
      ops.push("/F2 8 Tf");
      ops.push(
        `1 0 0 1 ${col3.qty} ${curY + 5.5} Tm ${toWinAnsiHex(
          `${row.total_items.toLocaleString("pt-BR")} un.`
        )} Tj`
      );
      ops.push("/F1 8 Tf");
      ops.push(
        `1 0 0 1 ${col3.avg3m} ${curY + 5.5} Tm ${toWinAnsiHex(
          `${row.historical_items_avg.toFixed(1).replace(".", ",")} un.`
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${col3.netAvg} ${curY + 5.5} Tm ${toWinAnsiHex(
          `${row.network_items_avg.toFixed(1).replace(".", ",")} un.`
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${col3.diff} ${curY + 5.5} Tm ${toWinAnsiHex(diffStr)} Tj`
      );
      ops.push(
        `1 0 0 1 ${col3.val} ${curY + 5.5} Tm ${toWinAnsiHex(
          formatBRL(row.current_month_total)
        )} Tj ET`
      );

      curY -= rowH;
    }

    // Linha Consolidada Seção 3
    ops.push("0.925 0.945 0.895 rg");
    ops.push(`${marginX} ${curY} ${contentWidth} ${rowH + 2} re f`);
    ops.push("0.333 0.420 0.184 RG 0.8 w");
    ops.push(`${marginX} ${curY} ${contentWidth} ${rowH + 2} re S`);
    ops.push("BT 0.059 0.090 0.165 rg /F2 8.5 Tf");
    ops.push(
      `1 0 0 1 ${col3.store} ${curY + 6} Tm ${toWinAnsiHex(
        "TOTAL DE PRODUTOS SOLICITADOS NO MÊS"
      )} Tj`
    );
    ops.push(
      `1 0 0 1 ${col3.qty} ${curY + 6} Tm ${toWinAnsiHex(
        `${totalStoreItems.toLocaleString("pt-BR")} un.`
      )} Tj`
    );
    ops.push(
      `1 0 0 1 ${col3.val} ${curY + 6} Tm ${toWinAnsiHex(
        formatBRL(totalStoreAmount)
      )} Tj ET`
    );

    // Título Seção 4: Evolução Mensal vs. Média da Rede (Histórico Mês a Mês)
    curY -= 32;
    ops.push("0.059 0.090 0.165 rg");
    ops.push(`${marginX} ${curY} ${contentWidth} 20 re f`);
    ops.push("BT 1 1 1 rg /F2 9.5 Tf");
    ops.push(
      `1 0 0 1 ${marginX + 10} ${curY + 6} Tm ${toWinAnsiHex(
        "4. EVOLUÇÃO MENSAL VS. MÉDIA DA REDE (HISTÓRICO DE VALORES E QUANTIDADES)"
      )} Tj ET`
    );

    curY -= rowH;

    // Cabeçalho Tabela Seção 4
    ops.push("0.945 0.961 0.976 rg");
    ops.push(`${marginX} ${curY} ${contentWidth} ${rowH} re f`);
    ops.push("0.796 0.835 0.882 RG 0.6 w");
    ops.push(`${marginX} ${curY} ${contentWidth} ${rowH} re S`);

    const col4 = {
      idx: marginX + 6,
      month: marginX + 32,
      items: marginX + 155,
      netItems: marginX + 235,
      compras: marginX + 315,
      netVal: marginX + 400,
      diff: marginX + 475,
    };

    ops.push("BT 0.200 0.255 0.333 rg /F2 7.5 Tf");
    ops.push(`1 0 0 1 ${col4.idx} ${curY + 6} Tm ${toWinAnsiHex("#")} Tj`);
    ops.push(
      `1 0 0 1 ${col4.month} ${curY + 6} Tm ${toWinAnsiHex("MÊS / REF.")} Tj`
    );
    ops.push(
      `1 0 0 1 ${col4.items} ${curY + 6} Tm ${toWinAnsiHex("QTD. ITENS")} Tj`
    );
    ops.push(
      `1 0 0 1 ${col4.netItems} ${curY + 6} Tm ${toWinAnsiHex(
        "MÉDIA REDE (UN)"
      )} Tj`
    );
    ops.push(
      `1 0 0 1 ${col4.compras} ${curY + 6} Tm ${toWinAnsiHex(
        "COMPRAS (R$)"
      )} Tj`
    );
    ops.push(
      `1 0 0 1 ${col4.netVal} ${curY + 6} Tm ${toWinAnsiHex(
        "MÉDIA REDE (R$)"
      )} Tj`
    );
    ops.push(
      `1 0 0 1 ${col4.diff} ${curY + 6} Tm ${toWinAnsiHex(
        "DIF. REDE"
      )} Tj ET`
    );

    curY -= rowH;

    const maxMonthsSec4 = Math.min(meta.monthlyEvolutionRows.length, 13);
    for (let i = 0; i < maxMonthsSec4; i++) {
      const row = meta.monthlyEvolutionRows[i];
      if (i % 2 === 1) {
        ops.push("0.973 0.980 0.988 rg");
        ops.push(`${marginX} ${curY} ${contentWidth} ${rowH} re f`);
      }
      ops.push("0.886 0.910 0.941 RG 0.4 w");
      ops.push(`${marginX} ${curY} ${contentWidth} ${rowH} re S`);

      const diffPct =
        row.mediaRedeValor > 0
          ? ((row.compras - row.mediaRedeValor) / row.mediaRedeValor) * 100
          : 0;
      const diffSign = diffPct > 0 ? "+" : "";
      const diffStr = `${diffSign}${diffPct.toFixed(1).replace(".", ",")}%`;

      ops.push("BT 0.059 0.090 0.165 rg /F1 8 Tf");
      ops.push(
        `1 0 0 1 ${col4.idx} ${curY + 5.5} Tm ${toWinAnsiHex(
          String(i + 1)
        )} Tj`
      );
      ops.push("/F2 8 Tf");
      ops.push(
        `1 0 0 1 ${col4.month} ${curY + 5.5} Tm ${toWinAnsiHex(
          `${row.monthLabel.toUpperCase()} (${row.rawMonth})`
        )} Tj`
      );
      ops.push("/F1 8 Tf");
      ops.push(
        `1 0 0 1 ${col4.items} ${curY + 5.5} Tm ${toWinAnsiHex(
          `${row.totalItems.toLocaleString("pt-BR")} un.`
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${col4.netItems} ${curY + 5.5} Tm ${toWinAnsiHex(
          `${row.mediaRedeItens.toFixed(1).replace(".", ",")} un.`
        )} Tj`
      );
      ops.push("/F2 8 Tf");
      ops.push(
        `1 0 0 1 ${col4.compras} ${curY + 5.5} Tm ${toWinAnsiHex(
          formatBRL(row.compras)
        )} Tj`
      );
      ops.push("/F1 8 Tf");
      ops.push(
        `1 0 0 1 ${col4.netVal} ${curY + 5.5} Tm ${toWinAnsiHex(
          formatBRL(row.mediaRedeValor)
        )} Tj`
      );
      ops.push(
        `1 0 0 1 ${col4.diff} ${curY + 5.5} Tm ${toWinAnsiHex(diffStr)} Tj ET`
      );

      curY -= rowH;
    }

    // Linha Consolidada Seção 4
    ops.push("0.925 0.945 0.895 rg");
    ops.push(`${marginX} ${curY} ${contentWidth} ${rowH + 2} re f`);
    ops.push("0.333 0.420 0.184 RG 0.8 w");
    ops.push(`${marginX} ${curY} ${contentWidth} ${rowH + 2} re S`);
    ops.push("BT 0.059 0.090 0.165 rg /F2 8.5 Tf");
    ops.push(
      `1 0 0 1 ${col4.month} ${curY + 6} Tm ${toWinAnsiHex(
        `ACUMULADO HISTÓRICO (${meta.monthlyEvolutionRows.length} ${
          meta.monthlyEvolutionRows.length === 1 ? "mês" : "meses"
        })`
      )} Tj`
    );
    ops.push(
      `1 0 0 1 ${col4.items} ${curY + 6} Tm ${toWinAnsiHex(
        `${totalHistoryItems.toLocaleString("pt-BR")} un.`
      )} Tj`
    );
    ops.push(
      `1 0 0 1 ${col4.compras} ${curY + 6} Tm ${toWinAnsiHex(
        formatBRL(totalHistoryAmount)
      )} Tj ET`
    );

    pageStreams.push(ops.join("\n"));
  }

  // Adiciona rodapé com numeração em todas as páginas
  const generatedAt = new Date().toLocaleString("pt-BR");
  for (let p = 0; p < pageStreams.length; p++) {
    const footerOps = [
      "BT",
      "0.45 0.50 0.58 rg",
      "/F1 8 Tf",
      `1 0 0 1 ${marginX} 24 Tm ${toWinAnsiHex(
        `Controle de Pedidos • Relatório Geral Consolidado (Todos os Cards) • Gerado em ${generatedAt} • Página ${
          p + 1
        } de ${pageStreams.length}`
      )} Tj`,
      "ET",
    ].join("\n");
    pageStreams[p] = `${pageStreams[p]}\n${footerOps}`;
  }

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
