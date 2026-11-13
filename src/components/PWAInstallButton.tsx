import React, { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          compact ? 'min-h-[40px] px-3 py-1.5 text-xs font-semibold' : 'w-full min-h-[42px] px-4 py-2 text-xs font-semibold'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            compact ? 'min-h-[40px] px-3 py-1.5 text-xs font-semibold' : 'w-full min-h-[42px] px-4 py-2 text-xs font-semibold'
          }`}
        >
          <Smartphone className="w-4 h-4 shrink-0" />
          <span>Instalar no iPhone</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
            <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-xl border border-zinc-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-zinc-900">Instalar RD Motos no iPhone</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="mt-4 space-y-3 text-sm text-zinc-700">
                <li className="flex items-start gap-2.5">
                  <span className="font-mono font-semibold text-red-600">1.</span>
                  <span>
                    Toque no botão <strong className="inline-flex items-center gap-1"><Share className="w-3.5 h-3.5" /> Compartilhar</strong> na barra do Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono font-semibold text-red-600">2.</span>
                  <span>
                    Role para baixo e toque em <strong>Adicionar à Tela de Início</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono font-semibold text-red-600">3.</span>
                  <span>
                    Toque em <strong>Adicionar</strong> para abrir como aplicativo nativo, inclusive offline.
                  </span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full min-h-[44px] rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
