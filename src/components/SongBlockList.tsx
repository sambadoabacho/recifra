import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Brain, Calendar, ChevronRight, LayoutGrid, Music, Music2, Hourglass, Tag, Trash2, Menu, Plus, Pencil, Check, X, GripVertical, ChevronDown, Mic2, FolderOpen, Search, Users, Mic, ArrowUpDown, Filter } from 'lucide-react';
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
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
    folders?: any[];
    songBlocks?: any[];
    onAddToRepertorio?: (suggestion: any, repertorioId: string) => Promise<void> | void;
    onBack: () => void;
    onUpdate?: (block: SongBlock) => Promise<void> | void;
}

export function SongBlockDetails({ blockSet, songs, repertorios = [], folders = [], songBlocks = [], onAddToRepertorio, onBack, onUpdate }: SongBlockDetailsProps) {
    const [targetBySuggestion, setTargetBySuggestion] = useState<Record<number, string>>({});
    const [addingIndex, setAddingIndex] = useState<number | null>(null);
    const [editingTitle, setEditingTitle] = useState<number | null>(null);
    const [titleDraft, setTitleDraft] = useState('');
    const [dragSong, setDragSong] = useState<{songId:string; from:number} | null>(null);
    const [dragBlock, setDragBlock] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [addingSongsToBlock, setAddingSongsToBlock] = useState<number | null>(null);
    const [addModalTab, setAddModalTab] = useState<'songs' | 'repertorio' | 'blocks'>('songs');
    const [selectedSourceFolderId, setSelectedSourceFolderId] = useState<string>('__all__');
    const [addModalSearch, setAddModalSearch] = useState('');
    const [addModalSortBy, setAddModalSortBy] = useState<'title' | 'artist' | 'composition' | 'updatedAt' | 'key'>('title');
    const [addModalSortOpen, setAddModalSortOpen] = useState(false);
    const [addModalFiltersOpen, setAddModalFiltersOpen] = useState(false);
    const [addModalFilterKey, setAddModalFilterKey] = useState('');
    const [addModalFilterTempo, setAddModalFilterTempo] = useState('');
    const [addModalFilterCategory, setAddModalFilterCategory] = useState('');
    const [addModalVoiceActive, setAddModalVoiceActive] = useState(false);
    const addModalRecognitionRef = React.useRef<any>(null);
    const [selectedSongsByBlock, setSelectedSongsByBlock] = useState<Record<number, string[]>>({});
    const [selectedSongKeysByBlock, setSelectedSongKeysByBlock] = useState<Record<number, Record<string, string>>>({});
    const [openKeyMenu, setOpenKeyMenu] = useState<string | null>(null);
    const [keyMenuPosition, setKeyMenuPosition] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

    // O menu é renderizado no document.body para não ser cortado pelo overflow dos cards.
    const toggleKeyMenu = (menuId: string, event: React.MouseEvent<HTMLButtonElement>) => {
        if (openKeyMenu === menuId) {
            setOpenKeyMenu(null);
            setKeyMenuPosition(null);
            return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        const menuWidth = 240;
        const margin = 8;
        const maxHeight = Math.min(420, window.innerHeight - margin * 2);
        let left = rect.left;
        if (left + menuWidth > window.innerWidth - margin) left = rect.right - menuWidth;
        left = Math.max(margin, Math.min(left, window.innerWidth - menuWidth - margin));
        let top = rect.bottom + 4;
        if (top + maxHeight > window.innerHeight - margin) top = rect.top - maxHeight - 4;
        top = Math.max(margin, Math.min(top, window.innerHeight - maxHeight - margin));
        setKeyMenuPosition({ top, left, maxHeight });
        setOpenKeyMenu(menuId);
    };
    const suggestions = Array.isArray(blockSet.suggestions) ? blockSet.suggestions : [];

    const getVocalistKeys = (songId: string) => {
        const vocalistFolderIds = new Set(
            folders.filter(folder => (folder.name || '').trim().toLocaleUpperCase('pt-BR') === 'VOCALISTAS').map(folder => folder.id)
        );
        return repertorios
            .filter(rep => !!rep.folderId && vocalistFolderIds.has(rep.folderId) &&
                Array.isArray(rep.songIds) && rep.songIds.includes(songId) &&
                typeof rep.songKeys?.[songId] === 'string' && rep.songKeys[songId].trim() !== '')
            .map(rep => ({ id: rep.id || rep.title, name: rep.title || 'Vocalista', key: rep.songKeys[songId] }))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    };

    const updateSongKey = (idx: number, sid: string, key: string) => {
        const next = suggestions.map((group: any, i: number) => {
            if (i !== idx) return group;
            return { ...group, songKeys: { ...(group.songKeys || {}), [sid]: key } };
        });
        void persist(next);
    };

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
        const selectedKeys = selectedSongKeysByBlock[idx] || {};
        const next = suggestions.map((g:any,i:number) => {
            if (i !== idx) return g;
            const existing = g.songIds || [];
            const newIds = selected.filter((id:string) => !existing.includes(id));
            const nextKeys = { ...(g.songKeys || {}) };
            newIds.forEach((id:string) => {
                if (selectedKeys[id]) nextKeys[id] = selectedKeys[id];
            });
            return { ...g, songIds: [...existing, ...newIds], songKeys: nextKeys };
        });
        void persist(next);
        setSelectedSongsByBlock(prev => ({...prev, [idx]:[]}));
        setSelectedSongKeysByBlock(prev => ({...prev, [idx]:{}}));
        setAddingSongsToBlock(null);
        setAddModalSearch('');
        setSelectedSourceFolderId('__all__');
    };


    const songFolders = folders.filter((folder:any) => !folder.type || folder.type === 'song');
    const vocalistRootFolders = folders.filter((folder:any) =>
        (folder.name || '').trim().toLocaleUpperCase('pt-BR') === 'VOCALISTAS' || folder.type === 'vocalist'
    );
    const vocalistRootIds = new Set(vocalistRootFolders.map((folder:any) => folder.id));
    const vocalistSources = repertorios.filter((rep:any) => !!rep.folderId && vocalistRootIds.has(rep.folderId));
    const repertorioFolders = folders.filter((folder:any) => folder.type === 'repertorio');
    const repertorioSources = repertorios.filter((rep:any) => !!rep.folderId && repertorioFolders.some((folder:any) => folder.id === rep.folderId) && rep.id !== blockSet.id);
    const blockFolders = folders.filter((folder:any) => folder.type === 'block' && folder.id !== blockSet.folderId);
    const blockSources = songBlocks.filter((item:any) => blockFolders.some((folder:any) => folder.id === item.folderId));
    const activeVocalistSource = addModalTab === 'songs'
        ? vocalistSources.find((rep:any) => rep.id === selectedSourceFolderId)
        : null;
    const activeRepertorioSource = addModalTab === 'repertorio' ? repertorioSources.find((rep:any) => rep.id === selectedSourceFolderId) : null;
    const activeBlockSource = addModalTab === 'blocks' ? blockSources.find((item:any) => item.id === selectedSourceFolderId) : null;
    // Reconstrói a listagem do setlist seguindo exatamente a sequência de songIds:
    // cada marcador aparece no ponto em que foi cadastrado e suas músicas vêm logo abaixo,
    // até o próximo marcador. Isso preserva também reordenações feitas no menu Repertório.
    const repertorioRows = (() => {
        if (!activeRepertorioSource) return [] as any[];
        const ids: string[] = activeRepertorioSource.songIds || [];
        const groups: any[] = activeRepertorioSource.songGroups || [];
        const rows: any[] = [];
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            if (String(id).startsWith('group:')) {
                const groupId = String(id).slice(6);
                const group = groups.find((item:any) => item.id === groupId);
                if (!group) continue;
                const groupSongIds: string[] = [];
                for (let j = i + 1; j < ids.length && !String(ids[j]).startsWith('group:'); j++) {
                    if (songs.some((song:any) => song.id === ids[j])) groupSongIds.push(ids[j]);
                }
                rows.push({ type: 'group', group: { ...group, songIds: groupSongIds }, songIds: groupSongIds });
            } else {
                const song = songs.find((item:any) => item.id === id);
                if (song) rows.push({ type: 'song', song });
            }
        }
        return rows;
    })();
    const selectedRepertorioGroups = repertorioRows.filter((row:any) => row.type === 'group').map((row:any) => row.group);
    const selectedRepertorioSongIds = repertorioRows.filter((row:any) => row.type === 'song').map((row:any) => row.song.id)
        .concat(repertorioRows.filter((row:any) => row.type === 'group').flatMap((row:any) => row.songIds));
    const selectedBlockSourceSuggestions = activeBlockSource?.suggestions || [];
    const selectedBlockSongs = addingSongsToBlock === null ? [] : (suggestions[addingSongsToBlock]?.songIds || []);
    const availableModalSongs = addModalTab === 'songs'
        ? songs.filter((song:any) => selectedSourceFolderId === '__all__' || song.folderId === selectedSourceFolderId)
        : addModalTab === 'repertorio' && activeRepertorioSource
            ? songs.filter((song:any) => selectedRepertorioSongIds.includes(song.id))
            : addModalTab === 'blocks' && activeBlockSource
                ? []
                : activeVocalistSource ? songs.filter((song:any) => (activeVocalistSource.songIds || []).includes(song.id)) : [];
    const matchesModalSong = (song:any) =>
        `${song.title || ''} ${song.artist || ''} ${song.composition || ''}`.toLocaleLowerCase('pt-BR').includes(addModalSearch.toLocaleLowerCase('pt-BR')) &&
        (!addModalFilterKey || song.key === addModalFilterKey) &&
        (!addModalFilterTempo || song.tempo === addModalFilterTempo) &&
        (!addModalFilterCategory || song.category === addModalFilterCategory);
    const visibleRepertorioRows = repertorioRows.filter((row:any) => row.type === 'group' || matchesModalSong(row.song));
    const visibleModalSongs = availableModalSongs.filter(matchesModalSong).sort((a:any,b:any) => {
        const field = addModalSortBy;
        const av = field === 'updatedAt' ? new Date(a.updatedAt || 0).getTime() : String(field === 'key' ? (a.key || '') : (a[field] || a.title || '')).toLocaleLowerCase('pt-BR');
        const bv = field === 'updatedAt' ? new Date(b.updatedAt || 0).getTime() : String(field === 'key' ? (b.key || '') : (b[field] || b.title || '')).toLocaleLowerCase('pt-BR');
        return field === 'updatedAt' ? Number(bv) - Number(av) : String(av).localeCompare(String(bv), 'pt-BR');
    });
    const modalKeys = Array.from(new Set(availableModalSongs.map((song:any) => song.key).filter(Boolean))).sort((a:any,b:any) => String(a).localeCompare(String(b), 'pt-BR'));
    const modalCategories = Array.from(new Set(availableModalSongs.map((song:any) => song.category).filter(Boolean))).sort((a:any,b:any) => String(a).localeCompare(String(b), 'pt-BR'));
    const toggleAddModalVoiceSearch = () => {
        if (addModalVoiceActive) { addModalRecognitionRef.current?.stop?.(); setAddModalVoiceActive(false); return; }
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        try {
            const recognition = new SpeechRecognition();
            recognition.lang = 'pt-BR'; recognition.continuous = false; recognition.interimResults = false; recognition.maxAlternatives = 1;
            recognition.onresult = (event:any) => { const transcript = event.results?.[0]?.[0]?.transcript?.trim(); if (transcript) setAddModalSearch(transcript); };
            recognition.onerror = () => setAddModalVoiceActive(false);
            recognition.onend = () => setAddModalVoiceActive(false);
            addModalRecognitionRef.current = recognition; recognition.start(); setAddModalVoiceActive(true);
        } catch { setAddModalVoiceActive(false); }
    };

    const toggleModalSong = (song:any) => {
        if (addingSongsToBlock === null || !song.id) return;
        const idx = addingSongsToBlock;
        const currentlySelected = selectedSongsByBlock[idx] || [];
        const isSelected = currentlySelected.includes(song.id);
        setSelectedSongsByBlock(prev => ({
            ...prev,
            [idx]: isSelected ? currentlySelected.filter(id => id !== song.id) : [...currentlySelected, song.id]
        }));
        setSelectedSongKeysByBlock(prev => {
            const next = { ...(prev[idx] || {}) };
            if (isSelected) delete next[song.id];
            else if (activeRepertorioSource?.songKeys?.[song.id]) next[song.id] = activeRepertorioSource.songKeys[song.id];
            else if (activeVocalistSource?.songKeys?.[song.id]) next[song.id] = activeVocalistSource.songKeys[song.id];
            else delete next[song.id];
            return { ...prev, [idx]: next };
        });
    };

    const toggleRepertorioGroup = (group:any) => {
        if (addingSongsToBlock === null) return;
        const idx = addingSongsToBlock;
        const ids = (group.songIds || []).filter((id:string) => songs.some((song:any) => song.id === id) && !(suggestions[idx]?.songIds || []).includes(id));
        setSelectedSongsByBlock(prev => {
            const current = prev[idx] || [];
            const allSelected = ids.length > 0 && ids.every((id:string) => current.includes(id));
            return { ...prev, [idx]: allSelected ? current.filter((id:string) => !ids.includes(id)) : [...new Set([...current, ...ids])] };
        });
    };
    const addBlockSuggestion = (source:any) => {
        if (addingSongsToBlock === null) return;
        const idx = addingSongsToBlock;
        const ids = (source.songIds || []).filter((id:string) => songs.some((song:any) => song.id === id) && !(suggestions[idx]?.songIds || []).includes(id));
        setSelectedSongsByBlock(prev => ({ ...prev, [idx]: [...new Set([...(prev[idx] || []), ...ids])] }));
    };

    const openAddSongsModal = (idx:number) => {
        if (addingSongsToBlock === idx) {
            setAddingSongsToBlock(null);
            return;
        }
        setAddingSongsToBlock(idx);
        setAddModalTab('songs');
        setSelectedSourceFolderId('__all__');
        setAddModalSearch('');
    };

    const removeSong = (idx:number, sid:string) => {
        const next = suggestions.map((g:any,i:number) => i === idx ? {...g, songIds:(g.songIds || []).filter((id:string)=>id!==sid)} : g);
        void persist(next);
    };

    const moveSong = (sid:string, from:number, to:number, beforeId?:string) => {
        const next = suggestions.map((g:any)=>({...g, songIds:[...(g.songIds || [])]}));
        if (!next[from] || !next[to] || !next[from].songIds.includes(sid)) {
            setDragSong(null);
            return;
        }
        if (beforeId === sid) {
            setDragSong(null);
            return;
        }

        // Remove da origem antes de calcular a posição final no destino.
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

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 pb-12">
                {suggestions.map((suggestion:any, idx:number) => (
                    <div key={suggestion.id || `${idx}-${suggestion.name}`}
                        onDragOver={e => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; }}
                        onDrop={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            const payload = e.dataTransfer.getData('text/plain');
                            if (payload.startsWith('song:')) {
                                const draggedId = payload.slice(5);
                                const sourceIndex = suggestions.findIndex((group:any) => (group.songIds || []).includes(draggedId));
                                if (sourceIndex >= 0) { moveSong(draggedId, sourceIndex, idx); return; }
                            }
                            if (dragBlock !== null) moveGroup(dragBlock,idx);
                        }}
                        className="bg-white border border-[#174EA6]/20 rounded-xl overflow-hidden flex flex-col shadow-sm min-w-0">
                        <div className="px-3 py-2.5 bg-[#174EA6]/5 border-b border-[#174EA6]/20 flex items-center gap-1.5">
                            <button
                                type="button"
                                draggable
                                onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', `block:${idx}`); setDragBlock(idx); }}
                                onDragEnd={() => setDragBlock(null)}
                                className="text-[#174EA6] cursor-grab active:cursor-grabbing"
                                title="Arrastar bloco"
                                aria-label={`Mover bloco ${suggestion.name || idx + 1}`}
                            >
                                <GripVertical size={17}/>
                            </button>
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
                            <button
                                type="button"
                                onClick={() => openAddSongsModal(idx)}
                                className={`p-1.5 rounded hover:bg-[#174EA6]/10 ${addingSongsToBlock === idx ? 'bg-[#174EA6]/10 text-[#174EA6]' : 'text-[#174EA6]'}`}
                                title="Adicionar músicas"
                                aria-label="Adicionar músicas"
                            >
                                <Plus size={17}/>
                            </button>
                            <button onClick={()=>{setEditingTitle(idx);setTitleDraft(suggestion.name || '')}} className="p-1.5 text-[#174EA6] hover:bg-[#174EA6]/10 rounded" title="Renomear bloco"><Pencil size={15}/></button>
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

                        <div className="p-3 pt-2.5 space-y-2 flex-1 min-h-20"
                            onDragOver={e=>{e.preventDefault();e.stopPropagation();if(e.dataTransfer)e.dataTransfer.dropEffect='move';}}
                            onDrop={e=>{
                                e.preventDefault();
                                e.stopPropagation();
                                const payload = e.dataTransfer.getData('text/plain');
                                const draggedId = payload.startsWith('song:') ? payload.slice(5) : dragSong?.songId;
                                if (!draggedId) return;
                                const sourceIndex = suggestions.findIndex((group:any) => (group.songIds || []).includes(draggedId));
                                if (sourceIndex >= 0) moveSong(draggedId, sourceIndex, idx);
                            }}>
                            {(suggestion.songIds || []).map((sid:string, songIndex:number) => {
                                const song = songs.find(s=>s.id===sid);
                                if(!song) return null;
                                const songCategory = (song as any).category || (song as any).genre || (song as any).type;
                                return <div key={sid}
                                    onDragOver={e=>{e.preventDefault();e.stopPropagation();if(e.dataTransfer)e.dataTransfer.dropEffect='move';}}
                                    onDrop={e=>{
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const payload = e.dataTransfer.getData('text/plain');
                                        const draggedId = payload.startsWith('song:') ? payload.slice(5) : dragSong?.songId;
                                        if (!draggedId) return;
                                        const sourceIndex = suggestions.findIndex((group:any) => (group.songIds || []).includes(draggedId));
                                        if (sourceIndex >= 0) moveSong(draggedId, sourceIndex, idx, sid);
                                    }}
                                    className="flex items-center gap-2 px-2 py-2 bg-white rounded-lg border border-gray-200 hover:border-[#174EA6]/40">
                                    <span
                                        draggable
                                        onDragStart={e=>{
                                            e.stopPropagation();
                                            e.dataTransfer.effectAllowed='move';
                                            e.dataTransfer.setData('text/plain', `song:${sid}`);
                                            setDragSong({songId:sid,from:idx});
                                        }}
                                        onDragEnd={()=>setDragSong(null)}
                                        className="mt-0.5 inline-flex shrink-0 cursor-grab self-start text-[#174EA6] active:cursor-grabbing"
                                        title="Arrastar para reordenar música"
                                        aria-label={`Mover ${song.title}`}
                                    >
                                        <GripVertical size={13}/>
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        {/* Linha 1: numeração integrada ao título e ação de remover */}
                                        <div className="flex min-w-0 items-center gap-1">
                                            <div className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900">
                                                {songIndex + 1}. {song.title}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); removeSong(idx, sid); }}
                                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-red-500 hover:bg-red-50"
                                                title="Remover música do bloco"
                                                aria-label={`Remover ${song.title}`}
                                            >
                                                <X size={15}/>
                                            </button>
                                        </div>

                                        {/* Linha 2: intérprete e compositor */}
                                        <div className="mt-0.5 min-w-0 truncate pl-0 text-[10px] leading-3 text-gray-500">
                                            {[song.artist, (song as any).composition].filter(Boolean).join(' · ')}
                                        </div>

                                        {/* Linha 3: tonalidade, andamento e categoria */}
                                        <div className="mt-0.5 flex min-w-0 flex-nowrap items-center gap-1 pl-0">
                                            <div className="relative shrink-0" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    onClick={(event) => toggleKeyMenu(`${idx}:${sid}`, event)}
                                                    aria-label={`Alterar tom de ${song.title}`}
                                                    aria-expanded={openKeyMenu === `${idx}:${sid}`}
                                                    className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-[#0D47A1] px-2 text-[9px] font-black leading-none text-white shadow-sm hover:bg-[#123D87] transition-colors"
                                                >
                                                    {(suggestion.songKeys || {})[sid] || song.key || '—'}
                                                    <ChevronDown size={10} />
                                                </button>
                                                {openKeyMenu === `${idx}:${sid}` && keyMenuPosition && createPortal(
                                                    <div style={{ position: 'fixed', top: keyMenuPosition.top, left: keyMenuPosition.left, width: 240, maxHeight: keyMenuPosition.maxHeight, overflowY: 'auto', zIndex: 99999 }} className="rounded-xl border border-[#DCE3EC] bg-white p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
                                                        <button type="button" onClick={() => { updateSongKey(idx, sid, song.key || ''); setOpenKeyMenu(null); }}
                                                            className={`mb-2 flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-[11px] font-bold ${((suggestion.songKeys || {})[sid] || song.key) === song.key ? 'border-[#0D47A1]/40 bg-[#0D47A1]/10 text-[#0D47A1]' : 'border-gray-200 text-gray-600 hover:border-[#0D47A1]/40'}`}>
                                                            <span>Tom original</span><span className="rounded-md bg-[#0D47A1]/10 px-2 py-0.5 font-black text-[#0D47A1]">{song.key || '—'}</span>
                                                        </button>
                                                        <div className="grid grid-cols-4 gap-1">
                                                            {(song.key?.endsWith('m') ? ['Cm','C#m','Dm','D#m','Em','Fm','F#m','Gm','G#m','Am','A#m','Bm'] : ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']).map(k => (
                                                                <button key={k} type="button" onClick={() => { updateSongKey(idx, sid, k); setOpenKeyMenu(null); }}
                                                                    className={`rounded-md border px-1.5 py-2 text-[10px] font-bold transition-colors ${((suggestion.songKeys || {})[sid] || song.key) === k ? 'border-[#0D47A1] bg-[#0D47A1] text-white' : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-[#0D47A1]/50 hover:text-[#0D47A1]'}`}>{k}</button>
                                                            ))}
                                                        </div>
                                                        {getVocalistKeys(sid).length > 0 && (
                                                            <div className="mt-2 border-t border-gray-200 pt-2">
                                                                <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[9px] font-black uppercase tracking-wider text-gray-500"><Mic2 size={11}/> Tons dos vocalistas</div>
                                                                <div className="max-h-36 space-y-1 overflow-y-auto">
                                                                    {getVocalistKeys(sid).map(v => (
                                                                        <button key={v.id} type="button" onClick={() => { updateSongKey(idx, sid, v.key); setOpenKeyMenu(null); }}
                                                                            className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-[10px] ${((suggestion.songKeys || {})[sid] || song.key) === v.key ? 'border-[#0D47A1]/40 bg-[#0D47A1]/10 text-[#0D47A1]' : 'border-gray-200 bg-white text-gray-600 hover:border-[#0D47A1]/40'}`}>
                                                                            <span className="min-w-0 truncate font-bold">{v.name}</span><span className="shrink-0 rounded-md bg-[#0D47A1]/10 px-2 py-0.5 font-black text-[#0D47A1]">{v.key}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>,
                                                    document.body
                                                )}
                                            </div>
                                            {song.tempo && (
                                                <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-[#4F78E8] px-2 text-[9px] font-bold text-white">
                                                    {song.tempo}
                                                </span>
                                            )}
                                            {songCategory && (
                                                <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-[#DCE3EC] bg-white px-2 text-[9px] font-bold text-[#0D47A1]">
                                                    {songCategory}
                                                </span>
                                            )}
                                        </div>
                                    </div>
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

            {addingSongsToBlock !== null && createPortal(
                <div
                    className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/45 p-3 sm:p-6"
                    onMouseDown={e => { if (e.target === e.currentTarget) setAddingSongsToBlock(null); }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="add-block-songs-title"
                        className="flex h-[min(760px,88vh)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#DCE3EC] bg-white shadow-2xl"
                    >
                        <div className="flex items-center gap-3 border-b border-[#DCE3EC] px-4 py-3 sm:px-5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF3FA] text-[#0D47A1]"><Music size={18}/></div>
                            <div className="min-w-0 flex-1">
                                <h3 id="add-block-songs-title" className="text-sm font-black text-[#0D47A1]">Adicionar músicas ao bloco</h3>
                                <p className="mt-0.5 text-[10px] text-slate-500">Escolha uma origem e selecione músicas, marcadores ou blocos.</p>
                            </div>
                            <button type="button" onClick={() => setAddingSongsToBlock(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Fechar modal"><X size={18}/></button>
                        </div>

                        <div className="flex gap-2 border-b border-[#DCE3EC] px-4 py-3 sm:px-5">
                            {([['songs','Músicas'],['repertorio','Repertório'],['blocks','Blocos']] as const).map(([tab,label]) => <button key={tab} type="button" onClick={() => { setAddModalTab(tab); setSelectedSourceFolderId(tab === 'songs' ? '__all__' : tab === 'repertorio' ? (repertorioSources[0]?.id || '') : (blockSources[0]?.id || '')); setAddModalSearch(''); }} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${addModalTab === tab ? 'bg-[#0D47A1] text-white' : 'bg-[#F3F6FA] text-[#0D47A1]'}`}><FolderOpen size={14}/>{label}</button>)}
                        </div>

                        <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[220px_minmax(0,1fr)]">
                            <aside className="max-h-36 overflow-y-auto border-b border-[#DCE3EC] bg-[#F7F9FC] p-2 sm:max-h-none sm:border-b-0 sm:border-r">
                                {addModalTab === 'songs' ? <>
                                    <button type="button" onClick={() => setSelectedSourceFolderId('__all__')} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs ${selectedSourceFolderId === '__all__' ? 'bg-[#E7EEF8] font-bold text-[#0D47A1]' : 'text-slate-600 hover:bg-white'}`}><Music size={14}/> Todas <span className="ml-auto text-[10px]">{songs.length}</span></button>
                                    {songFolders.map((folder:any) => <button key={folder.id} type="button" onClick={() => setSelectedSourceFolderId(folder.id)} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs ${selectedSourceFolderId === folder.id ? 'bg-[#E7EEF8] font-bold text-[#0D47A1]' : 'text-slate-600 hover:bg-white'}`}><FolderOpen size={14}/><span className="min-w-0 flex-1 truncate">{folder.name}</span><span className="text-[10px]">{songs.filter((song:any) => song.folderId === folder.id).length}</span></button>)}
                                </> : addModalTab === 'repertorio' ? <>
                                    {repertorioFolders.map((folder:any) => <div key={folder.id} className="mb-2"><div className="px-2 py-1 text-[10px] font-black uppercase text-slate-400"><FolderOpen size={12} className="mr-1 inline"/>{folder.name}</div>{repertorioSources.filter((rep:any) => rep.folderId === folder.id).map((rep:any) => <button key={rep.id} type="button" onClick={() => setSelectedSourceFolderId(rep.id)} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs ${selectedSourceFolderId === rep.id ? 'bg-[#E7EEF8] font-bold text-[#0D47A1]' : 'text-slate-600 hover:bg-white'}`}><Music size={13}/><span className="min-w-0 flex-1 truncate">{rep.title}</span></button>)}</div>)}
                                    {repertorioSources.length === 0 && <p className="px-2 py-4 text-center text-[11px] text-slate-400">Nenhum repertório disponível.</p>}
                                </> : <>
                                    {blockFolders.map((folder:any) => <button key={folder.id} type="button" onClick={() => setSelectedSourceFolderId(blockSources.find((item:any) => item.folderId === folder.id)?.id || '')} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs ${blockSources.some((item:any) => item.id === selectedSourceFolderId && item.folderId === folder.id) ? 'bg-[#E7EEF8] font-bold text-[#0D47A1]' : 'text-slate-600 hover:bg-white'}`}><FolderOpen size={14}/><span className="min-w-0 flex-1 truncate">{folder.name}</span></button>)}
                                    {blockSources.length === 0 && <p className="px-2 py-4 text-center text-[11px] text-slate-400">Nenhum conjunto de blocos disponível.</p>}
                                </>}
                            </aside>

                            <section className="flex min-h-0 flex-col p-3 sm:p-4">
                                <div className="relative mb-3">
                                    <Search size={14} className="absolute left-10 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                                    <input value={addModalSearch} onChange={e => setAddModalSearch(e.target.value)}
                                        placeholder="Buscar música ou intérprete..."
                                        className="h-9 w-full rounded-lg border border-[#DCE3EC] bg-white pl-[4.25rem] pr-[5.5rem] text-xs outline-none focus:border-[#0D47A1]"/>
                                    <button type="button" onClick={toggleAddModalVoiceSearch} title={addModalVoiceActive ? 'Parar busca por voz' : 'Pesquisar por voz'} aria-label="Pesquisar por voz" className={`absolute left-1 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md ${addModalVoiceActive ? 'bg-red-50 text-red-600 animate-pulse' : 'text-[#0D47A1] hover:bg-[#EEF4FF]'}`}><Mic size={15}/></button>
                                    <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                                        <button type="button" onClick={() => {setAddModalSortOpen(v=>!v);setAddModalFiltersOpen(false);}} title="Ordenar músicas" aria-label="Ordenar músicas" className={`flex h-7 w-7 items-center justify-center rounded-md ${addModalSortOpen ? 'bg-[#EEF4FF] text-[#0D47A1]' : 'text-slate-400 hover:bg-slate-100'}`}><ArrowUpDown size={15}/></button>
                                        <button type="button" onClick={() => {setAddModalFiltersOpen(v=>!v);setAddModalSortOpen(false);}} title="Filtrar músicas" aria-label="Filtrar músicas" className={`flex h-7 w-7 items-center justify-center rounded-md ${(addModalFilterKey || addModalFilterTempo || addModalFilterCategory) ? 'bg-[#EEF4FF] text-[#0D47A1]' : addModalFiltersOpen ? 'bg-[#EEF4FF] text-[#0D47A1]' : 'text-slate-400 hover:bg-slate-100'}`}><Filter size={15}/></button>
                                    </div>
                                    {addModalSortOpen && <div className="absolute right-10 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-[#DCE3EC] bg-white py-1 shadow-xl">{([{value:'title',label:'Título',Icon:Music},{value:'composition',label:'Composição',Icon:Pencil},{value:'artist',label:'Artista',Icon:Users},{value:'updatedAt',label:'Modificação',Icon:Calendar},{value:'key',label:'Tonalidade',Icon:Music2}] as const).map((option,index)=><button key={option.value} type="button" onClick={()=>{setAddModalSortBy(option.value);setAddModalSortOpen(false);}} className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs ${index>0?'border-t border-[#E8EDF3]':''} ${addModalSortBy===option.value?'bg-[#EEF4FF] font-bold text-[#0D47A1]':'text-slate-700 hover:bg-slate-50'}`}><option.Icon size={14} className={addModalSortBy===option.value?'text-[#0D47A1]':'text-slate-400'}/><span className="flex-1">{option.label}</span>{addModalSortBy===option.value&&<Check size={13}/>}</button>)}</div>}
                                    {addModalFiltersOpen && <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-[#DCE3EC] bg-white p-3 shadow-xl">
                                        <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Filtros</div>
                                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">Tonalidade</label><select value={addModalFilterKey} onChange={e=>setAddModalFilterKey(e.target.value)} className="mb-2 w-full rounded-lg border border-[#DCE3EC] bg-white px-2 py-2 text-xs"><option value="">Todas as tonalidades</option>{modalKeys.map((key:any)=><option key={key} value={key}>{key}</option>)}</select>
                                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">Andamento</label><select value={addModalFilterTempo} onChange={e=>setAddModalFilterTempo(e.target.value)} className="mb-2 w-full rounded-lg border border-[#DCE3EC] bg-white px-2 py-2 text-xs"><option value="">Todos os andamentos</option><option value="Lento">Lento</option><option value="Moderado">Moderado</option><option value="Rápido">Rápido</option></select>
                                        <label className="mb-1 block text-[10px] font-semibold text-slate-600">Categoria</label><select value={addModalFilterCategory} onChange={e=>setAddModalFilterCategory(e.target.value)} className="w-full rounded-lg border border-[#DCE3EC] bg-white px-2 py-2 text-xs"><option value="">Todas as categorias</option>{modalCategories.map((category:any)=><option key={category} value={category}>{category}</option>)}</select>
                                        {(addModalFilterKey||addModalFilterTempo||addModalFilterCategory)&&<button type="button" onClick={()=>{setAddModalFilterKey('');setAddModalFilterTempo('');setAddModalFilterCategory('');}} className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-[10px] font-bold text-[#0D47A1] hover:bg-[#EEF4FF]">Limpar filtros</button>}
                                    </div>}
                                </div>
                                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
                                    {addModalTab === 'repertorio' && visibleRepertorioRows.map((row:any, rowIndex:number) => {
                                        if (row.type === 'group') {
                                            const group = row.group;
                                            const allIds = row.songIds as string[];
                                            const ids = allIds.filter((id:string) => !selectedBlockSongs.includes(id));
                                            const alreadyCount = allIds.length - ids.length;
                                            const selected = selectedSongsByBlock[addingSongsToBlock] || [];
                                            const checked = ids.length > 0 && ids.every((id:string) => selected.includes(id));
                                            return <label key={`group-${group.id}`} className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#DCE3EC] bg-[#F8FAFC] px-3 py-2.5 text-xs"><input type="checkbox" checked={checked} disabled={!ids.length} onChange={() => toggleRepertorioGroup(group)} className="h-4 w-4 accent-[#0D47A1]"/><span className="min-w-0 flex-1 font-black text-[#0D47A1]">{group.title || 'Marcador'} <span className="font-normal text-slate-500">· {allIds.length} músicas</span></span>{alreadyCount>0&&<span className="shrink-0 text-[9px] font-bold text-slate-500">{alreadyCount} já no bloco</span>}</label>;
                                        }
                                        const song = row.song;
                                        const alreadyInDestination = selectedBlockSongs.includes(song.id || '');
                                        const isSelected = (selectedSongsByBlock[addingSongsToBlock] || []).includes(song.id || '');
                                        const assignedRepertorioKey = activeRepertorioSource?.songKeys?.[song.id] || '';
                                        const displayedKey = assignedRepertorioKey || song.key || '';
                                        return <label key={`rep-song-${song.id}-${rowIndex}`} className={`ml-5 flex ${alreadyInDestination ? 'cursor-not-allowed border-[#CBD5E1] bg-slate-100/80' : 'cursor-pointer border-transparent hover:bg-[#F7F9FC]'} items-center gap-3 rounded-lg border px-3 py-2.5 text-xs transition-colors ${isSelected ? 'border-[#0D47A1]/40 bg-[#EEF3FA]' : ''}`}>
                                            <input type="checkbox" checked={alreadyInDestination || isSelected} disabled={alreadyInDestination} onChange={() => toggleModalSong(song)} className="h-4 w-4 accent-[#0D47A1]"/>
                                            <span className="min-w-0 flex-1"><span className="block truncate font-bold text-slate-800">{song.title}{displayedKey ? <span className="ml-1 font-semibold text-slate-500">({displayedKey})</span> : null}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500">{song.artist || 'Intérprete não informado'}</span></span>
                                            {alreadyInDestination && <span className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-wide text-slate-500">Já está no bloco</span>}
                                        </label>;
                                    })}
                                    {addModalTab === 'blocks' && selectedBlockSourceSuggestions.map((item:any) => <button key={item.id || item.name} type="button" onClick={() => addBlockSuggestion(item)} className="flex w-full items-center gap-3 rounded-lg border border-[#DCE3EC] px-3 py-2.5 text-left text-xs hover:bg-[#F7F9FC]"><span className="flex-1"><span className="block font-bold text-slate-800">{item.name || 'Bloco'}</span><span className="text-[10px] text-slate-500">{(item.songIds || []).length} músicas</span></span><Plus size={14} className="text-[#0D47A1]"/></button>)}
                                    {addModalTab === 'songs' && visibleModalSongs.map((song:any) => {
                                        const alreadyInDestination = selectedBlockSongs.includes(song.id || '');
                                        const isSelected = (selectedSongsByBlock[addingSongsToBlock] || []).includes(song.id || '');
                                        const assignedRepertorioKey = activeRepertorioSource?.songKeys?.[song.id] || '';
                                        const vocalistKey = activeVocalistSource?.songKeys?.[song.id] || '';
                                        const displayedKey = activeRepertorioSource ? (assignedRepertorioKey || song.key || '') : (vocalistKey || song.key || '');
                                        return <label key={song.id} className={`flex ${alreadyInDestination ? 'cursor-not-allowed border-[#CBD5E1] bg-slate-100/80' : 'cursor-pointer border-transparent hover:bg-[#F7F9FC]'} items-center gap-3 rounded-lg border px-3 py-2.5 text-xs transition-colors ${isSelected ? 'border-[#0D47A1]/40 bg-[#EEF3FA]' : ''}`}>
                                            <input type="checkbox" checked={alreadyInDestination || isSelected} disabled={alreadyInDestination} onChange={() => toggleModalSong(song)} className="h-4 w-4 accent-[#0D47A1]"/>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate font-bold text-slate-800">{song.title}{displayedKey ? <span className="ml-1 font-semibold text-slate-500">({displayedKey})</span> : null}</span>
                                                <span className="mt-0.5 block truncate text-[10px] text-slate-500">{song.artist || 'Intérprete não informado'}</span>
                                            </span>
                                            {alreadyInDestination && <span className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-wide text-slate-500">Já está no bloco</span>}
                                            {!alreadyInDestination && !activeRepertorioSource && vocalistKey && <span className="shrink-0 rounded-md bg-[#0D47A1]/10 px-2 py-1 text-[10px] font-black text-[#0D47A1]">{vocalistKey}</span>}
                                        </label>;
                                    })}
                                    {addModalTab !== 'blocks' && (addModalTab === 'repertorio' ? visibleRepertorioRows.length === 0 : visibleModalSongs.length === 0) && <p className="px-3 py-8 text-center text-xs text-slate-400">Nenhuma música disponível nesta seleção.</p>}
                                </div>
                            </section>
                        </div>

                        <div className="flex items-center justify-between gap-3 border-t border-[#DCE3EC] bg-[#F8FAFC] px-4 py-3 sm:px-5">
                            <span className="text-[11px] font-semibold text-slate-500">{(selectedSongsByBlock[addingSongsToBlock] || []).length} selecionada(s)</span>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setAddingSongsToBlock(null)} className="rounded-lg border border-[#DCE3EC] bg-white px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
                                <button type="button" disabled={!(selectedSongsByBlock[addingSongsToBlock] || []).length} onClick={() => addSongsToGroup(addingSongsToBlock)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D47A1] px-4 py-2 text-[11px] font-bold text-white hover:bg-[#123D87] disabled:cursor-not-allowed disabled:opacity-40">
                                    <Plus size={13}/> Adicionar selecionadas
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

import { Sparkles } from 'lucide-react';
