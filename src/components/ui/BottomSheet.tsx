import React, { useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxHeight?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxHeight = 'max-h-[85vh]',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Backdrop tap to dismiss */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Sliding Sheet Panel */}
      <div
        className={`relative z-10 w-full max-w-2xl mx-auto rounded-t-3xl bg-slate-800 border-t border-slate-700 shadow-2xl overflow-hidden flex flex-col transition-all transform animate-in slide-in-from-bottom duration-300 ${maxHeight}`}
      >
        {/* Touch Handle Bar */}
        <div
          onClick={onClose}
          className="w-full py-3 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-700/30 transition-colors shrink-0"
        >
          <div className="w-12 h-1.5 rounded-full bg-slate-600/80" />
        </div>

        {/* Header */}
        {(title || subtitle) && (
          <div className="flex items-center justify-between px-6 pb-4 border-b border-slate-700/80 shrink-0">
            <div>
              {title && <h3 className="font-black text-lg text-white">{title}</h3>}
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Scrollable Content Area */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
};
