import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  ImagePlus,
  Minus,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { compressImageToDataUrl, createId, formatBRL } from '../lib/formatters';
import { PART_CATEGORIES, type InventoryItem, type PartCategory } from '../types/workshop';
import { PartThumbnail } from './PartThumbnail';

interface InventoryViewProps {
  items: InventoryItem[];
  onSaveItem: (item: InventoryItem) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onAddToQuote: (item: InventoryItem) => void;
  externalCreateTrigger?: number;
}

type StockFilter = 'all' | 'low' | 'out';

interface ItemFormState {
  id?: string;
  name: string;
  sku: string;
  brand: string;
  category: PartCategory;
  compatibleBikes: string;
  quantity: string;
  minQuantity: string;
  costPrice: string;
  salePrice: string;
  location: string;
  photoDataUrl?: string;
}

const EMPTY_FORM: ItemFormState = {
  name: '',
  sku: '',
  brand: '',
  category: 'Óleos & Fluidos',
  compatibleBikes: '',
  quantity: '1',
  minQuantity: '2',
  costPrice: '',
  salePrice: '',
  location: '',
  photoDataUrl: undefined,
};

export const InventoryView: React.FC<InventoryViewProps> = ({
  items,
  onSaveItem,
  onDeleteItem,
  onAddToQuote,
  externalCreateTrigger,
}) => {
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<ItemFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [zoomPhoto, setZoomPhoto] = useState<{ src: string; title: string } | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const lastTriggerRef = useRef<number | undefined>(externalCreateTrigger);

  React.useEffect(() => {
    if (
      externalCreateTrigger !== undefined &&
      externalCreateTrigger !== lastTriggerRef.current
    ) {
      lastTriggerRef.current = externalCreateTrigger;
      openNewModal();
    }
  }, [externalCreateTrigger]);

  const stats = useMemo(() => {
    let totalUnits = 0;
    let lowCount = 0;
    let outCount = 0;
    let totalSaleValue = 0;

    for (const item of items) {
      totalUnits += item.quantity;
      totalSaleValue += item.quantity * item.salePrice;
      if (item.quantity === 0) outCount += 1;
      else if (item.quantity <= item.minQuantity) lowCount += 1;
    }

    return { totalSkus: items.length, totalUnits, lowCount, outCount, totalSaleValue };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (stockFilter === 'low' && !(item.quantity > 0 && item.quantity <= item.minQuantity)) {
        return false;
      }
      if (stockFilter === 'out' && item.quantity > 0) {
        return false;
      }
      if (categoryFilter !== 'all' && item.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.compatibleBikes.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q)
      );
    });
  }, [items, search, stockFilter, categoryFilter]);

  function openNewModal() {
    setForm(EMPTY_FORM);
    setFormError('');
    setIsModalOpen(true);
  }

  function openEditModal(item: InventoryItem) {
    setForm({
      id: item.id,
      name: item.name,
      sku: item.sku,
      brand: item.brand,
      category: item.category,
      compatibleBikes: item.compatibleBikes,
      quantity: String(item.quantity),
      minQuantity: String(item.minQuantity),
      costPrice: item.costPrice ? String(item.costPrice) : '',
      salePrice: String(item.salePrice),
      location: item.location,
      photoDataUrl: item.photoDataUrl,
    });
    setFormError('');
    setIsModalOpen(true);
  }

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsProcessingPhoto(true);
    setFormError('');
    try {
      const compressed = await compressImageToDataUrl(file, 760, 0.8);
      setForm((prev) => ({ ...prev, photoDataUrl: compressed }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao processar foto.');
    } finally {
      setIsProcessingPhoto(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('Informe o nome da peça ou produto.');
      return;
    }
    const salePrice = parseFloat(form.salePrice.replace(',', '.')) || 0;
    const costPrice = parseFloat(form.costPrice.replace(',', '.')) || 0;
    const quantity = Math.max(0, parseInt(form.quantity, 10) || 0);
    const minQuantity = Math.max(0, parseInt(form.minQuantity, 10) || 0);

    if (salePrice <= 0) {
      setFormError('Informe um preço de venda maior que zero.');
      return;
    }

    setIsSaving(true);
    try {
      const item: InventoryItem = {
        id: form.id || createId('part'),
        name: form.name.trim(),
        sku: form.sku.trim().toUpperCase(),
        brand: form.brand.trim(),
        category: form.category,
        compatibleBikes: form.compatibleBikes.trim(),
        quantity,
        minQuantity,
        costPrice,
        salePrice,
        location: form.location.trim(),
        photoDataUrl: form.photoDataUrl,
        updatedAt: new Date().toISOString(),
      };
      await onSaveItem(item);
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function adjustQuantity(item: InventoryItem, delta: number) {
    const nextQty = Math.max(0, item.quantity + delta);
    if (nextQty === item.quantity) return;
    await onSaveItem({
      ...item,
      quantity: nextQty,
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <div className="space-y-5">
      {/* Header + Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
            Estoque de Peças
          </h2>
          <p className="text-sm text-zinc-500">
            Controle de peças com fotos, prateleira, estoque mínimo e envio rápido para orçamento.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewModal}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 active:scale-[0.99] transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Adicionar Peça</span>
        </button>
      </div>

      {/* Clean Metrics Bar (Single level, tabular-nums, no nested cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="text-xs font-medium text-zinc-500">Itens Cadastrados</div>
          <div className="mt-1 text-2xl font-bold text-zinc-900 font-mono tabular-nums">
            {stats.totalSkus}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500 tabular-nums">
            {stats.totalUnits} unidades no total
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="text-xs font-medium text-zinc-500">Valor em Estoque (Venda)</div>
          <div className="mt-1 text-2xl font-bold text-zinc-900 font-mono tabular-nums truncate">
            {formatBRL(stats.totalSaleValue)}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">Preço de balcão</div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="text-xs font-medium text-zinc-500">Estoque Baixo</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono tabular-nums ${
                stats.lowCount > 0 ? 'text-amber-600' : 'text-zinc-900'
              }`}
            >
              {stats.lowCount}
            </span>
            {stats.lowCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5" /> Repor
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">Abaixo ou igual ao mínimo</div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <div className="text-xs font-medium text-zinc-500">Sem Estoque</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono tabular-nums ${
                stats.outCount > 0 ? 'text-red-600' : 'text-zinc-900'
              }`}
            >
              {stats.outCount}
            </span>
            {stats.outCount > 0 && (
              <span className="text-xs font-medium text-red-600">Zerado</span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">Indisponível para venda</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white border border-zinc-200 rounded-xl p-3 sm:p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar peça, código SKU, marca ou moto compatível..."
              className="w-full min-h-[44px] pl-10 pr-9 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-zinc-400 focus:outline-none"
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

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filtrar por categoria"
            className="min-h-[44px] px-3 py-2 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-800 focus:bg-white focus:border-zinc-400 focus:outline-none"
          >
            <option value="all">Todas as categorias</option>
            {PART_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Segmented Filter Control */}
        <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg w-full sm:w-fit overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'all', label: `Todos (${items.length})` },
              { id: 'low', label: `Estoque Baixo (${stats.lowCount})` },
              { id: 'out', label: `Zerados (${stats.outCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStockFilter(tab.id)}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                stockFilter === tab.id
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center">
          <p className="text-base font-semibold text-zinc-900">
            Nenhuma peça encontrada com os filtros atuais
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Cadastre uma nova peça com foto ou limpe os filtros de busca.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            {(search || stockFilter !== 'all' || categoryFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStockFilter('all');
                  setCategoryFilter('all');
                }}
                className="min-h-[42px] px-4 py-2 rounded-lg border border-zinc-300 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Limpar filtros
              </button>
            )}
            <button
              type="button"
              onClick={openNewModal}
              className="min-h-[42px] px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
            >
              Adicionar Peça
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-500">
                  <th className="py-3 px-4">Peça / Compatibilidade</th>
                  <th className="py-3 px-3">Categoria &amp; Local</th>
                  <th className="py-3 px-3 text-center">Quantidade</th>
                  <th className="py-3 px-3 text-right">Custo</th>
                  <th className="py-3 px-3 text-right">Venda</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-sm">
                {filteredItems.map((item) => {
                  const isOut = item.quantity === 0;
                  const isLow = item.quantity > 0 && item.quantity <= item.minQuantity;

                  return (
                    <tr key={item.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <PartThumbnail
                            src={item.photoDataUrl}
                            alt={item.name}
                            size="sm"
                            onClick={
                              item.photoDataUrl
                                ? () => setZoomPhoto({ src: item.photoDataUrl!, title: item.name })
                                : undefined
                            }
                          />
                          <div className="min-w-0">
                            <div className="font-semibold text-zinc-900 truncate max-w-md">
                              {item.name}
                            </div>
                            <div className="text-xs text-zinc-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                              {item.sku && <span className="font-mono text-zinc-600">{item.sku}</span>}
                              {item.sku && item.brand && <span aria-hidden="true">·</span>}
                              {item.brand && <span>{item.brand}</span>}
                              {(item.sku || item.brand) && item.compatibleBikes && (
                                <span aria-hidden="true">·</span>
                              )}
                              {item.compatibleBikes && (
                                <span className="truncate max-w-xs">{item.compatibleBikes}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="text-zinc-800 font-medium text-xs">{item.category}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {item.location || 'Sem local definido'}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className="inline-flex items-center border border-zinc-200 rounded-lg bg-white">
                            <button
                              type="button"
                              onClick={() => adjustQuantity(item, -1)}
                              disabled={item.quantity === 0}
                              className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 rounded-l-lg cursor-pointer"
                              aria-label="Diminuir estoque"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span
                              className={`w-10 text-center font-mono font-semibold tabular-nums text-sm ${
                                isOut
                                  ? 'text-red-600'
                                  : isLow
                                    ? 'text-amber-600'
                                    : 'text-zinc-900'
                              }`}
                            >
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => adjustQuantity(item, 1)}
                              className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:bg-zinc-100 rounded-r-lg cursor-pointer"
                              aria-label="Aumentar estoque"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {isOut && (
                            <span className="text-[11px] font-semibold text-red-600">
                              Sem estoque
                            </span>
                          )}
                          {isLow && (
                            <span className="text-[11px] font-semibold text-amber-700">
                              Baixo (mín {item.minQuantity})
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums text-zinc-500 text-xs">
                        {item.costPrice > 0 ? formatBRL(item.costPrice) : '—'}
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-zinc-900">
                        {formatBRL(item.salePrice)}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onAddToQuote(item)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 whitespace-nowrap cursor-pointer"
                            title="Incluir no orçamento"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>Orçar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="p-2 rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer"
                            title="Editar peça"
                            aria-label="Editar peça"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {confirmDeleteId === item.id ? (
                            <button
                              type="button"
                              onClick={async () => {
                                await onDeleteItem(item.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 whitespace-nowrap cursor-pointer"
                            >
                              Confirmar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              className="p-2 rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                              title="Excluir peça"
                              aria-label="Excluir peça"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Touch Card List */}
          <div className="lg:hidden space-y-3">
            {filteredItems.map((item) => {
              const isOut = item.quantity === 0;
              const isLow = item.quantity > 0 && item.quantity <= item.minQuantity;

              return (
                <div
                  key={item.id}
                  className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <PartThumbnail
                      src={item.photoDataUrl}
                      alt={item.name}
                      size="md"
                      onClick={
                        item.photoDataUrl
                          ? () => setZoomPhoto({ src: item.photoDataUrl!, title: item.name })
                          : undefined
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-zinc-900 leading-snug">
                          {item.name}
                        </h3>
                        <span className="font-mono font-bold text-sm text-zinc-900 tabular-nums shrink-0">
                          {formatBRL(item.salePrice)}
                        </span>
                      </div>

                      <div className="mt-1 text-xs text-zinc-500 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <span>{item.category}</span>
                        {item.brand && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{item.brand}</span>
                          </>
                        )}
                        {item.sku && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">{item.sku}</span>
                          </>
                        )}
                        {item.location && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{item.location}</span>
                          </>
                        )}
                      </div>

                      {item.compatibleBikes && (
                        <p className="mt-1 text-xs text-zinc-600 line-clamp-1">
                          Motos: {item.compatibleBikes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center border border-zinc-200 rounded-xl bg-zinc-50">
                        <button
                          type="button"
                          onClick={() => adjustQuantity(item, -1)}
                          disabled={item.quantity === 0}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-700 disabled:opacity-30"
                          aria-label="Diminuir"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span
                          className={`min-w-[36px] text-center font-mono font-bold text-sm tabular-nums ${
                            isOut
                              ? 'text-red-600'
                              : isLow
                                ? 'text-amber-600'
                                : 'text-zinc-900'
                          }`}
                        >
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustQuantity(item, 1)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-700"
                          aria-label="Aumentar"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <span
                        className={`text-xs font-semibold ${
                          isOut
                            ? 'text-red-600'
                            : isLow
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                        }`}
                      >
                        {isOut ? 'Sem estoque' : isLow ? 'Estoque baixo' : 'Em estoque'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onAddToQuote(item)}
                        className="min-h-[44px] px-3.5 rounded-xl bg-zinc-900 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>Orçar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="min-w-[44px] min-h-[44px] rounded-xl border border-zinc-200 text-zinc-700 flex items-center justify-center"
                        aria-label="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {confirmDeleteId === item.id ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeleteItem(item.id);
                            setConfirmDeleteId(null);
                          }}
                          className="min-h-[44px] px-3 rounded-xl bg-red-600 text-white text-xs font-semibold"
                        >
                          Excluir?
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="min-w-[44px] min-h-[44px] rounded-xl border border-zinc-200 text-zinc-500 flex items-center justify-center"
                          aria-label="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add / Edit Item Modal (Bottom sheet on mobile, centered modal on desktop) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full sm:max-w-xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white border border-zinc-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-zinc-900">
                {form.id ? 'Editar Peça do Estoque' : 'Nova Peça no Estoque'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4">
              {/* Photo Upload Section */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3.5 rounded-xl bg-zinc-50 border border-zinc-200">
                <PartThumbnail src={form.photoDataUrl} alt={form.name || 'Foto da peça'} size="lg" />
                <div className="flex-1 space-y-2">
                  <div className="text-xs font-semibold text-zinc-800">
                    Foto da Peça (opcional)
                  </div>
                  <p className="text-xs text-zinc-500">
                    Tire uma foto na hora pelo celular ou envie uma imagem da galeria/PC.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoSelected}
                      className="hidden"
                    />
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelected}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isProcessingPhoto}
                      onClick={() => cameraInputRef.current?.click()}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-zinc-800 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{isProcessingPhoto ? 'Processando...' : 'Tirar Foto'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isProcessingPhoto}
                      onClick={() => galleryInputRef.current?.click()}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg border border-zinc-300 bg-white text-zinc-800 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-zinc-50 cursor-pointer"
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      <span>Galeria / Arquivo</span>
                    </button>
                    {form.photoDataUrl && (
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, photoDataUrl: undefined }))}
                        className="min-h-[40px] px-3 py-1.5 rounded-lg text-red-600 text-xs font-semibold hover:bg-red-50 cursor-pointer"
                      >
                        Remover Foto
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Nome da Peça / Produto *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: Kit Relação Vaz CG 160 / Óleo Motul 10W40"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:border-zinc-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Código / SKU
                  </label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
                    placeholder="Ex: REL-CG160"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm font-mono uppercase focus:border-zinc-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Marca / Fabricante
                  </label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                    placeholder="Ex: Honda, Motul, Cobreq, NGK"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:border-zinc-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Categoria
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, category: e.target.value as PartCategory }))
                    }
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm bg-white focus:border-zinc-900 focus:outline-none"
                  >
                    {PART_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Prateleira / Localização
                  </label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                    placeholder="Ex: Prateleira B2"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:border-zinc-900 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Motos Compatíveis
                  </label>
                  <input
                    type="text"
                    value={form.compatibleBikes}
                    onChange={(e) => setForm((p) => ({ ...p, compatibleBikes: e.target.value }))}
                    placeholder="Ex: CG 160 Titan, Fan 160, Bros 160"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:border-zinc-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Quantidade Atual *
                  </label>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={form.quantity}
                    onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm font-mono focus:border-zinc-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Alerta Estoque Mínimo
                  </label>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={form.minQuantity}
                    onChange={(e) => setForm((p) => ({ ...p, minQuantity: e.target.value }))}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm font-mono focus:border-zinc-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Preço de Custo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={form.costPrice}
                    onChange={(e) => setForm((p) => ({ ...p, costPrice: e.target.value }))}
                    placeholder="0,00"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm font-mono focus:border-zinc-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Preço de Venda (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    inputMode="decimal"
                    value={form.salePrice}
                    onChange={(e) => setForm((p) => ({ ...p, salePrice: e.target.value }))}
                    placeholder="0,00"
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm font-mono font-semibold focus:border-zinc-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-zinc-300 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isProcessingPhoto}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 inline-flex items-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSaving ? 'Salvando...' : 'Salvar Peça'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {zoomPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoomPhoto(null)}
        >
          <div
            className="relative max-w-lg w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-zinc-900 truncate">{zoomPhoto.title}</span>
              <button
                type="button"
                onClick={() => setZoomPhoto(null)}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
                aria-label="Fechar foto"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={zoomPhoto.src}
              alt={zoomPhoto.title}
              className="w-full max-h-[70vh] object-contain bg-zinc-100"
            />
          </div>
        </div>
      )}
    </div>
  );
};
