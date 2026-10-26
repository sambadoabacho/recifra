import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';

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
      className="fixed z-[100] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-3 overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
        minWidth: '400px',
      }}
    >
      <div className="flex items-center justify-between mb-2 px-1 border-b border-zinc-100 dark:border-zinc-800 pb-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
          Banco de Acordes: {note} / {modifiedChords[0] || note + '#'}
        </h3>
        <span className="text-[10px] text-zinc-400 font-bold">ESC para fechar</span>
      </div>

      <div className="grid grid-cols-8 gap-1">
        {/* Left 4 columns: Natural */}
        <div className="col-span-4 grid grid-cols-4 gap-1 pr-1 border-r border-zinc-100 dark:border-zinc-800">
          {naturalChords.map((chord, idx) => (
            <button
              key={`nat-${idx}`}
              onClick={() => onSelect(chord)}
              className="h-10 text-[11px] font-bold rounded border border-zinc-100 dark:border-zinc-800 hover:bg-primary hover:text-white dark:hover:bg-primary transition-all flex items-center justify-center bg-zinc-50 dark:bg-zinc-800/50"
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
              className="h-10 text-[11px] font-bold rounded border border-zinc-100 dark:border-zinc-800 hover:bg-red-500 hover:text-white dark:hover:bg-red-600 transition-all flex items-center justify-center bg-zinc-100 dark:bg-zinc-800"
            >
              {chord}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
