export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatDateBR(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function addDaysFormattedBR(isoString: string, days: number): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  date.setDate(date.getDate() + Math.max(0, days));
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatPhoneMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
  return digits;
}

export function createId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function compressImageToDataUrl(file: File, maxDimension = 760, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler a imagem selecionada.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagem inválido.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível processar a imagem.'));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function calculateQuoteTotals(
  items: { type: 'part' | 'service'; quantity: number; unitPrice: number }[],
  discountType: 'fixed' | 'percent',
  discountValue: number
) {
  let partsSubtotal = 0;
  let servicesSubtotal = 0;

  for (const item of items) {
    const lineTotal = Math.max(0, item.quantity) * Math.max(0, item.unitPrice);
    if (item.type === 'part') partsSubtotal += lineTotal;
    else servicesSubtotal += lineTotal;
  }

  const grossSubtotal = partsSubtotal + servicesSubtotal;
  const safeDiscountVal = Math.max(0, discountValue || 0);
  const discountAmount =
    discountType === 'percent'
      ? Math.min(grossSubtotal, (grossSubtotal * Math.min(100, safeDiscountVal)) / 100)
      : Math.min(grossSubtotal, safeDiscountVal);
  const grandTotal = Math.max(0, grossSubtotal - discountAmount);

  return {
    partsSubtotal,
    servicesSubtotal,
    grossSubtotal,
    discountAmount,
    grandTotal,
  };
}
