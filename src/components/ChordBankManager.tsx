import React, { useState } from 'react';
import { ChordBank } from '../types';
import { Save, Plus, Trash2, X } from 'lucide-react';

interface ChordBankManagerProps {
  chordBanks: ChordBank[];
  onSave: (note: string, chords: string[]) => void;
  onClose: () => void;
}

export const ChordBankManager: React.FC<ChordBankManagerProps> = ({
  chordBanks,
  onSave,
  onClose
}) => {
  const [selectedNote, setSelectedNote] = useState<string>('C');
  const currentBank = chordBanks.find(b => b.note === selectedNote);
  const [editingChords, setEditingChords] = useState<string>(currentBank?.chords.join(', ') || '');

  const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  const handleNoteChange = (note: string) => {
    setSelectedNote(note);
    const bank = chordBanks.find(b => b.note === note);
    setEditingChords(bank?.chords.join(', ') || '');
  };

  const handleSave = () => {
    const chordList = editingChords.split(',').map(c => c.trim()).filter(c => c !== '');
    if (chordList.length !== 64) {
      if (!window.confirm(`Você inseriu ${chordList.length} acordes. O ideal são 64 para preencher a grade 8x8. Deseja salvar assim mesmo?`)) {
        return;
      }
    }
    onSave(selectedNote, chordList);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-zinc-200 dark:border-zinc-800">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/20">
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tight text-zinc-900 dark:text-white">Gerenciar Banco de Acordes</h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Personalize os atalhos Shift + Tecla</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-all">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto">
          {/* Note Selection */}
          <div className="space-y-3">
            <label className="text-[9px] font-bold uppercase text-zinc-400 tracking-[0.2em]">Selecione a Nota Base</label>
            <div className="flex gap-2">
              {notes.map(note => (
                <button
                  key={note}
                  onClick={() => handleNoteChange(note)}
                  className={`flex-1 h-12 rounded-xl border font-bold text-base transition-all ${
                    selectedNote === note 
                      ? 'border-primary bg-primary text-white shadow-md scale-105' 
                      : 'border-zinc-100 dark:border-zinc-800 hover:border-primary/50 text-zinc-400 dark:text-zinc-500'
                  }`}
                >
                  {note}
                </button>
              ))}
            </div>
          </div>

          {/* Chord List Input */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-bold uppercase text-zinc-400 tracking-[0.2em]">Lista de Acordes (separados por vírgula)</label>
              <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {editingChords.split(',').filter(c => c.trim() !== '').length} / 64
              </span>
            </div>
            <textarea
              value={editingChords}
              onChange={e => setEditingChords(e.target.value)}
              className="w-full h-48 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 font-mono text-sm focus:ring-2 focus:ring-primary outline-none transition-all resize-none"
              placeholder="C, C7, C7+, C°, C#..."
            />
            <p className="text-[10px] text-zinc-400 italic">Dica: Os acordes devem ser separados por vírgula. A grade organiza em grupos de 4 (4 naturais, 4 modificados).</p>
          </div>
        </div>

        <div className="p-6 bg-zinc-50 dark:bg-zinc-800/20 border-t border-zinc-100 dark:border-zinc-800 flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 h-12 rounded-xl font-bold uppercase tracking-widest text-[11px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all text-zinc-600 dark:text-zinc-400"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            className="flex-1 h-12 rounded-xl font-bold uppercase tracking-widest text-[11px] bg-primary text-white shadow-md hover:shadow-primary/20 transition-all flex items-center justify-center gap-2"
          >
            <Save size={18} />
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};
