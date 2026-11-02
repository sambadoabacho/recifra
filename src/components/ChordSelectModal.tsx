import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

interface ChordSelectModalProps {
  note: string;
  chords: string[];
  position: { top: number; left: number };
  onSelect: (chord: string) => void;
  onClose: () => void;
}

export const ChordSelectModal: React.FC<ChordSelectModalProps> = ({
  note,
  chords,
  position,
  onSelect,
  onClose
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [modalPosition, setModalPosition] = useState({ top: position.top, left: position.left });
  const [isDragging, setIsDragging] = useState(false);

  // Posiciona o modal ao redor do ponto de referência, escolhendo o lado
  // com espaço disponível e mantendo uma distância para não cobrir o ponto.
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const rect = modal.getBoundingClientRect();
    const gap = 24;
    const margin = 12;
    const anchorX = position.left;
    const anchorY = position.top;
    const candidates = [
      { side: 'right', left: anchorX + gap, top: anchorY - rect.height / 2 },
      { side: 'left', left: anchorX - rect.width - gap, top: anchorY - rect.height / 2 },
      { side: 'below', left: anchorX - rect.width / 2, top: anchorY + gap },
      { side: 'above', left: anchorX - rect.width / 2, top: anchorY - rect.height - gap }
    ];

    const fits = (candidate: typeof candidates[number]) =>
      candidate.left >= margin &&
      candidate.top >= margin &&
      candidate.left + rect.width <= window.innerWidth - margin &&
      candidate.top + rect.height <= window.innerHeight - margin;

    const chosen = candidates.find(fits) || candidates
      .map(candidate => ({
        ...candidate,
        left: Math.min(Math.max(margin, candidate.left), window.innerWidth - rect.width - margin),
        top: Math.min(Math.max(margin, candidate.top), window.innerHeight - rect.height - margin)
      }))
      .sort((a, b) => {
        const areaA = Math.max(0, Math.min(a.left + rect.width, window.innerWidth) - Math.max(a.left, 0)) *
          Math.max(0, Math.min(a.top + rect.height, window.innerHeight) - Math.max(a.top, 0));
        const areaB = Math.max(0, Math.min(b.left + rect.width, window.innerWidth) - Math.max(b.left, 0)) *
          Math.max(0, Math.min(b.top + rect.height, window.innerHeight) - Math.max(b.top, 0));
        return areaB - areaA;
      })[0];

    setModalPosition({ top: chosen.top, left: chosen.left });
  }, [position.top, position.left, chords.length]);

  // Permite arrastar o modal pela alça do cabeçalho.
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!dragState.current) return;
      const modal = modalRef.current;
      if (!modal) return;
      const rect = modal.getBoundingClientRect();
      const left = Math.min(Math.max(8, event.clientX - dragState.current.x), window.innerWidth - rect.width - 8);
      const top = Math.min(Math.max(8, event.clientY - dragState.current.y), window.innerHeight - rect.height - 8);
      setModalPosition({ top, left });
    };
    const handlePointerUp = () => {
      if (!dragState.current) return;
      dragState.current = null;
      setIsDragging(false);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    const rect = modalRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragState.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      left: rect.left,
      top: rect.top
    };
    setIsDragging(true);
    event.preventDefault();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Separate chords into two groups (Natural and Sharp/Flat)
  // According to the user's list, they are interleaved in groups of 4.
  const naturalChords: string[] = [];
  const modifiedChords: string[] = [];

  for (let i = 0; i < chords.length; i += 8) {
    // Each set of 8 has 4 natural and 4 modified
    naturalChords.push(...chords.slice(i, i + 4));
    modifiedChords.push(...chords.slice(i + 4, i + 8));
  }

  // To fit in 8 columns x 8 rows:
  // Left 4 columns = naturalChords (32 chords)
  // Right 4 columns = modifiedChords (32 chords)

  return (
    <motion.div
      ref={modalRef}
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      className="fixed z-[100] bg-white dark:bg-zinc-900 border border-primary/20 dark:border-zinc-700 rounded-2xl shadow-2xl p-3 overflow-hidden"
      style={{
        top: modalPosition.top,
        left: modalPosition.left,
        minWidth: '400px',
        touchAction: 'none'
      }}
    >
      <div
        onPointerDown={startDrag}
        className={`flex items-center justify-between mb-2 px-2 -mx-3 -mt-3 py-2.5 bg-primary border-b border-primary ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        title="Arraste para mover o banco de acordes"
      >
        <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
          Banco de Acordes: {note} / {modifiedChords[0] || note + '#'}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-white/70 font-semibold">ESC para fechar</span>
          <button
            type="button"
            onClick={onClose}
            title="Fechar banco de acordes"
            aria-label="Fechar banco de acordes"
            className="w-7 h-7 rounded-full flex items-center justify-center bg-white/15 text-white hover:bg-white hover:text-primary transition-all"
          >
            <X size={15} />
          </button>
        </div>
      </div>

     <div className="grid grid-cols-8 gap-1">
        {/* Left 4 columns: Natural */}
        <div className="col-span-4 grid grid-cols-4 gap-1 pr-1 border-r border-zinc-100 dark:border-zinc-800">
          {naturalChords.map((chord, idx) => (
            <button
              key={`nat-${idx}`}
              onClick={() => onSelect(chord)}
              className="h-6 text-[11px] font-bold rounded border border-zinc-100 dark:border-zinc-800 text-primary hover:bg-primary hover:text-white dark:hover:bg-primary transition-all flex items-center justify-center bg-zinc-50 dark:bg-zinc-800/50"
            >
              {chord}
            </button>
          ))}
        </div>

        {/* Right 4 columns: Modified */}
        <div className="col-span-4 grid grid-cols-4 gap-1 pl-1">
          {modifiedChords.map((chord, idx) => (
            <button
              key={`mod-${idx}`}
              onClick={() => onSelect(chord)}
              className="h-6 text-[11px] font-bold rounded border border-zinc-100 dark:border-zinc-800 text-primary hover:bg-primary hover:text-white dark:hover:bg-red-600 transition-all flex items-center justify-center bg-zinc-100 dark:bg-zinc-800"
            >
              {chord}

            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
