import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  MessageCircle,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import {
  calculateQuoteTotals,
  createId,
  formatBRL,
  formatPhoneMask,
} from '../lib/formatters';
import {
  buildWhatsAppText,
  downloadQuotePdf,
  openWhatsAppText,
  shareQuotePdfToWhatsApp,
  type SharePdfResult,
} from '../lib/whatsappAndPdf';
import type {
  InventoryItem,
  Quote,
  QuoteLineItem,
  QuoteLineType,
  WorkshopSettings,
} from '../types/workshop';
import { PartThumbnail } from './PartThumbnail';

interface QuoteBuilderViewProps {
  quote: Quote;
  inventory: InventoryItem[];
  settings: WorkshopSettings;
  onChangeQuote: (updated: Quote) => void;
  onSaveQuote: (quoteToSave: Quote, deductStock?: boolean) => Promise<void>;
  onResetQuote: () => void;
}

export const QuoteBuilderView: React.FC<QuoteBuilderViewProps> = ({
  quote,
  inventory,
  settings,
  onChangeQuote,
  onSaveQuote,
  onResetQuote,
}) => {
  const [partSearch, setPartSearch] = useState('');
  const [customType, setCustomType] = useState<QuoteLineType>('service');
  const [customDesc, setCustomDesc] = useState('');
  const [customQty, setCustomQty] = useState('1');
  const [customPrice, setCustomPrice] = useState('');
  const [showTextPreview, setShowTextPreview] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    whatsappUrl?: string;
    kind: 'success' | 'info' | 'error';
  } | null>(null);
  const [isSendingPdf, setIsSendingPdf] = useState(false);

  const totals = useMemo(
    () => calculateQuoteTotals(quote.items, quote.discountType, quote.discountValue),
    [quote.items, quote.discountType, quote.discountValue]
  );

  const matchingInventory = useMemo(() => {
    const q = partSearch.trim().toLowerCase();
    const list = q
      ? inventory.filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            item.sku.toLowerCase().includes(q) ||
            item.brand.toLowerCase().includes(q) ||
            item.compatibleBikes.toLowerCase().includes(q)
        )
      : inventory;
    return list.slice(0, 18);
  }, [inventory, partSearch]);

  function addInventoryPart(item: InventoryItem) {
    const existingIndex = quote.items.findIndex((line) => line.inventoryId === item.id);
    if (existingIndex >= 0) {
      const next = [...quote.items];
      next[existingIndex] = {
        ...next[existingIndex],
        quantity: next[existingIndex].quantity + 1,
      };
      onChangeQuote({ ...quote, items: next, updatedAt: new Date().toISOString() });
    } else {
      const newLine: QuoteLineItem = {
        id: createId('line'),
        inventoryId: item.id,
        type: 'part',
        description: item.name,
        sku: item.sku,
        quantity: 1,
        unitPrice: item.salePrice,
        photoDataUrl: item.photoDataUrl,
      };
      onChangeQuote({
        ...quote,
        items: [...quote.items, newLine],
        updatedAt: new Date().toISOString(),
      });
    }
  }

  function addPresetService(name: string, defaultPrice: number) {
    const newLine: QuoteLineItem = {
      id: createId('line'),
      type: 'service',
      description: name,
      quantity: 1,
      unitPrice: defaultPrice,
    };
    onChangeQuote({
      ...quote,
      items: [...quote.items, newLine],
      updatedAt: new Date().toISOString(),
    });
  }

  function handleAddCustomLine(e: React.FormEvent) {
    e.preventDefault();
    if (!customDesc.trim()) return;
    const price = parseFloat(customPrice.replace(',', '.')) || 0;
    const qty = Math.max(1, parseInt(customQty, 10) || 1);

    const newLine: QuoteLineItem = {
      id: createId('line'),
      type: customType,
      description: customDesc.trim(),
      quantity: qty,
      unitPrice: price,
    };
    onChangeQuote({
      ...quote,
      items: [...quote.items, newLine],
      updatedAt: new Date().toISOString(),
    });
    setCustomDesc('');
    setCustomQty('1');
    setCustomPrice('');
  }

  function updateLineQty(lineId: string, delta: number) {
    const next = quote.items
      .map((line) => {
        if (line.id !== lineId) return line;
        const newQty = line.quantity + delta;
        return newQty <= 0 ? null : { ...line, quantity: newQty };
      })
      .filter(Boolean) as QuoteLineItem[];
    onChangeQuote({ ...quote, items: next, updatedAt: new Date().toISOString() });
  }

  function updateLinePrice(lineId: string, rawPrice: string) {
    const parsed = parseFloat(rawPrice.replace(',', '.'));
    const next = quote.items.map((line) =>
      line.id === lineId ? { ...line, unitPrice: Number.isNaN(parsed) ? 0 : Math.max(0, parsed) } : line
    );
    onChangeQuote({ ...quote, items: next, updatedAt: new Date().toISOString() });
  }

  function removeLine(lineId: string) {
    onChangeQuote({
      ...quote,
      items: quote.items.filter((l) => l.id !== lineId),
      updatedAt: new Date().toISOString(),
    });
  }

  async function ensureSaved(): Promise<Quote> {
    const stamped = { ...quote, updatedAt: new Date().toISOString() };
    await onSaveQuote(stamped, false);
    return stamped;
  }

  async function handleSendPdfWhatsApp() {
    if (quote.items.length === 0) {
      setFeedback({
        kind: 'error',
        message: 'Adicione pelo menos uma peça ou serviço antes de gerar o PDF.',
      });
      return;
    }

    setIsSendingPdf(true);
    try {
      const saved = await ensureSaved();
      const result: SharePdfResult = await shareQuotePdfToWhatsApp(saved, settings);
      if (result.mode === 'native-share') {
        setFeedback({
          kind: 'success',
          message: `PDF "${result.filename}" enviado para compartilhamento no WhatsApp.`,
        });
      } else {
        setFeedback({
          kind: 'info',
          message: `PDF "${result.filename}" baixado! Clique ao lado para abrir o WhatsApp e anexar o arquivo.`,
          whatsappUrl: result.whatsappUrl,
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setFeedback({ kind: 'info', message: 'Compartilhamento cancelado.' });
      } else {
        setFeedback({
          kind: 'error',
          message: 'Não foi possível gerar o PDF. Tente baixar o PDF diretamente.',
        });
      }
    } finally {
      setIsSendingPdf(false);
    }
  }

  async function handleSendTextWhatsApp() {
    if (quote.items.length === 0) {
      setFeedback({
        kind: 'error',
        message: 'Adicione pelo menos uma peça ou serviço antes de enviar.',
      });
      return;
    }
    const saved = await ensureSaved();
    openWhatsAppText(saved, settings);
    setFeedback({
      kind: 'success',
      message: 'Orçamento salvo e aberto como texto no WhatsApp.',
    });
  }

  async function handleDownloadPdfOnly() {
    if (quote.items.length === 0) {
      setFeedback({
        kind: 'error',
        message: 'Adicione pelo menos uma peça ou serviço para baixar o PDF.',
      });
      return;
    }
    const saved = await ensureSaved();
    const filename = downloadQuotePdf(saved, settings);
    setFeedback({
      kind: 'success',
      message: `PDF salvo: ${filename}`,
    });
  }

  async function handleCopyText() {
    if (quote.items.length === 0) return;
    const text = buildWhatsAppText(quote, settings);
    await navigator.clipboard.writeText(text);
    setFeedback({
      kind: 'success',
      message: 'Texto do orçamento copiado para a área de transferência.',
    });
  }

  async function handleSaveOnly(deductStock = false) {
    if (quote.items.length === 0) {
      setFeedback({
        kind: 'error',
        message: 'Adicione itens antes de salvar o orçamento.',
      });
      return;
    }
    const targetStatus = deductStock ? 'approved' : quote.status;
    await onSaveQuote({ ...quote, status: targetStatus, updatedAt: new Date().toISOString() }, deductStock);
    setFeedback({
      kind: 'success',
      message: deductStock
        ? `Orçamento ${quote.number} salvo, aprovado e com baixa automática no estoque!`
        : `Orçamento ${quote.number} salvo no histórico.`,
    });
  }

  const whatsAppPreviewText = useMemo(() => buildWhatsAppText(quote, settings), [quote, settings]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
              Orçamento {quote.number}
            </h2>
            <span className="text-xs font-medium text-zinc-500">
              · {quote.items.length} {quote.items.length === 1 ? 'item' : 'itens'}
            </span>
          </div>
          <p className="text-sm text-zinc-500">
            Monte o orçamento em segundos e envie em PDF ou texto direto para o WhatsApp do cliente.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetQuote}
            className="min-h-[42px] px-3.5 py-2 rounded-xl border border-zinc-300 bg-white text-xs font-semibold text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Novo Orçamento</span>
          </button>
          <button
            type="button"
            onClick={() => handleSaveOnly(false)}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Salvar</span>
          </button>
        </div>
      </div>

      {/* Mobile Quick-Jump Strip to Summary & WhatsApp Actions */}
      <div className="lg:hidden bg-white border border-zinc-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium text-zinc-500">
            Total ({quote.items.length} {quote.items.length === 1 ? 'item' : 'itens'})
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-red-600">
            {formatBRL(totals.grandTotal)}
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            document.getElementById('quote-summary')?.scrollIntoView({ behavior: 'smooth' })
          }
          className="min-h-[42px] px-4 py-2 rounded-xl bg-[#16A34A] text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Enviar / Resumo</span>
        </button>
      </div>

      {/* Inline Feedback Banner */}
      {feedback && (
        <div
          className={`rounded-xl p-3.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm ${
            feedback.kind === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : feedback.kind === 'info'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-zinc-900 border-zinc-900 text-white'
          }`}
        >
          <span className="font-medium">{feedback.message}</span>
          <div className="flex items-center gap-2 shrink-0">
            {feedback.whatsappUrl && (
              <a
                href={feedback.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#16A34A] text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-emerald-700"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Abrir WhatsApp Web</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="p-1.5 rounded-lg opacity-70 hover:opacity-100"
              aria-label="Fechar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Customer/Bike + Parts Picker + Services */}
        <div className="lg:col-span-7 space-y-5">
          {/* Customer & Motorcycle Info */}
          <section className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <h3 className="text-sm font-bold text-zinc-900">1. Cliente e Motocicleta</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Nome do Cliente
                </label>
                <input
                  type="text"
                  value={quote.customerName}
                  onChange={(e) => onChangeQuote({ ...quote, customerName: e.target.value })}
                  placeholder="Ex: João Silva"
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-sm focus:bg-white focus:border-zinc-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  WhatsApp do Cliente
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={quote.customerPhone}
                  onChange={(e) =>
                    onChangeQuote({ ...quote, customerPhone: formatPhoneMask(e.target.value) })
                  }
                  placeholder="(11) 99999-9999"
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-sm font-mono focus:bg-white focus:border-zinc-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Modelo da Moto
                </label>
                <input
                  type="text"
                  value={quote.bikeModel}
                  onChange={(e) => onChangeQuote({ ...quote, bikeModel: e.target.value })}
                  placeholder="Ex: Honda CG 160 Titan 2023"
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-sm focus:bg-white focus:border-zinc-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Placa</label>
                  <input
                    type="text"
                    value={quote.bikePlate}
                    onChange={(e) =>
                      onChangeQuote({ ...quote, bikePlate: e.target.value.toUpperCase() })
                    }
                    placeholder="ABC-1D23"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-sm font-mono uppercase focus:bg-white focus:border-zinc-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">KM</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={quote.bikeMileage}
                    onChange={(e) => onChangeQuote({ ...quote, bikeMileage: e.target.value })}
                    placeholder="24.500"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-sm font-mono focus:bg-white focus:border-zinc-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Pick Parts from Inventory */}
          <section className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-zinc-900">2. Pegar Peças do Estoque</h3>
              <span className="text-xs text-zinc-500">{inventory.length} cadastradas</span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={partSearch}
                onChange={(e) => setPartSearch(e.target.value)}
                placeholder="Buscar peça do estoque por nome, código ou moto..."
                className="w-full min-h-[44px] pl-10 pr-8 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-sm focus:bg-white focus:border-zinc-900 focus:outline-none"
              />
              {partSearch && (
                <button
                  type="button"
                  onClick={() => setPartSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-zinc-700"
                  aria-label="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {matchingInventory.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4 text-center">
                Nenhuma peça encontrada no estoque para &ldquo;{partSearch}&rdquo;.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
                {matchingInventory.map((item) => {
                  const inQuoteQty =
                    quote.items.find((line) => line.inventoryId === item.id)?.quantity ?? 0;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addInventoryPart(item)}
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 text-left transition-colors cursor-pointer group"
                    >
                      <PartThumbnail src={item.photoDataUrl} alt={item.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-zinc-900 truncate">
                          {item.name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-zinc-500 flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-zinc-800">
                            {formatBRL(item.salePrice)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className={item.quantity === 0 ? 'text-red-600 font-semibold' : ''}>
                            Est: {item.quantity}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`min-w-[32px] h-8 px-2 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                          inQuoteQty > 0
                            ? 'bg-red-600 text-white'
                            : 'bg-zinc-100 text-zinc-700 group-hover:bg-zinc-900 group-hover:text-white'
                        }`}
                      >
                        {inQuoteQty > 0 ? `+${inQuoteQty}` : <Plus className="w-4 h-4" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Quick Service Presets & Custom Item */}
          <section className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-bold text-zinc-900">
              3. Mão de Obra Rápida ou Item Avulso
            </h3>

            {settings.servicePresets.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {settings.servicePresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => addPresetService(preset.name, preset.defaultPrice)}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 hover:border-zinc-300 text-xs font-medium text-zinc-800 inline-flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span className="truncate max-w-[220px]">{preset.name}</span>
                    <span className="font-mono font-semibold text-zinc-900">
                      {formatBRL(preset.defaultPrice)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <form
              onSubmit={handleAddCustomLine}
              className="pt-3 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
            >
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-zinc-600 mb-1">Tipo</label>
                <select
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value as QuoteLineType)}
                  className="w-full min-h-[42px] px-2.5 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-xs font-semibold focus:bg-white focus:border-zinc-900 focus:outline-none"
                >
                  <option value="service">Mão de Obra</option>
                  <option value="part">Peça Avulsa</option>
                </select>
              </div>
              <div className="sm:col-span-5">
                <label className="block text-xs font-medium text-zinc-600 mb-1">Descrição</label>
                <input
                  type="text"
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  placeholder="Ex: Alinhamento de roda / Peça especial"
                  className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-sm focus:bg-white focus:border-zinc-900 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 sm:col-span-4 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    placeholder="0,00"
                    className="w-full min-h-[42px] px-2.5 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-sm font-mono focus:bg-white focus:border-zinc-900 focus:outline-none"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Incluir</span>
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>

        {/* Right Column: Active Quote Summary & WhatsApp/PDF Actions */}
        <div id="quote-summary" className="lg:col-span-5 lg:sticky lg:top-6 space-y-4 scroll-mt-16">
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900">Resumo do Orçamento</h3>
                <p className="text-xs text-zinc-500">
                  {quote.customerName || 'Cliente Balcão'}
                  {quote.bikeModel ? ` · ${quote.bikeModel}` : ''}
                </p>
              </div>
              <select
                value={quote.status}
                onChange={(e) =>
                  onChangeQuote({ ...quote, status: e.target.value as Quote['status'] })
                }
                aria-label="Status do orçamento"
                className="min-h-[36px] px-2.5 py-1 rounded-lg border border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-800"
              >
                <option value="pending">Pendente</option>
                <option value="approved">Aprovado</option>
                <option value="completed">Concluído</option>
              </select>
            </div>

            {/* Line Items */}
            {quote.items.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-zinc-200 rounded-xl">
                <p className="text-sm font-medium text-zinc-600">Nenhum item adicionado</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Toque nas peças do estoque ou serviços ao lado.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 max-h-[320px] overflow-y-auto pr-1">
                {quote.items.map((line) => (
                  <div key={line.id} className="py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        {line.type === 'part' && (
                          <PartThumbnail src={line.photoDataUrl} alt={line.description} size="sm" />
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-900 leading-snug">
                            {line.description}
                          </div>
                          <div className="text-[11px] text-zinc-500 mt-0.5">
                            {line.type === 'part' ? 'Peça' : 'Mão de Obra'}
                            {line.sku ? ` · ${line.sku}` : ''}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(line.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-600 shrink-0 cursor-pointer"
                        aria-label="Remover item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex items-center border border-zinc-200 rounded-lg bg-zinc-50">
                        <button
                          type="button"
                          onClick={() => updateLineQty(line.id, -1)}
                          className="w-8 h-8 flex items-center justify-center text-zinc-700 hover:bg-zinc-200/60 rounded-l-lg cursor-pointer"
                          aria-label="Diminuir quantidade"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center font-mono text-xs font-bold tabular-nums">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateLineQty(line.id, 1)}
                          className="w-8 h-8 flex items-center justify-center text-zinc-700 hover:bg-zinc-200/60 rounded-r-lg cursor-pointer"
                          aria-label="Aumentar quantidade"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-zinc-200 rounded-lg px-2 bg-zinc-50">
                          <span className="text-[11px] text-zinc-400 mr-1">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.unitPrice}
                            onChange={(e) => updateLinePrice(line.id, e.target.value)}
                            aria-label="Valor unitário"
                            className="w-16 h-8 bg-transparent text-xs font-mono text-right text-zinc-800 focus:outline-none"
                          />
                        </div>
                        <div className="font-mono font-bold text-sm text-zinc-900 tabular-nums min-w-[76px] text-right">
                          {formatBRL(line.quantity * line.unitPrice)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Discount & Notes */}
            <div className="pt-3 border-t border-zinc-100 space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    Desconto
                  </label>
                  <div className="flex">
                    <select
                      value={quote.discountType}
                      onChange={(e) =>
                        onChangeQuote({
                          ...quote,
                          discountType: e.target.value as 'fixed' | 'percent',
                        })
                      }
                      aria-label="Tipo de desconto"
                      className="min-h-[38px] px-2 rounded-l-lg border border-r-0 border-zinc-200 bg-zinc-100 text-xs font-semibold"
                    >
                      <option value="fixed">R$</option>
                      <option value="percent">%</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={quote.discountValue || ''}
                      onChange={(e) =>
                        onChangeQuote({
                          ...quote,
                          discountValue: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0"
                      className="w-full min-h-[38px] px-2.5 rounded-r-lg border border-zinc-200 bg-zinc-50 text-xs font-mono focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                    Validade (dias)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quote.validityDays}
                    onChange={(e) =>
                      onChangeQuote({
                        ...quote,
                        validityDays: Math.max(1, parseInt(e.target.value, 10) || 7),
                      })
                    }
                    className="w-full min-h-[38px] px-2.5 rounded-lg border border-zinc-200 bg-zinc-50 text-xs font-mono focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                  Observações / Garantia
                </label>
                <textarea
                  rows={2}
                  value={quote.notes}
                  onChange={(e) => onChangeQuote({ ...quote, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-xs text-zinc-800 focus:bg-white focus:border-zinc-900 focus:outline-none resize-none"
                />
              </div>
            </div>

            {/* Totals Breakdown */}
            <div className="pt-3 border-t border-zinc-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-600">
                <span>Peças</span>
                <span className="font-mono tabular-nums">{formatBRL(totals.partsSubtotal)}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Mão de Obra</span>
                <span className="font-mono tabular-nums">{formatBRL(totals.servicesSubtotal)}</span>
              </div>
              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-red-600 font-medium">
                  <span>Desconto</span>
                  <span className="font-mono tabular-nums">
                    - {formatBRL(totals.discountAmount)}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-zinc-100 flex items-baseline justify-between">
                <span className="text-sm font-bold text-zinc-900">TOTAL GERAL</span>
                <span className="text-2xl font-bold font-mono tabular-nums text-red-600">
                  {formatBRL(totals.grandTotal)}
                </span>
              </div>
            </div>

            {/* Direct WhatsApp & PDF Actions */}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                disabled={isSendingPdf}
                onClick={handleSendPdfWhatsApp}
                className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#16A34A] text-white text-sm font-bold hover:bg-emerald-700 active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-60"
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>{isSendingPdf ? 'Gerando PDF...' : 'Enviar PDF no WhatsApp'}</span>
              </button>

              <button
                type="button"
                onClick={handleSendTextWhatsApp}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border-2 border-[#16A34A] bg-emerald-50/60 text-emerald-800 text-sm font-bold hover:bg-emerald-50 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>Enviar como Texto no WhatsApp</span>
              </button>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPdfOnly}
                  className="min-h-[42px] px-2.5 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 hover:bg-zinc-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="min-h-[42px] px-2.5 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 hover:bg-zinc-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Texto</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveOnly(true)}
                  disabled={quote.stockDeducted || quote.items.every((i) => !i.inventoryId)}
                  className="min-h-[42px] px-2.5 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Aprovar orçamento e descontar peças do estoque"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{quote.stockDeducted ? 'Baixado' : 'Dar Baixa'}</span>
                </button>
              </div>
            </div>

            {/* Optional Collapsible Text Preview */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowTextPreview((v) => !v)}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900 underline cursor-pointer"
              >
                {showTextPreview ? 'Ocultar prévia da mensagem' : 'Ver prévia do texto WhatsApp'}
              </button>
              {showTextPreview && (
                <pre className="mt-2 p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-[11px] font-mono text-zinc-700 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                  {whatsAppPreviewText}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
