import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Brain, Calendar, ChevronRight, LayoutGrid, Music, Trash2, Menu, Plus, Pencil, Check, X, GripVertical } from 'lucide-react';
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
          <h3 className="text-xl font-bold text-zinc-300 tracking-tight">Nenhum conjunto</h3>
          <p className="text-sm">Clique em <span className="text-primary font-bold">+ NOVO BLOCO</span> para criar sequências inteligentes manualmente ou com auxílio da IA.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
          
        </div>
      ))}
    </div>
  );
}

interface SongBlockDetailsProps {
    blockSet: SongBlock;
    songs: Song[];
    repertorios?: any[];
    onAddToRepertorio?: (suggestion: any, repertorioId: string) => Promise<void> | void;
    onBack: () => void;
    onUpdate?: (block: SongBlock) => Promise<void> | void;
}

export function SongBlockDetails({ blockSet, songs, repertorios = [], onAddToRepertorio, onBack, onUpdate }: SongBlockDetailsProps) {
    const [targetBySuggestion, setTargetBySuggestion] = useState<Record<number, string>>({});
    const [addingIndex, setAddingIndex] = useState<number | null>(null);
    const [editingTitle, setEditingTitle] = useState<number | null>(null);
    const [titleDraft, setTitleDraft] = useState('');
    const [dragSong, setDragSong] = useState<{songId:string; from:number} | null>(null);
    const [dragBlock, setDragBlock] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [addingSongsToBlock, setAddingSongsToBlock] = useState<number | null>(null);
    const [songSearchByBlock, setSongSearchByBlock] = useState<Record<number, string>>({});
    const [selectedSongsByBlock, setSelectedSongsByBlock] = useState<Record<number, string[]>>({});
    const suggestions = Array.isArray(blockSet.suggestions) ? blockSet.suggestions : [];

    const persist = async (nextSuggestions: any[]) => {
        const next = { ...blockSet, suggestions: nextSuggestions,
            totalSongs: nextSuggestions.reduce((n, group) => n + (group.songIds || []).length, 0) } as SongBlock;
        setSaving(true);
        try { await onUpdate?.(next); }
        finally { setSaving(false); }
    };

    const renameGroup = (idx:number) => {
        const name = titleDraft.trim();
        if (!name) return;
        const next = suggestions.map((g:any,i:number) => i === idx ? {...g, name} : g);
        void persist(next);
        setEditingTitle(null);
        setTitleDraft('');
    };


    const addSongsToGroup = (idx:number) => {
        const selected = selectedSongsByBlock[idx] || [];
        if (!selected.length) return;
        const next = suggestions.map((g:any,i:number) => i === idx
            ? {...g, songIds: [...(g.songIds || []), ...selected.filter((id:string) => !(g.songIds || []).includes(id))]}
            : g
        );
        void persist(next);
        setSelectedSongsByBlock(prev => ({...prev, [idx]:[]}));
        setSongSearchByBlock(prev => ({...prev, [idx]:''}));
        setAddingSongsToBlock(null);
    };


    const removeSong = (idx:number, sid:string) => {
        const next = suggestions.map((g:any,i:number) => i === idx ? {...g, songIds:(g.songIds || []).filter((id:string)=>id!==sid)} : g);
        void persist(next);
    };

    const moveSong = (sid:string, from:number, to:number, beforeId?:string) => {
        const next = suggestions.map((g:any)=>({...g, songIds:[...(g.songIds || [])]}));
        if (!next[from] || !next[to]) return;
        next[from].songIds = next[from].songIds.filter((id:string)=>id!==sid);
        const targetIds = next[to].songIds;
        const at = beforeId ? targetIds.indexOf(beforeId) : -1;
        targetIds.splice(at >= 0 ? at : targetIds.length, 0, sid);
        void persist(next);
        setDragSong(null);
    };

    const deleteGroup = (idx:number) => {
        const groupName = suggestions[idx]?.name || `Bloco ${idx + 1}`;
        if (!window.confirm(`Deseja excluir o bloco "${groupName}" deste conjunto?`)) return;
        const next = suggestions.filter((_:any, i:number) => i !== idx);
        void persist(next);
    };

    const moveGroup = (from:number,to:number) => {
        if (from === to || from < 0 || to < 0 || to >= suggestions.length) return;
        const next = [...suggestions];
        const [moved] = next.splice(from,1);
        next.splice(to,0,moved);
        void persist(next);
        setDragBlock(null);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {saving && <div className="text-xs text-[#174EA6] font-semibold">Salvando alterações...</div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 pb-12">
                {suggestions.map((suggestion:any, idx:number) => (
                    <div key={suggestion.id || `${idx}-${suggestion.name}`} draggable
                        onDragStart={() => setDragBlock(idx)}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); if (dragBlock !== null) moveGroup(dragBlock,idx); }}
                        className="bg-white border border-[#174EA6]/20 rounded-xl overflow-hidden flex flex-col shadow-sm min-w-0">
                        <div className="px-3 py-2.5 bg-[#174EA6]/5 border-b border-[#174EA6]/20 flex items-center gap-1.5">
                            <button className="text-[#174EA6] cursor-grab" title="Arrastar bloco"><GripVertical size={17}/></button>
                            <div className="flex-1 min-w-0">
                                {editingTitle === idx ? (
                                    <div className="flex gap-1">
                                        <input autoFocus value={titleDraft} onChange={e=>setTitleDraft(e.target.value)}
                                            onKeyDown={e=>{if(e.key==='Enter')renameGroup(idx);if(e.key==='Escape')setEditingTitle(null);}}
                                            className="min-w-0 flex-1 px-2 py-1 rounded border border-[#174EA6]/40 text-sm text-[#174EA6]"/>
                                        <button onClick={()=>renameGroup(idx)} className="text-[#174EA6]" title="Salvar nome"><Check size={17}/></button>
                                        <button onClick={()=>setEditingTitle(null)} className="text-gray-500" title="Cancelar"><X size={17}/></button>
                                    </div>
                                ) : <h4 className="text-base font-bold text-[#174EA6] truncate">{suggestion.name || `Bloco ${idx+1}`}</h4>}
                            </div>
                            <button onClick={()=>{setEditingTitle(idx);setTitleDraft(suggestion.name || '')}} className="p-1.5 text-[#174EA6] hover:bg-[#174EA6]/10 rounded" title="Renomear bloco"><Pencil size={15}/></button>
                            <button
                                type="button"
                                onClick={() => setAddingSongsToBlock(addingSongsToBlock === idx ? null : idx)}
                                className={`p-1.5 rounded hover:bg-[#174EA6]/10 ${addingSongsToBlock === idx ? 'bg-[#174EA6]/10 text-[#174EA6]' : 'text-[#174EA6]'}`}
                                title={addingSongsToBlock === idx ? 'Fechar seleção de músicas' : 'Adicionar músicas'}
                                aria-label={addingSongsToBlock === idx ? 'Fechar seleção de músicas' : 'Adicionar músicas'}
                            >
                                <Plus size={17}/>
                            </button>
                            <button
                                type="button"
                                onClick={() => deleteGroup(idx)}
                                className="p-1.5 rounded text-red-500 hover:bg-red-50"
                                title="Excluir bloco"
                                aria-label="Excluir bloco"
                            >
                                <Trash2 size={16}/>
                            </button>
                        </div>

                        {addingSongsToBlock === idx && (
                            <div className="px-4 pt-3">
                                <div className="rounded-lg border border-[#174EA6]/20 bg-[#174EA6]/[0.03] p-3 space-y-2">
                                    <input
                                        value={songSearchByBlock[idx] || ''}
                                        onChange={e => setSongSearchByBlock(prev => ({...prev, [idx]:e.target.value}))}
                                        placeholder="Buscar música ou artista..."
                                        className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-white text-xs outline-none focus:border-[#174EA6]"
                                    />
                                    <div className="max-h-40 overflow-y-auto space-y-1">
                                        {songs.filter(song => !(suggestion.songIds || []).includes(song.id || '') &&
                                            `${song.title} ${song.artist}`.toLocaleLowerCase('pt-BR').includes((songSearchByBlock[idx] || '').toLocaleLowerCase('pt-BR'))
                                        ).map(song => (
                                            <label key={song.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white text-xs cursor-pointer">
                                                <input type="checkbox" checked={(selectedSongsByBlock[idx] || []).includes(song.id || '')}
                                                    onChange={e => setSelectedSongsByBlock(prev => ({...prev,[idx]:e.target.checked
                                                        ? [...(prev[idx] || []), song.id || '']
                                                        : (prev[idx] || []).filter(id => id !== song.id)}))}/>
                                                <span className="min-w-0 flex-1 truncate font-semibold text-gray-800">{song.title}</span>
                                                <span className="min-w-0 truncate text-gray-500">{song.artist}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="flex justify-end">
                                        <button type="button" disabled={!(selectedSongsByBlock[idx] || []).length}
                                            onClick={() => addSongsToGroup(idx)}
                                            className="inline-flex items-center gap-1 rounded-lg bg-[#174EA6] px-3 py-2 text-[10px] font-bold text-white disabled:opacity-40">
                                            <Plus size={12}/> Adicionar selecionadas ({(selectedSongsByBlock[idx] || []).length})
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="p-3 pt-2.5 space-y-2 flex-1 min-h-20"
                            onDragOver={e=>e.preventDefault()}
                            onDrop={e=>{e.preventDefault(); if(dragSong) moveSong(dragSong.songId,dragSong.from,idx);}}>
                            {(suggestion.songIds || []).map((sid:string, songIndex:number) => {
                                const song = songs.find(s=>s.id===sid);
                                if(!song) return null;
                                return <div key={sid} draggable
                                    onDragStart={e=>{e.stopPropagation();setDragSong({songId:sid,from:idx});}}
                                    onDragOver={e=>e.preventDefault()}
                                    onDrop={e=>{e.preventDefault();e.stopPropagation();if(dragSong)moveSong(dragSong.songId,dragSong.from,idx,sid);}}
                                    className="flex items-center gap-2 px-2.5 py-2 bg-white rounded-lg border border-gray-200 hover:border-[#174EA6]/40">
                                    <GripVertical size={14} className="text-[#174EA6] cursor-grab shrink-0"/>
                                    <span className="text-[10px] text-[#174EA6] font-bold w-4">{songIndex+1}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-gray-900 truncate">{song.title}</div>
                                        <div className="text-[10px] text-gray-500 truncate">{song.artist} · <span className="text-[#174EA6] font-bold">{song.key}</span> · {song.tempo}</div>
                                    </div>
                                    <button onClick={()=>removeSong(idx,sid)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Remover música do bloco"><Trash2 size={14}/></button>
                                </div>;
                            })}
                            {(suggestion.songIds || []).length === 0 && <div className="text-xs text-gray-400 italic py-3">Bloco sem músicas.</div>}
                        </div>

                        {repertorios.length > 0 && onAddToRepertorio && (
                            <div className="px-4 pb-4 pt-2 border-t border-[#174EA6]/15 space-y-2">
                                <label className="block text-[9px] font-black uppercase tracking-widest text-[#174EA6]">Adicionar bloco a repertório</label>
                                <div className="flex gap-2">
                                    <select value={targetBySuggestion[idx] || ''} onChange={e=>setTargetBySuggestion(p=>({...p,[idx]:e.target.value}))}
                                        className="min-w-0 flex-1 h-9 px-2 rounded-lg border border-[#174EA6]/25 bg-white text-xs text-[#174EA6] font-semibold">
                                        <option value="">Selecione...</option>
                                        {repertorios.map((rep:any)=><option key={rep.id} value={rep.id}>{rep.title}</option>)}
                                    </select>
                                    <button disabled={!targetBySuggestion[idx] || addingIndex===idx}
                                        onClick={async()=>{const id=targetBySuggestion[idx];if(!id)return;setAddingIndex(idx);try{await onAddToRepertorio?.(suggestion,id);}finally{setAddingIndex(null);}}}
                                        className="h-9 px-3 rounded-lg bg-[#174EA6] text-white text-[10px] font-bold disabled:opacity-40">
                                        <Plus size={13} className="inline mr-1"/>{addingIndex===idx?'Adicionando':'Adicionar'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

import { Sparkles } from 'lucide-react';
