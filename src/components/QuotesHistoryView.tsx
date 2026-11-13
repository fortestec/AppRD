import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  MessageCircle,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { calculateQuoteTotals, formatBRL, formatDateBR } from '../lib/formatters';
import {
  downloadQuotePdf,
  openWhatsAppText,
  shareQuotePdfToWhatsApp,
} from '../lib/whatsappAndPdf';
import type { Quote, QuoteStatus, WorkshopSettings } from '../types/workshop';

interface QuotesHistoryViewProps {
  quotes: Quote[];
  settings: WorkshopSettings;
  onOpenQuote: (quote: Quote) => void;
  onDuplicateQuote: (quote: Quote) => void;
  onDeleteQuote: (id: string) => Promise<void>;
  onApproveAndDeduct: (quote: Quote) => Promise<void>;
  onCreateNewQuote: () => void;
}

const STATUS_LABELS: Record<QuoteStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  completed: 'Concluído',
};

export const QuotesHistoryView: React.FC<QuotesHistoryViewProps> = ({
  quotes,
  settings,
  onOpenQuote,
  onDuplicateQuote,
  onDeleteQuote,
  onApproveAndDeduct,
  onCreateNewQuote,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | QuoteStatus>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ message: string; whatsappUrl?: string } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotes.filter((quote) => {
      if (statusFilter !== 'all' && quote.status !== statusFilter) return false;
      if (!q) return true;
      return (
        quote.number.toLowerCase().includes(q) ||
        quote.customerName.toLowerCase().includes(q) ||
        quote.bikeModel.toLowerCase().includes(q) ||
        quote.bikePlate.toLowerCase().includes(q)
      );
    });
  }, [quotes, search, statusFilter]);

  async function handleSharePdf(quote: Quote) {
    try {
      const result = await shareQuotePdfToWhatsApp(quote, settings);
      if (result.mode === 'native-share') {
        setBanner({ message: `PDF ${result.filename} enviado para compartilhamento.` });
      } else {
        setBanner({
          message: `PDF ${result.filename} baixado. Clique para abrir o WhatsApp e anexar.`,
          whatsappUrl: result.whatsappUrl,
        });
      }
    } catch {
      // cancelled
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
            Histórico de Orçamentos
          </h2>
          <p className="text-sm text-zinc-500">
            Consulte orçamentos salvos, reenvie no WhatsApp ou dê baixa no estoque ao aprovar.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateNewQuote}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 whitespace-nowrap shrink-0 cursor-pointer"
        >
          Novo Orçamento
        </button>
      </div>

      {banner && (
        <div className="rounded-xl p-3.5 bg-zinc-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
          <span>{banner.message}</span>
          <div className="flex items-center gap-2 shrink-0">
            {banner.whatsappUrl && (
              <a
                href={banner.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#16A34A] text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Abrir WhatsApp</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="p-1 text-zinc-400 hover:text-white"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="bg-white border border-zinc-200 rounded-xl p-3 sm:p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, cliente, moto ou placa..."
            className="w-full min-h-[44px] pl-10 pr-8 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-sm focus:bg-white focus:border-zinc-900 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-zinc-700"
              aria-label="Limpar busca"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg w-full sm:w-fit overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'all', label: `Todos (${quotes.length})` },
              { id: 'pending', label: 'Pendentes' },
              { id: 'approved', label: 'Aprovados' },
              { id: 'completed', label: 'Concluídos' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quotes List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center">
          <p className="text-base font-semibold text-zinc-900">
            Nenhum orçamento encontrado
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Quando você salvar ou enviar um orçamento, ele ficará disponível aqui.
          </p>
          <button
            type="button"
            onClick={onCreateNewQuote}
            className="mt-5 min-h-[42px] px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
          >
            Criar Primeiro Orçamento
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((quote) => {
            const totals = calculateQuoteTotals(
              quote.items,
              quote.discountType,
              quote.discountValue
            );

            return (
              <div
                key={quote.id}
                className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="font-mono font-bold text-sm text-zinc-900">
                      {quote.number}
                    </span>
                    <span aria-hidden="true" className="text-zinc-300">·</span>
                    <span
                      className={`text-xs font-semibold ${
                        quote.status === 'approved'
                          ? 'text-emerald-700'
                          : quote.status === 'completed'
                            ? 'text-zinc-700'
                            : 'text-amber-700'
                      }`}
                    >
                      {STATUS_LABELS[quote.status]}
                    </span>
                    {quote.stockDeducted && (
                      <>
                        <span aria-hidden="true" className="text-zinc-300">·</span>
                        <span className="text-xs font-medium text-emerald-700">
                          Estoque baixado
                        </span>
                      </>
                    )}
                    <span aria-hidden="true" className="text-zinc-300">·</span>
                    <span className="text-xs text-zinc-500">{formatDateBR(quote.createdAt)}</span>
                  </div>

                  <div className="text-base font-bold text-zinc-900 truncate">
                    {quote.customerName.trim() || 'Cliente Balcão'}
                    {quote.bikeModel.trim() ? ` — ${quote.bikeModel}` : ''}
                  </div>

                  <div className="text-xs text-zinc-500 flex flex-wrap items-center gap-x-2">
                    {quote.bikePlate && <span className="font-mono">Placa: {quote.bikePlate}</span>}
                    {quote.bikePlate && <span aria-hidden="true">·</span>}
                    <span>
                      {quote.items.length} {quote.items.length === 1 ? 'item' : 'itens'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono font-bold text-zinc-900 text-sm tabular-nums">
                      {formatBRL(totals.grandTotal)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSharePdf(quote)}
                    className="min-h-[40px] px-3 py-2 rounded-xl bg-[#16A34A] text-white text-xs font-semibold hover:bg-emerald-700 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>PDF WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openWhatsAppText(quote, settings)}
                    className="min-h-[40px] px-3 py-2 rounded-xl border border-emerald-600 text-emerald-800 bg-emerald-50/50 text-xs font-semibold hover:bg-emerald-50 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Texto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadQuotePdf(quote, settings)}
                    className="min-h-[40px] min-w-[40px] px-2.5 py-2 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 inline-flex items-center justify-center cursor-pointer"
                    title="Baixar PDF"
                    aria-label="Baixar PDF"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  {!quote.stockDeducted && quote.items.some((i) => i.inventoryId) && (
                    <button
                      type="button"
                      onClick={() => onApproveAndDeduct(quote)}
                      className="min-h-[40px] px-3 py-2 rounded-xl border border-zinc-200 text-zinc-800 hover:bg-zinc-100 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      title="Aprovar e dar baixa nas peças do estoque"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Dar Baixa</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onOpenQuote(quote)}
                    className="min-h-[40px] px-3 py-2 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Abrir</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDuplicateQuote(quote)}
                    className="min-h-[40px] min-w-[40px] px-2.5 py-2 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 inline-flex items-center justify-center cursor-pointer"
                    title="Duplicar orçamento"
                    aria-label="Duplicar orçamento"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  {confirmDeleteId === quote.id ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await onDeleteQuote(quote.id);
                        setConfirmDeleteId(null);
                      }}
                      className="min-h-[40px] px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold cursor-pointer"
                    >
                      Confirmar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(quote.id)}
                      className="min-h-[40px] min-w-[40px] px-2.5 py-2 rounded-xl border border-zinc-200 text-zinc-400 hover:text-red-600 hover:bg-red-50 inline-flex items-center justify-center cursor-pointer"
                      title="Excluir"
                      aria-label="Excluir orçamento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
