import React, { useRef, useState } from 'react';
import { Check, Download, Plus, Trash2, Upload } from 'lucide-react';
import { exportAllData, importAllData } from '../lib/db';
import { createId, formatPhoneMask } from '../lib/formatters';
import type { ServicePreset, WorkshopSettings } from '../types/workshop';

interface SettingsViewProps {
  settings: WorkshopSettings;
  onSaveSettings: (next: WorkshopSettings) => Promise<void>;
  onDatabaseImported: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onDatabaseImported,
}) => {
  const [form, setForm] = useState<WorkshopSettings>(settings);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetPrice, setNewPresetPrice] = useState('');
  const [savedNotice, setSavedNotice] = useState('');
  const [backupNotice, setBackupNotice] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setForm(settings);
  }, [settings]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSaveSettings(form);
    setSavedNotice('Configurações da RD Motos salvas!');
    setTimeout(() => setSavedNotice(''), 3000);
  }

  function addServicePreset() {
    if (!newPresetName.trim()) return;
    const price = parseFloat(newPresetPrice.replace(',', '.')) || 0;
    const nextPreset: ServicePreset = {
      id: createId('srv'),
      name: newPresetName.trim(),
      defaultPrice: price,
    };
    const next = { ...form, servicePresets: [...form.servicePresets, nextPreset] };
    setForm(next);
    setNewPresetName('');
    setNewPresetPrice('');
    void onSaveSettings(next);
  }

  function removeServicePreset(id: string) {
    const next = {
      ...form,
      servicePresets: form.servicePresets.filter((p) => p.id !== id),
    };
    setForm(next);
    void onSaveSettings(next);
  }

  async function handleExportBackup() {
    const json = await exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `backup-rd-motos-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setBackupNotice('Backup completo (estoque, fotos e orçamentos) exportado!');
  }

  async function handleImportBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      await importAllData(text);
      await onDatabaseImported();
      setBackupNotice('Backup restaurado com sucesso!');
    } catch (err) {
      setBackupNotice(
        err instanceof Error ? err.message : 'Não foi possível importar este arquivo.'
      );
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
          Configurações da Oficina
        </h2>
        <p className="text-sm text-zinc-500">
          Esses dados aparecem no cabeçalho dos PDFs e nas mensagens enviadas pelo WhatsApp.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Nome da Oficina
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm font-semibold focus:border-zinc-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              WhatsApp da Oficina
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: formatPhoneMask(e.target.value) }))}
              placeholder="(11) 99999-9999"
              className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm font-mono focus:border-zinc-900 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Endereço / Cidade
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="Rua, Número, Bairro - Cidade/UF"
              className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:border-zinc-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              CNPJ / CPF (opcional)
            </label>
            <input
              type="text"
              value={form.document}
              onChange={(e) => setForm((p) => ({ ...p, document: e.target.value }))}
              placeholder="00.000.000/0001-00"
              className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm font-mono focus:border-zinc-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Chave PIX (sai no orçamento)
            </label>
            <input
              type="text"
              value={form.pixKey}
              onChange={(e) => setForm((p) => ({ ...p, pixKey: e.target.value }))}
              placeholder="Telefone, CNPJ, E-mail ou Aleatória"
              className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:border-zinc-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Validade padrão (dias)
            </label>
            <input
              type="number"
              min="1"
              value={form.defaultValidityDays}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  defaultValidityDays: Math.max(1, parseInt(e.target.value, 10) || 7),
                }))
              }
              className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm font-mono focus:border-zinc-900 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Observação padrão de garantia/pagamento
            </label>
            <textarea
              rows={2}
              value={form.defaultNotes}
              onChange={(e) => setForm((p) => ({ ...p, defaultNotes: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:border-zinc-900 focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-semibold text-emerald-700">{savedNotice}</span>
          <button
            type="submit"
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 inline-flex items-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Salvar Dados da Oficina</span>
          </button>
        </div>
      </form>

      {/* Quick Service Presets */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="text-base font-bold text-zinc-900">Atalhos de Mão de Obra</h3>
          <p className="text-xs text-zinc-500">
            Botões rápidos exibidos na tela de orçamento para agilizar serviços comuns.
          </p>
        </div>

        <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden">
          {form.servicePresets.map((preset) => (
            <div
              key={preset.id}
              className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm bg-white"
            >
              <span className="font-medium text-zinc-800">{preset.name}</span>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono font-semibold text-zinc-900">
                  R$ {preset.defaultPrice.toFixed(2).replace('.', ',')}
                </span>
                <button
                  type="button"
                  onClick={() => removeServicePreset(preset.id)}
                  className="p-1.5 text-zinc-400 hover:text-red-600 cursor-pointer"
                  aria-label="Remover serviço rápido"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <input
            type="text"
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            placeholder="Nome do serviço (ex: Troca de pneu traseiro)"
            className="sm:col-span-7 min-h-[42px] px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:border-zinc-900 focus:outline-none"
          />
          <input
            type="number"
            step="0.01"
            min="0"
            value={newPresetPrice}
            onChange={(e) => setNewPresetPrice(e.target.value)}
            placeholder="Valor R$"
            className="sm:col-span-3 min-h-[42px] px-3 py-2 rounded-lg border border-zinc-300 text-sm font-mono focus:border-zinc-900 focus:outline-none"
          />
          <button
            type="button"
            onClick={addServicePreset}
            className="sm:col-span-2 min-h-[42px] px-3 py-2 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 inline-flex items-center justify-center gap-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar</span>
          </button>
        </div>
      </section>

      {/* Backup & Transfer between PC and Phone */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
        <div>
          <h3 className="text-base font-bold text-zinc-900">
            Backup e Transferência (PC / Celular)
          </h3>
          <p className="text-xs text-zinc-500">
            Seus dados e fotos ficam salvos no dispositivo para funcionar 100% offline. Exporte um
            arquivo de backup para guardar ou transferir para outro aparelho.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExportBackup}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 inline-flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Backup (.json)</span>
          </button>

          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportBackup}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-zinc-300 bg-white text-zinc-800 text-xs font-semibold hover:bg-zinc-50 inline-flex items-center gap-2 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Importar Backup (.json)</span>
          </button>
        </div>

        {backupNotice && (
          <p className="text-xs font-semibold text-emerald-700 pt-1">{backupNotice}</p>
        )}
      </section>
    </div>
  );
};
