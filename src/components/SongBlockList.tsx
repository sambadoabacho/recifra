import React from 'react';
import { motion } from 'motion/react';
import { Brain, Calendar, ChevronRight, LayoutGrid, Music, Trash2, Info, Menu } from 'lucide-react';
import { Song, SongBlock } from '../types';

interface SongBlockListProps {
  blocks: SongBlock[];
  songs: Song[];
  onSelect: (block: SongBlock) => void;
  onDelete: (id: string) => void;
  isMaestro?: boolean;
}

export function SongBlockList({ blocks, songs, onSelect, onDelete, isMaestro = true }: SongBlockListProps) {
  if (blocks.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-zinc-500 space-y-4 text-center px-10">
        <div className="w-20 h-20 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-2">
          <Brain size={40} className="text-zinc-700" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-zinc-300 tracking-tight">Nenhuma sugestão gerada</h3>
          <p className="text-sm">Clique em <span className="text-primary font-bold">+ NOVO BLOCO</span> para criar sequências inteligentes usando IA.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {blocks.map(set => (
        <div 
          key={set.id}
          className="group bg-surface border border-border rounded-2xl overflow-hidden hover:border-primary transition-all cursor-pointer flex flex-col shadow-lg"
          onClick={() => onSelect(set)}
        >
          <div className="p-5 flex-1 space-y-4">
            <div className="flex justify-between items-start">
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                <LayoutGrid size={24} />
              </div>
              {isMaestro && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (set.id) onDelete(set.id);
                  }}
                  className="p-2 text-text-dim hover:text-red-500 transition-colors"
                  title="Excluir"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
            
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-text-main tracking-tight line-clamp-1">{set.title}</h3>
              <div className="flex items-center gap-2 text-xs text-text-dim font-medium">
                <Calendar size={12} />
                {new Date(set.createdAt).toLocaleDateString('pt-BR')}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <span className="px-2 py-1 rounded-md bg-bg border border-border text-text-dim text-[10px] font-bold uppercase tracking-wider">{set.profile}</span>
              <span className="px-2 py-1 rounded-md bg-bg border border-border text-text-dim text-[10px] font-bold uppercase tracking-wider">{set.suggestions.length} Blocos</span>
              <span className="px-2 py-1 rounded-md bg-bg border border-border text-text-dim text-[10px] font-bold uppercase tracking-wider">{set.totalSongs} Músicas</span>
            </div>
          </div>
          
          <div className="px-5 py-4 bg-primary/5 border-t border-border flex items-center justify-between group-hover:bg-primary transition-all">
            <span className="text-[10px] font-black uppercase tracking-widest text-text-dim group-hover:text-white">Ver Detalhes</span>
            <ChevronRight size={16} className="text-text-dim group-hover:text-white" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface SongBlockDetailsProps {
    blockSet: SongBlock;
    songs: Song[];
    onBack: () => void;
}

export function SongBlockDetails({ blockSet, songs, onBack }: SongBlockDetailsProps) {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <button onClick={onBack} className="text-primary text-xs font-bold uppercase tracking-widest flex items-center gap-1 hover:underline mb-2">
                         <Menu size={14} /> Voltar para a lista
                    </button>
                    <h2 className="text-3xl font-extrabold tracking-tight text-text-main">{blockSet.title}</h2>
                    <p className="text-text-dim text-sm italic">Sugestão gerada em {new Date(blockSet.createdAt).toLocaleDateString('pt-BR')} às {new Date(blockSet.createdAt).toLocaleTimeString('pt-BR')}</p>
                </div>
                <div className="hidden md:flex flex-wrap gap-3 justify-end max-w-sm">
                     <div className="p-3 bg-surface border border-border rounded-xl text-center">
                         <div className="text-[10px] font-bold text-text-dim uppercase tracking-tighter mb-0.5">Perfil</div>
                         <div className="text-xs font-black text-text-main">{blockSet.profile}</div>
                     </div>
                     <div className="p-3 bg-surface border border-border rounded-xl text-center">
                         <div className="text-[10px] font-bold text-text-dim uppercase tracking-tighter mb-0.5">Músicas</div>
                         <div className="text-xs font-black text-text-main">{blockSet.totalSongs}</div>
                     </div>
                     <div className="p-3 bg-surface border border-border rounded-xl text-center">
                         <div className="text-[10px] font-bold text-text-dim uppercase tracking-tighter mb-0.5">Blocos</div>
                         <div className="text-xs font-black text-text-main">{blockSet.suggestions.length}</div>
                     </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
                {blockSet.suggestions.map((suggestion, idx) => {
                    return (
                        <div key={idx} className="bg-surface border border-border rounded-2xl overflow-hidden flex flex-col shadow-xl">
                            <div className="p-6 bg-primary/5 border-b border-border flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <h4 className="text-xl font-bold text-text-main tracking-tight">{suggestion.name}</h4>
                                </div>
                                <div className="p-2 bg-surface border border-border rounded-lg text-primary">
                                    <Sparkles size={18} />
                                </div>
                            </div>
                            
                            <div className="flex-1 p-6 space-y-6">
                                <div className="space-y-3">
                                    {suggestion.songIds.map(sid => {
                                        const song = songs.find(s => s.id === sid);
                                        if(!song) return null;
                                        return (
                                            <div key={sid} className="flex items-center gap-4 p-3 bg-bg rounded-xl border border-border">
                                                <div className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center text-text-dim flex-shrink-0">
                                                    <Music size={18} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-text-main truncate">{song.title}</div>
                                                    <div className="text-[11px] text-text-dim flex items-center gap-2">
                                                        <span>{song.artist}</span>
                                                        <span className="w-1 h-1 rounded-full bg-border" />
                                                        <span className="text-primary font-bold">{song.key}</span>
                                                        <span className="w-1 h-1 rounded-full bg-border" />
                                                        <span>{song.tempo}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {suggestion.reason && (
                                    <div className="bg-bg p-4 rounded-xl space-y-2 border border-border">
                                        <div className="flex items-center gap-2 text-primary">
                                            <Info size={14} />
                                            <span className="text-[10px] font-black uppercase tracking-wider">Por que este grupo?</span>
                                        </div>
                                        <p className="text-xs text-text-dim leading-relaxed italic">"{suggestion.reason}"</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

import { Sparkles } from 'lucide-react';
