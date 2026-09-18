import { AnimatePresence, motion } from 'framer-motion';
import { useAtlasStore } from '@/features/map/store';

/**
 * Toast stack (design.md §7.9): bottom-center, dark ink-panel surface,
 * mono-sm message, optional brass Undo, auto-dismiss 4s, max 2.
 */
export default function ToastStack() {
  const toasts = useAtlasStore((s) => s.toasts);
  const dismiss = useAtlasStore((s) => s.dismissToast);
  const undo = useAtlasStore((s) => s.undo);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[80] flex flex-col items-center gap-2 pointer-events-none px-4 w-full max-w-md">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto flex items-center gap-3 bg-ink-panel text-paper rounded-md shadow-elev-3 px-4 py-2.5 max-w-full"
            role="status"
          >
            <span className="font-mono text-mono-sm truncate">{toast.message}</span>
            {toast.undo && (
              <button
                type="button"
                className="font-mono text-mono-sm text-paper underline decoration-accent underline-offset-4 hover:text-state-partial shrink-0 rounded-sm"
                onClick={() => {
                  undo();
                  dismiss(toast.id);
                }}
              >
                Undo
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
