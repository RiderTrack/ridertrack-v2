// ═══════════════════════════════════════════════════════════
// 💳 COBROS QR (YAPE 💜 + PLIN 💚) — Fase 1.5
// Pantalla para que el rider configure sus QR de cobro:
//   • Pestaña Yape → config_empresa/{uid}.yape → bot (ruta_activa.yape)
//   • Pestaña Plin → config_empresa/{uid}.plin → bot (ruta_activa.plin)  ⭐ NUEVO
// El mismo flujo de siempre: subes el screenshot del QR desde la
// app de tu banco, se comprime y queda sincronizado con RudyBot
// para enviarlo por WhatsApp en cada cobro.
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { QrCode } from 'lucide-react';
import { WalletQRPanel, WalletTema } from './WalletQRPanel';
import {
  sincronizarYapeAlBot,
  obtenerYapeDelBot,
  sincronizarPlinAlBot,
  obtenerPlinDelBot,
} from '../services/firestore';

interface YapeQRViewProps {
  onShowToast?: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

const TEMA_YAPE: WalletTema = {
  key: 'yape',
  nombreApp: 'Yape',
  emoji: '💜',
  titulo: 'Mi QR de Yape',
  subtitulo: 'Sube el screenshot de tu QR desde la app Yape',
  accentText: 'text-purple-400',
  accentBgSolid: 'bg-purple-600 hover:bg-purple-700',
  accentChip: 'bg-purple-500/20 text-purple-300',
  accentBorder: 'border-purple-500/40',
  headerGradient: 'from-purple-600/20 via-slate-800 to-slate-800',
  botonPrincipal: 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 shadow-purple-600/30',
  pasos: [
    'Abre la app de <b class="text-slate-300">Yape</b> en tu celular',
    'Entra a <b class="text-slate-300">"Cobrar"</b> y busca tu código QR',
    'Toma un <b class="text-slate-300">screenshot</b> del QR (que se vea completo y nítido)',
    'Vuelve aquí y toca <b class="text-slate-300">"Subir QR"</b>',
    'Toca <b class="text-slate-300">"Guardar y sincronizar"</b> — listo ✨',
  ],
  tipFinal:
    'El QR se guarda en Firebase una sola vez y queda sincronizado con el bot. Solo necesitas cambiarlo si cambias de número Yape.',
  whatsappTexto: (numero, titular) =>
    `📲 Pago por Yape\n\n📱 Número: *${numero || '—'}*\n👤 Titular: ${titular || '—'}`,
};

const TEMA_PLIN: WalletTema = {
  key: 'plin',
  nombreApp: 'Plin',
  emoji: '💚',
  titulo: 'Mi QR de Plin',
  subtitulo: 'Sube el screenshot de tu QR Plin desde la app de tu banco',
  accentText: 'text-emerald-400',
  accentBgSolid: 'bg-emerald-600 hover:bg-emerald-700',
  accentChip: 'bg-emerald-500/20 text-emerald-300',
  accentBorder: 'border-emerald-500/40',
  headerGradient: 'from-emerald-600/20 via-slate-800 to-slate-800',
  botonPrincipal: 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-emerald-600/30',
  pasos: [
    'Abre la app de <b class="text-slate-300">tu banco</b> (BCP, Interbank, Scotiabank…) o Yape',
    'Busca <b class="text-slate-300">"Plin"</b> → opción <b class="text-slate-300">Cobrar / Mi QR</b>',
    'Toma un <b class="text-slate-300">screenshot</b> del QR (completo y nítido)',
    'Vuelve aquí y toca <b class="text-slate-300">"Subir QR"</b>',
    'Toca <b class="text-slate-300">"Guardar y sincronizar"</b> — listo ✨',
  ],
  tipFinal:
    'Plin funciona entre todos los bancos: el cliente puede escanear tu QR desde la app de su banco aunque sea distinta a la tuya.',
  whatsappTexto: (numero, titular) =>
    `📲 Pago por Plin\n\n📱 Número: *${numero || '—'}*\n👤 Titular: ${titular || '—'}`,
};

export const YapeQRView: React.FC<YapeQRViewProps> = ({ onShowToast }) => {
  const [walletActiva, setWalletActiva] = useState<'yape' | 'plin'>('yape');

  const tema = walletActiva === 'yape' ? TEMA_YAPE : TEMA_PLIN;

  return (
    <div className="space-y-4 pb-12">
      {/* ═══ HEADER ═══ */}
      <div className={`p-5 rounded-2xl bg-gradient-to-br ${tema.headerGradient} border ${tema.accentBorder} shadow-xl`}>
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl ${tema.accentChip} border ${tema.accentBorder} flex items-center justify-center flex-shrink-0`}>
            <QrCode className={`w-6 h-6 ${tema.accentText}`} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-black text-white">Mis QR de Cobro</h1>
            <p className="text-xs text-slate-400">
              Configura tus QR una vez — el bot los envía por WhatsApp en cada cobro
            </p>
          </div>
        </div>

        {/* Pestañas Yape / Plin */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setWalletActiva('yape')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-bold transition-all active:scale-[0.98] ${
              walletActiva === 'yape'
                ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-600/25'
                : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:border-slate-500'
            }`}
          >
            💜 Yape
          </button>
          <button
            onClick={() => setWalletActiva('plin')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-bold transition-all active:scale-[0.98] ${
              walletActiva === 'plin'
                ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-600/25'
                : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:border-slate-500'
            }`}
          >
            💚 Plin
          </button>
        </div>
      </div>

      {/* ═══ PANEL DE LA WALLET ACTIVA ═══ */}
      {walletActiva === 'yape' ? (
        <WalletQRPanel
          key="yape"
          tema={TEMA_YAPE}
          onSync={(uid, cfg) => sincronizarYapeAlBot(uid, cfg)}
          onFetch={(uid) => obtenerYapeDelBot(uid)}
          onShowToast={onShowToast}
        />
      ) : (
        <WalletQRPanel
          key="plin"
          tema={TEMA_PLIN}
          onSync={(uid, cfg) => sincronizarPlinAlBot(uid, cfg)}
          onFetch={(uid) => obtenerPlinDelBot(uid)}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};
