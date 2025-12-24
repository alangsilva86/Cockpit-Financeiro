import React from 'react';
import { Icons } from '../Icons';
import { formatRelativeTime } from '../../utils/format';

interface TrustBarProps {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt?: number | null;
  pendingCount: number;
  syncError?: string | null;
  canInstall: boolean;
  onInstall?: () => void;
  onSyncNow?: () => void;
  onOpenDetails?: () => void;
}

export const TrustBar: React.FC<TrustBarProps> = ({
  isOnline,
  isSyncing,
  lastSyncAt,
  pendingCount,
  syncError,
  canInstall,
  onInstall,
  onSyncNow,
  onOpenDetails,
}) => {
  const showSyncAction = isOnline && (pendingCount > 0 || !!syncError);

  const status = () => {
    if (!isOnline) {
      return {
        label: 'Offline. Seus lançamentos sincronizam depois.',
        tone: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
        icon: <Icons.Alert size={12} />,
      };
    }
    if (syncError) {
      return {
        label: 'Falha ao sincronizar. Tentaremos novamente.',
        tone: 'text-rose-200 border-rose-500/40 bg-rose-500/10',
        icon: <Icons.Alert size={12} />,
      };
    }
    if (isSyncing) {
      return {
        label: 'Sincronizando...',
        tone: 'text-emerald-200 border-emerald-500/40 bg-emerald-500/10',
        icon: <Icons.Loader size={12} className="animate-spin" />,
      };
    }
    if (pendingCount > 0) {
      return {
        label: `${pendingCount} pendência${pendingCount > 1 ? 's' : ''} para sincronizar`,
        tone: 'text-amber-200 border-amber-500/30 bg-amber-500/10',
        icon: <Icons.Clock size={12} />,
      };
    }
    return {
      label: lastSyncAt ? `Sincronizado ${formatRelativeTime(lastSyncAt)}` : 'Aguardando primeira sincronização',
      tone: 'text-emerald-200 border-emerald-500/30 bg-emerald-500/10',
      icon: <Icons.Check size={12} />,
    };
  };

  const { label, tone, icon } = status();

  return (
    <div className="sticky top-0 z-30 border-b border-zinc-900 bg-zinc-950/90 backdrop-blur">
      <div className="flex items-center justify-between gap-2 px-4 py-2 text-[11px]">
        <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${tone}`}>
          {icon}
          <span className="font-semibold">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {showSyncAction && (
            <button
              onClick={onSyncNow}
              className="rounded-full border border-emerald-500/40 px-3 py-1 text-[10px] font-bold text-emerald-300 hover:text-white"
            >
              Sincronizar agora
            </button>
          )}
          {canInstall && (
            <button
              onClick={onInstall}
              className="rounded-full border border-blue-500/40 px-3 py-1 text-[10px] font-bold text-blue-300 hover:text-white"
            >
              Instalar
            </button>
          )}
          <button
            onClick={onOpenDetails}
            className="rounded-full border border-zinc-800 px-3 py-1 text-[10px] font-bold text-zinc-400 hover:text-white"
          >
            Detalhes
          </button>
        </div>
      </div>
    </div>
  );
};
