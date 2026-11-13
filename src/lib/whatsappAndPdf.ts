import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Quote, WorkshopSettings } from '../types/workshop';
import {
  addDaysFormattedBR,
  calculateQuoteTotals,
  formatBRL,
  formatDateBR,
  toWhatsAppNumber,
} from './formatters';

export interface GeneratedPdfResult {
  blob: Blob;
  filename: string;
}

export function generateQuotePdf(quote: Quote, settings: WorkshopSettings): GeneratedPdfResult {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const totals = calculateQuoteTotals(quote.items, quote.discountType, quote.discountValue);

  // Header band
  doc.setFillColor(24, 24, 27); // Zinc 900
  doc.rect(0, 0, pageWidth, 34, 'F');

  // Racing crimson stripe
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 34, pageWidth, 2, 'F');

  // Workshop Brand
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(settings.name.toUpperCase() || 'RD MOTOS', margin, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(212, 212, 216);
  const subLines: string[] = [];
  if (settings.address) subLines.push(settings.address);
  const contactParts: string[] = [];
  if (settings.phone) contactParts.push(`WhatsApp: ${settings.phone}`);
  if (settings.document) contactParts.push(`CPF/CNPJ: ${settings.document}`);
  if (contactParts.length > 0) subLines.push(contactParts.join('  •  '));
  doc.text(subLines.slice(0, 2), margin, 22);

  // Quote Badge on Right
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`ORÇAMENTO ${quote.number}`, pageWidth - margin, 14, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(212, 212, 216);
  doc.text(`Emissão: ${formatDateBR(quote.createdAt)}`, pageWidth - margin, 21, { align: 'right' });
  doc.text(
    `Validade: ${addDaysFormattedBR(quote.createdAt, quote.validityDays)}`,
    pageWidth - margin,
    26.5,
    { align: 'right' }
  );

  // Customer & Motorcycle Info Box
  const infoTop = 42;
  doc.setFillColor(244, 244, 245);
  doc.setDrawColor(228, 228, 231);
  doc.roundedRect(margin, infoTop, pageWidth - margin * 2, 24, 2, 2, 'FD');

  doc.setTextColor(113, 113, 122);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('CLIENTE', margin + 4, infoTop + 6);
  doc.text('MOTOCICLETA / VEÍCULO', margin + 96, infoTop + 6);

  doc.setTextColor(24, 24, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(quote.customerName.trim() || 'Cliente Balcão', margin + 4, infoTop + 12.5);
  doc.text(quote.bikeModel.trim() || 'Motocicleta não informada', margin + 96, infoTop + 12.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(82, 82, 91);
  doc.text(
    quote.customerPhone.trim() ? `WhatsApp: ${quote.customerPhone}` : 'Telefone não informado',
    margin + 4,
    infoTop + 19
  );
  const bikeMeta = [
    quote.bikePlate.trim() ? `Placa: ${quote.bikePlate.toUpperCase()}` : null,
    quote.bikeMileage.trim() ? `KM: ${quote.bikeMileage}` : null,
  ]
    .filter(Boolean)
    .join('   •   ');
  doc.text(bikeMeta || 'Sem placa / KM informados', margin + 96, infoTop + 19);

  // Items Table
  const rows = quote.items.map((item, idx) => [
    String(idx + 1).padStart(2, '0'),
    item.type === 'part' ? 'Peça' : 'Serviço',
    item.sku ? `${item.description}\nCód: ${item.sku}` : item.description,
    String(item.quantity),
    formatBRL(item.unitPrice),
    formatBRL(item.quantity * item.unitPrice),
  ]);

  autoTable(doc, {
    startY: infoTop + 30,
    margin: { left: margin, right: margin },
    head: [['#', 'Tipo', 'Descrição', 'Qtd', 'Unitário', 'Subtotal']],
    body: rows.length > 0 ? rows : [['—', '—', 'Nenhum item lançado neste orçamento', '0', 'R$ 0,00', 'R$ 0,00']],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 3.2,
      textColor: [24, 24, 27],
      lineColor: [228, 228, 231],
      lineWidth: 0.25,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [39, 39, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120;

  // Summary Block
  let summaryY = finalY + 8;
  if (summaryY > 245) {
    doc.addPage();
    summaryY = 20;
  }

  const boxWidth = 82;
  const boxX = pageWidth - margin - boxWidth;

  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(228, 228, 231);
  doc.roundedRect(boxX, summaryY, boxWidth, totals.discountAmount > 0 ? 34 : 27, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setTextColor(82, 82, 91);
  doc.setFont('helvetica', 'normal');
  doc.text('Peças:', boxX + 4, summaryY + 6.5);
  doc.text(formatBRL(totals.partsSubtotal), boxX + boxWidth - 4, summaryY + 6.5, { align: 'right' });

  doc.text('Mão de Obra:', boxX + 4, summaryY + 12.5);
  doc.text(formatBRL(totals.servicesSubtotal), boxX + boxWidth - 4, summaryY + 12.5, { align: 'right' });

  let totalLineY = summaryY + 21;
  if (totals.discountAmount > 0) {
    doc.setTextColor(220, 38, 38);
    doc.text(
      quote.discountType === 'percent' ? `Desconto (${quote.discountValue}%):` : 'Desconto:',
      boxX + 4,
      summaryY + 18.5
    );
    doc.text(`- ${formatBRL(totals.discountAmount)}`, boxX + boxWidth - 4, summaryY + 18.5, {
      align: 'right',
    });
    totalLineY = summaryY + 27.5;
  }

  doc.setDrawColor(212, 212, 216);
  doc.line(boxX + 4, totalLineY - 5, boxX + boxWidth - 4, totalLineY - 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(24, 24, 27);
  doc.text('TOTAL:', boxX + 4, totalLineY);
  doc.setTextColor(220, 38, 38);
  doc.text(formatBRL(totals.grandTotal), boxX + boxWidth - 4, totalLineY, { align: 'right' });

  // Notes & PIX on the left side of Summary
  const notesWidth = pageWidth - margin * 2 - boxWidth - 8;
  let notesCursor = summaryY + 4;
  if (quote.notes.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(113, 113, 122);
    doc.text('OBSERVAÇÕES E GARANTIA', margin, notesCursor);
    notesCursor += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(63, 63, 70);
    const wrapped = doc.splitTextToSize(quote.notes.trim(), notesWidth);
    doc.text(wrapped, margin, notesCursor);
    notesCursor += wrapped.length * 4.2 + 3;
  }

  if (settings.pixKey.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(24, 24, 27);
    doc.text(`Chave PIX para pagamento: ${settings.pixKey.trim()}`, margin, Math.max(notesCursor, summaryY + 22));
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(228, 228, 231);
  doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(113, 113, 122);
  doc.text(
    `${settings.name || 'RD Motos'} — Orçamento gerado em ${formatDateBR(quote.createdAt)}`,
    margin,
    pageHeight - 10
  );
  doc.text('Obrigado pela preferência!', pageWidth - margin, pageHeight - 10, { align: 'right' });

  const safeClient = (quote.customerName || 'Cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  const filename = `Orcamento-RD-Motos-${quote.number}-${safeClient || 'Cliente'}.pdf`;

  return {
    blob: doc.output('blob'),
    filename,
  };
}

export function downloadQuotePdf(quote: Quote, settings: WorkshopSettings): string {
  const { blob, filename } = generateQuotePdf(quote, settings);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return filename;
}

export function buildWhatsAppText(quote: Quote, settings: WorkshopSettings): string {
  const totals = calculateQuoteTotals(quote.items, quote.discountType, quote.discountValue);
  const lines: string[] = [];

  lines.push(`*${(settings.name || 'RD Motos').toUpperCase()} — ORÇAMENTO ${quote.number}*`);
  lines.push(`Data: ${formatDateBR(quote.createdAt)} | Validade: ${addDaysFormattedBR(quote.createdAt, quote.validityDays)}`);
  lines.push('');

  if (quote.customerName.trim()) {
    lines.push(`*Cliente:* ${quote.customerName.trim()}`);
  }
  const bikeParts = [
    quote.bikeModel.trim() || null,
    quote.bikePlate.trim() ? `Placa: ${quote.bikePlate.toUpperCase()}` : null,
    quote.bikeMileage.trim() ? `KM: ${quote.bikeMileage}` : null,
  ].filter(Boolean);
  if (bikeParts.length > 0) {
    lines.push(`*Moto:* ${bikeParts.join(' · ')}`);
  }

  lines.push('');
  lines.push('*ITENS DO ORÇAMENTO:*');

  const parts = quote.items.filter((i) => i.type === 'part');
  const services = quote.items.filter((i) => i.type === 'service');

  if (parts.length > 0) {
    lines.push('_Peças:_');
    for (const item of parts) {
      const sub = formatBRL(item.quantity * item.unitPrice);
      lines.push(`• ${item.quantity}x ${item.description} (${formatBRL(item.unitPrice)}) = *${sub}*`);
    }
  }

  if (services.length > 0) {
    if (parts.length > 0) lines.push('');
    lines.push('_Mão de Obra / Serviços:_');
    for (const item of services) {
      const sub = formatBRL(item.quantity * item.unitPrice);
      lines.push(`• ${item.quantity}x ${item.description} = *${sub}*`);
    }
  }

  lines.push('');
  if (totals.discountAmount > 0) {
    lines.push(`Subtotal: ${formatBRL(totals.grossSubtotal)}`);
    lines.push(`Desconto: - ${formatBRL(totals.discountAmount)}`);
  }
  lines.push(`*TOTAL GERAL: ${formatBRL(totals.grandTotal)}*`);

  if (settings.pixKey.trim()) {
    lines.push('');
    lines.push(`PIX: ${settings.pixKey.trim()}`);
  }

  if (quote.notes.trim()) {
    lines.push('');
    lines.push(`Obs: ${quote.notes.trim()}`);
  }

  if (settings.phone.trim()) {
    lines.push('');
    lines.push(`${settings.name || 'RD Motos'} · ${settings.phone.trim()}`);
  }

  return lines.join('\n');
}

export function buildWhatsAppUrl(phone: string, text: string): string {
  const clean = toWhatsAppNumber(phone);
  const encoded = encodeURIComponent(text);
  return clean ? `https://wa.me/${clean}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export function openWhatsAppText(quote: Quote, settings: WorkshopSettings): string {
  const text = buildWhatsAppText(quote, settings);
  const url = buildWhatsAppUrl(quote.customerPhone, text);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  return text;
}

export type SharePdfResult =
  | { mode: 'native-share'; filename: string }
  | { mode: 'download-fallback'; filename: string; whatsappUrl: string };

export async function shareQuotePdfToWhatsApp(
  quote: Quote,
  settings: WorkshopSettings
): Promise<SharePdfResult> {
  const { blob, filename } = generateQuotePdf(quote, settings);
  const file = new File([blob], filename, { type: 'application/pdf' });
  const totals = calculateQuoteTotals(quote.items, quote.discountType, quote.discountValue);
  const shortSummary = `Olá${quote.customerName.trim() ? ` ${quote.customerName.trim()}` : ''}! Segue o orçamento ${quote.number} da ${settings.name || 'RD Motos'} no valor de ${formatBRL(totals.grandTotal)}.`;

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };

  if (typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: `Orçamento ${quote.number} — ${settings.name || 'RD Motos'}`,
        text: shortSummary,
      });
      return { mode: 'native-share', filename };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      // Fall through to download fallback if native share fails on desktop/iframe
    }
  }

  // Fallback for desktop browsers / sandboxed iframes: download PDF + offer 1-click WhatsApp link
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);

  return {
    mode: 'download-fallback',
    filename,
    whatsappUrl: buildWhatsAppUrl(quote.customerPhone, shortSummary),
  };
}
