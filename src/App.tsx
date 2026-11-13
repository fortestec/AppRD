import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, FileSpreadsheet, Package, Plus, Settings } from 'lucide-react';
import { InventoryView } from './components/InventoryView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { QuoteBuilderView } from './components/QuoteBuilderView';
import { QuotesHistoryView } from './components/QuotesHistoryView';
import { SettingsView } from './components/SettingsView';
import {
  DEFAULT_SETTINGS,
  deleteInventoryItem,
  deleteQuote,
  initializeDatabase,
  saveInventoryItem,
  saveQuote,
  saveWorkshopSettings,
} from './lib/db';
import { createId } from './lib/formatters';
import type { InventoryItem, Quote, WorkshopSettings } from './types/workshop';

type ActiveTab = 'quote' | 'inventory' | 'history' | 'settings';

function makeBlankQuote(settings: WorkshopSettings): Quote {
  const now = new Date().toISOString();
  const seq = String(settings.nextQuoteSequence || 1).padStart(4, '0');
  return {
    id: createId('orc'),
    number: `ORC-${seq}`,
    customerName: '',
    customerPhone: '',
    bikeModel: '',
    bikePlate: '',
    bikeMileage: '',
    items: [],
    discountType: 'fixed',
    discountValue: 0,
    notes: settings.defaultNotes,
    validityDays: settings.defaultValidityDays || 7,
    status: 'pending',
    stockDeducted: false,
    createdAt: now,
    updatedAt: now,
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('quote');
  const [isLoading, setIsLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [settings, setSettings] = useState<WorkshopSettings>(DEFAULT_SETTINGS);
  const [activeQuote, setActiveQuote] = useState<Quote>(() => makeBlankQuote(DEFAULT_SETTINGS));
  const [createPartTrigger, setCreatePartTrigger] = useState(0);

  const loadDatabase = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await initializeDatabase();
      setInventory(data.inventory);
      setQuotes(data.quotes);
      setSettings(data.settings);
      setActiveQuote((prev) =>
        prev.items.length === 0 && !prev.customerName ? makeBlankQuote(data.settings) : prev
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDatabase();
  }, [loadDatabase]);

  const lowStockCount = useMemo(
    () => inventory.filter((i) => i.quantity <= i.minQuantity).length,
    [inventory]
  );

  async function handleSaveInventoryItem(item: InventoryItem) {
    await saveInventoryItem(item);
    setInventory((prev) => {
      const exists = prev.some((i) => i.id === item.id);
      const next = exists ? prev.map((i) => (i.id === item.id ? item : i)) : [...prev, item];
      return next.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    });
  }

  async function handleDeleteInventoryItem(id: string) {
    await deleteInventoryItem(id);
    setInventory((prev) => prev.filter((i) => i.id !== id));
  }

  async function deductStockForQuote(quote: Quote): Promise<void> {
    if (quote.stockDeducted) return;
    const updatedInventory = [...inventory];
    const itemsToPersist: InventoryItem[] = [];

    for (const line of quote.items) {
      if (!line.inventoryId) continue;
      const idx = updatedInventory.findIndex((i) => i.id === line.inventoryId);
      if (idx >= 0) {
        const current = updatedInventory[idx];
        const nextQty = Math.max(0, current.quantity - line.quantity);
        const updatedItem: InventoryItem = {
          ...current,
          quantity: nextQty,
          updatedAt: new Date().toISOString(),
        };
        updatedInventory[idx] = updatedItem;
        itemsToPersist.push(updatedItem);
      }
    }

    await Promise.all(itemsToPersist.map((it) => saveInventoryItem(it)));
    setInventory(updatedInventory);
  }

  async function handleSaveQuote(quoteToSave: Quote, deductStock = false) {
    const alreadyExists = quotes.some((q) => q.id === quoteToSave.id);
    let finalQuote = { ...quoteToSave };

    if (deductStock && !finalQuote.stockDeducted) {
      await deductStockForQuote(finalQuote);
      finalQuote = {
        ...finalQuote,
        status: finalQuote.status === 'pending' ? 'approved' : finalQuote.status,
        stockDeducted: true,
      };
    }

    await saveQuote(finalQuote);
    setActiveQuote(finalQuote);

    setQuotes((prev) => {
      const next = alreadyExists
        ? prev.map((q) => (q.id === finalQuote.id ? finalQuote : q))
        : [finalQuote, ...prev];
      return next.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    if (!alreadyExists) {
      const nextSettings: WorkshopSettings = {
        ...settings,
        nextQuoteSequence: (settings.nextQuoteSequence || 1) + 1,
      };
      setSettings(nextSettings);
      await saveWorkshopSettings(nextSettings);
    }
  }

  async function handleDeleteQuote(id: string) {
    await deleteQuote(id);
    setQuotes((prev) => prev.filter((q) => q.id !== id));
    if (activeQuote.id === id) {
      setActiveQuote(makeBlankQuote(settings));
    }
  }

  function handleResetQuote() {
    setActiveQuote(makeBlankQuote(settings));
    setActiveTab('quote');
  }

  function handleAddInventoryItemToQuote(item: InventoryItem) {
    setActiveQuote((prev) => {
      const idx = prev.items.findIndex((l) => l.inventoryId === item.id);
      if (idx >= 0) {
        const nextItems = [...prev.items];
        nextItems[idx] = { ...nextItems[idx], quantity: nextItems[idx].quantity + 1 };
        return { ...prev, items: nextItems, updatedAt: new Date().toISOString() };
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            id: createId('line'),
            inventoryId: item.id,
            type: 'part',
            description: item.name,
            sku: item.sku,
            quantity: 1,
            unitPrice: item.salePrice,
            photoDataUrl: item.photoDataUrl,
          },
        ],
        updatedAt: new Date().toISOString(),
      };
    });
    setActiveTab('quote');
  }

  function handleOpenQuoteFromHistory(quote: Quote) {
    setActiveQuote(quote);
    setActiveTab('quote');
  }

  function handleDuplicateQuote(quote: Quote) {
    const fresh = makeBlankQuote(settings);
    setActiveQuote({
      ...fresh,
      customerName: quote.customerName,
      customerPhone: quote.customerPhone,
      bikeModel: quote.bikeModel,
      bikePlate: quote.bikePlate,
      bikeMileage: quote.bikeMileage,
      items: quote.items.map((item) => ({ ...item, id: createId('line') })),
      discountType: quote.discountType,
      discountValue: quote.discountValue,
      notes: quote.notes,
      validityDays: quote.validityDays,
    });
    setActiveTab('quote');
  }

  async function handleApproveAndDeductFromHistory(quote: Quote) {
    await handleSaveQuote({ ...quote, status: 'approved' }, true);
  }

  async function handleSaveSettings(next: WorkshopSettings) {
    setSettings(next);
    await saveWorkshopSettings(next);
  }

  const navItems: {
    id: ActiveTab;
    label: string;
    shortLabel: string;
    icon: React.FC<{ className?: string }>;
    counter?: number;
  }[] = [
    { id: 'quote', label: 'Orçamento', shortLabel: 'Orçar', icon: FileSpreadsheet },
    {
      id: 'inventory',
      label: 'Estoque',
      shortLabel: 'Estoque',
      icon: Package,
      counter: lowStockCount > 0 ? lowStockCount : undefined,
    },
    {
      id: 'history',
      label: 'Histórico',
      shortLabel: 'Salvos',
      icon: ClipboardList,
      counter: quotes.length > 0 ? quotes.length : undefined,
    },
    { id: 'settings', label: 'Oficina', shortLabel: 'Oficina', icon: Settings },
  ];

  const activeTitle =
    activeTab === 'quote'
      ? 'Orçamento Rápido'
      : activeTab === 'inventory'
        ? 'Estoque'
        : activeTab === 'history'
          ? 'Histórico'
          : 'Configurações';

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-zinc-900 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[#18181B] text-white border-r border-zinc-800 z-30">
        <div className="h-16 px-6 flex items-center gap-3 border-b border-zinc-800 shrink-0">
          <img src="./icon.svg" alt="RD Motos" className="w-8 h-8 rounded-lg shrink-0" />
          <span className="font-display-heading text-2xl font-bold tracking-tight text-white whitespace-nowrap">
            {settings.name || 'RD Motos'}
          </span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl flex items-center justify-between text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-red-600 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.counter !== undefined && (
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      isActive ? 'text-white/90' : 'text-zinc-400'
                    }`}
                  >
                    {item.counter}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-800 space-y-3">
          <PWAInstallButton />
          <div className="text-[11px] text-zinc-500 leading-relaxed">
            Dados salvos no dispositivo para uso rápido e offline na oficina.
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Desktop Top Bar (Clean 3-zone contextual header) */}
        <header className="hidden lg:flex h-16 px-8 bg-white border-b border-zinc-200 items-center justify-between gap-8 sticky top-0 z-20">
          <div className="text-sm font-medium text-zinc-500 whitespace-nowrap">
            <span className="text-zinc-900 font-semibold">{settings.name || 'RD Motos'}</span>
            <span className="mx-2 text-zinc-300">/</span>
            <span>{activeTitle}</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeTab === 'inventory' ? (
              <button
                type="button"
                onClick={() => setCreatePartTrigger((n) => n + 1)}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Peça</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResetQuote}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Orçamento</span>
              </button>
            )}
          </div>
        </header>

        {/* Mobile Compact Sticky Top Bar (48px - respects <= 15% mobile sticky cap) */}
        <header className="lg:hidden sticky top-0 z-30 h-12 px-4 bg-[#18181B] text-white flex items-center justify-between gap-3 pt-safe">
          <div className="flex items-center gap-2 min-w-0">
            <img src="./icon.svg" alt="RD Motos" className="w-6 h-6 rounded-md shrink-0" />
            <span className="font-display-heading text-lg font-bold tracking-tight whitespace-nowrap">
              {settings.name || 'RD Motos'}
            </span>
            <span className="text-zinc-500 text-xs">·</span>
            <span className="text-xs font-medium text-zinc-300 truncate">{activeTitle}</span>
          </div>
          <PWAInstallButton compact />
        </header>

        {/* Main Content Viewport */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 pb-24 lg:pb-10">
          {isLoading ? (
            <div className="space-y-4">
              <div className="h-9 w-56 bg-zinc-200 rounded-lg animate-pulse" />
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-7 h-72 bg-white border border-zinc-200 rounded-2xl animate-pulse" />
                <div className="lg:col-span-5 h-72 bg-white border border-zinc-200 rounded-2xl animate-pulse" />
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'quote' && (
                <QuoteBuilderView
                  quote={activeQuote}
                  inventory={inventory}
                  settings={settings}
                  onChangeQuote={setActiveQuote}
                  onSaveQuote={handleSaveQuote}
                  onResetQuote={handleResetQuote}
                />
              )}

              {activeTab === 'inventory' && (
                <InventoryView
                  items={inventory}
                  onSaveItem={handleSaveInventoryItem}
                  onDeleteItem={handleDeleteInventoryItem}
                  onAddToQuote={handleAddInventoryItemToQuote}
                  externalCreateTrigger={createPartTrigger}
                />
              )}

              {activeTab === 'history' && (
                <QuotesHistoryView
                  quotes={quotes}
                  settings={settings}
                  onOpenQuote={handleOpenQuoteFromHistory}
                  onDuplicateQuote={handleDuplicateQuote}
                  onDeleteQuote={handleDeleteQuote}
                  onApproveAndDeduct={handleApproveAndDeductFromHistory}
                  onCreateNewQuote={handleResetQuote}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  settings={settings}
                  onSaveSettings={handleSaveSettings}
                  onDatabaseImported={loadDatabase}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile Compact Fixed Bottom Tab Bar (56px height) */}
      <nav
        aria-label="Navegação principal"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-zinc-200 pb-safe"
      >
        <div className="grid grid-cols-4 h-14">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center min-h-[44px] gap-0.5 transition-colors ${
                  isActive ? 'text-red-600' : 'text-zinc-500'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {item.id === 'inventory' && lowStockCount > 0 && (
                    <span className="absolute -top-1 -right-2 text-[9px] font-mono font-bold text-amber-700 bg-amber-100 px-1 rounded-sm">
                      {lowStockCount}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold tracking-tight">{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <OfflineIndicator />
    </div>
  );
}
