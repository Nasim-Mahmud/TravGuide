import { useState } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import type { StoredVisitState } from '@/features/map/types';
import { NodePanelContent, type NodePanelContentProps } from './NodePanel';
import StatePicker from './StatePicker';

const SNAP_PEEK = 96;
const SNAP_HALF_RATIO = 0.45;
const SNAP_FULL_RATIO = 0.85;

interface NodeSheetProps extends NodePanelContentProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Mobile bottom sheet (map.md §3.8): peek / half / full snap points,
 * drag handle, spring (damping 26, stiffness 300), drag-to-dismiss.
 */
export default function NodeSheet({ open, onClose, ...contentProps }: NodeSheetProps) {
  const [snap, setSnap] = useState<'peek' | 'half' | 'full'>('half');
  const dragControls = useDragControls();

  // Reset to half snap whenever the sheet (re)opens or the node changes
  const [prevKey, setPrevKey] = useState('');
  const snapKey = `${open ? 'open' : 'closed'}:${contentProps.node.id}`;
  if (prevKey !== snapKey) {
    setPrevKey(snapKey);
    if (open) setSnap('half');
  }

  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const heights: Record<typeof snap, number> = {
    peek: SNAP_PEEK,
    half: Math.round(vh * SNAP_HALF_RATIO),
    full: Math.round(vh * SNAP_FULL_RATIO),
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key={contentProps.node.id}
          initial={{ y: '100%' }}
          animate={{ y: vh - heights[snap] }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: vh - heights.full, bottom: vh - SNAP_PEEK }}
          dragElastic={0.08}
          onDragEnd={(_, info) => {
            const current = vh - heights[snap] + info.offset.y;
            const candidates = (['peek', 'half', 'full'] as const).map((k) => ({
              k,
              d: Math.abs(vh - heights[k] - current - info.velocity.y * 0.15),
            }));
            candidates.sort((a, b) => a.d - b.d);
            const target = candidates[0].k;
            if (target === 'peek' && info.velocity.y > 800) onClose();
            else setSnap(target);
          }}
          className="fixed inset-x-0 bottom-0 z-40 atlas-card-lg rounded-b-none border-b-0 flex flex-col overflow-hidden"
          style={{ top: 0, height: vh, willChange: 'transform' }}
          role="dialog"
          aria-label={`${contentProps.node.name} details`}
        >
          <button
            type="button"
            aria-label="Drag to resize panel"
            className="pt-2.5 pb-1.5 flex justify-center cursor-grab active:cursor-grabbing touch-none shrink-0"
            onPointerDown={(e) => dragControls.start(e)}
          >
            <span className="w-10 h-1 rounded-full bg-hairline-strong" />
          </button>
          {/* peek summary row */}
          <button
            type="button"
            className="px-4 pb-2 text-left shrink-0"
            onClick={() => setSnap((s) => (s === 'peek' ? 'half' : s === 'half' ? 'full' : 'peek'))}
          >
            <p className="atlas-label">{contentProps.node.country ?? 'World'}</p>
            <p className="font-display font-medium text-xl text-ink leading-tight truncate">{contentProps.node.name}</p>
          </button>
          <div className="flex-1 overflow-y-auto atlas-scroll px-4 pb-6 pt-1">
            <NodePanelContent {...contentProps} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface StatePickerSheetProps {
  open: boolean;
  nodeName: string;
  current: import('@/features/map/types').EffectiveState;
  onPick: (state: StoredVisitState | null) => void;
  onClose: () => void;
}

/** Dedicated StatePicker sheet variant (long-press / Mark) — five large rows */
export function StatePickerSheet({ open, nodeName, current, onPick, onClose }: StatePickerSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-ink/20"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 atlas-card-lg rounded-b-none border-b-0 overflow-hidden"
            role="dialog"
            aria-label={`Mark ${nodeName}`}
          >
            <div className="pt-2.5 pb-1 flex justify-center">
              <span className="w-10 h-1 rounded-full bg-hairline-strong" />
            </div>
            <p className="px-4 py-2 font-display font-medium text-xl text-ink truncate">{nodeName}</p>
            <StatePicker
              variant="rows"
              nodeName={nodeName}
              current={current}
              onPick={(s) => {
                onPick(s);
                onClose();
              }}
            />
            <div className="h-4" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
