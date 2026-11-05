import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Save, X, Brain, Music, Sparkles, Hash, Search, Plus, Check } from 'lucide-react';
import { Song, SongBlock } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

interface SongBlockFormProps {
  songs: Song[];
  user: any;
  folderId?: string;
  onSave: (block: SongBlock) => void;
  onCancel: () => void;
}

const PERFIS = ['Aleatório', 'Clássico', 'Urbano', 'Raiz'];
const FILTROS = [
  { id: 'key', label: 'Tom' },
  { id: 'tempo', label: 'Andamento' },
  { id: 'category', label: 'Categoria' },
  { id: 'artist', label: 'Artista' },
  { id: 'relativeKeys', label: 'Tons Relativos' },
  { id: 'neighborKeys', label: 'Tons Vizinhos' }
];

export function SongBlockForm({ songs, user, folderId, onSave, onCancel }: SongBlockFormProps) {
  const [mode, setMode] = useState<'manual' | 'ia'>('manual');
  const [title, setTitle] = useState('');
  const [manualSearch, setManualSearch] = useState('');
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [totalSongs, setTotalSongs] = useState(12);
  const [profile, setProfile] = useState('Aleatório');
  const [maxPerBlock, setMaxPerBlock] = useState(3);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState('');

  const filteredSongs = useMemo(() => {
    const term = manualSearch.trim().toLocaleLowerCase('pt-BR');
    if (!term) return songs;
    return songs.filter(song => `${song.title} ${song.artist} ${song.category || ''}`.toLocaleLowerCase('pt-BR').includes(term));
  }, [songs, manualSearch]);

  const toggleSong = (id?: string) => {
    if (!id) return;
    setSelectedSongIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const saveManualBlock = () => {
    if (!title.trim()) return alert('Informe um nome para o bloco.');
    if (selectedSongIds.length === 0) return alert('Selecione ao menos uma música para o bloco.');
    onSave({
      title: title.trim(),
      folderId,
      totalSongs: selectedSongIds.length,
      profile: 'Manual',
      maxPerBlock: selectedSongIds.length,
      filters: [],
      suggestions: [{
        name: title.trim(),
        songIds: selectedSongIds,
        reason: 'Bloco organizado manualmente pelo usuário.'
      }],
      createdBy: user?.uid || '',
      createdAt: new Date().toISOString()
    } as SongBlock);
  };

  const toggleFilter = (filterId: string) => {
    setSelectedFilters(prev => prev.includes(filterId) ? prev.filter(f => f !== filterId) : [...prev, filterId]);
  };

  const generateBlocks = async () => {
    if (!title.trim()) return alert('Por favor, defina um título para este conjunto de blocos.');
    setIsGenerating(true);
    setStatus('Analisando seu acervo...');
    try {
      const apiKey = localStorage.getItem('GEMINI_API_KEY') || (process.env as any).GEMINI_API_KEY || (process.env as any).API_KEY;
      if (!apiKey) {
        setIsGenerating(false);
        setStatus('');
        if (window.confirm('Chave API do Gemini não configurada. Deseja configurar agora nas definições de IA?')) alert('Por favor, vá em Ajustes -> IA e configure sua chave da API para usar esta função.');
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      const songsData = songs.map(s => ({ id: s.id, title: s.title, artist: s.artist, key: s.key, tempo: s.tempo, category: s.category }));
      const systemInstruction = `Você é um produtor musical especialista em criar roteiros de shows e setlists.\nSua tarefa é organizar as músicas fornecidas em pequenos blocos seguidos, otimizando a fluidez do show.\nCritérios:\n- Perfil do setlist: ${profile}\n- Máximo de músicas por bloco: ${maxPerBlock}\n- Foco dos agrupamentos (filtros): ${selectedFilters.length > 0 ? selectedFilters.join(', ') : 'Mistura livre'}\n- Total de músicas no setlist final: ${totalSongs}\n\nNota sobre filtros:\n- Tom/Key: Tente manter músicas do mesmo bloco no mesmo tom ou tons próximos.\n- Tons Relativos: Ex: C (maior) para Am (menor).\n- Tons Vizinhos: Tons com apenas um sustenido/bemol de diferença no ciclo de quintas.\n\nRetorne APENAS um objeto JSON seguindo este esquema: {"suggestions":[{"name":"Nome descritivo do bloco","songIds":["id1","id2"],"reason":"Explicação curta"}]}`;
      setStatus('Gerando sugestões com IA...');
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Aqui estão as músicas do acervo: ${JSON.stringify(songsData)}. Gere os blocos conforme as instruções.`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: { suggestions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, songIds: { type: Type.ARRAY, items: { type: Type.STRING } }, reason: { type: Type.STRING } }, required: ['name', 'songIds'] } } },
            required: ['suggestions']
          }
        }
      });
      const result = JSON.parse(response.text || '{}');
      if (Array.isArray(result.suggestions) && result.suggestions.length) {
        onSave({ title: title.trim(), folderId, totalSongs, maxPerBlock, filters: selectedFilters, suggestions: result.suggestions, createdBy: user?.uid || '', createdAt: new Date().toISOString() } as SongBlock);
      } else alert('A IA não retornou blocos. Ajuste os parâmetros e tente novamente.');
    } catch (error) {
      console.error('Erro ao gerar blocos:', error);
      alert('Ocorreu um erro ao gerar os blocos. Verifique os logs.');
    } finally {
      setIsGenerating(false);
      setStatus('');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="relative flex items-center justify-center min-h-14">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-text-main mb-1">Novo Bloco</h2>
          <p className="text-text-dim text-sm">Monte manualmente ou peça sugestões à inteligência artificial.</p>
        </div>
        <button onClick={onCancel} className="absolute right-0 top-1/2 -translate-y-1/2 p-2 hover:bg-surface rounded-full text-text-dim transition-colors" title="Fechar"><X size={22} /></button>
      </div>

      <div className="flex justify-center">
        <div className="inline-flex p-1 rounded-xl bg-surface border border-border shadow-sm">
          <button onClick={() => setMode('manual')} className={`px-8 py-3 rounded-lg text-sm font-black transition-all ${mode === 'manual' ? 'bg-primary text-white shadow' : 'text-text-dim hover:text-primary'}`}><Music size={16} className="inline mr-2" />Manual</button>
          <button onClick={() => setMode('ia')} className={`px-8 py-3 rounded-lg text-sm font-black transition-all ${mode === 'ia' ? 'bg-primary text-white shadow' : 'text-text-dim hover:text-primary'}`}><Brain size={16} className="inline mr-2" />Modo IA</button>
        </div>
      </div>

      {mode === 'manual' ? (
        <div className="bg-white border border-border rounded-2xl p-6 lg:p-8 shadow-xl space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-primary uppercase tracking-wider">Nome do bloco</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Abertura, Bloco romântico..." className="w-full bg-white border border-border rounded-xl h-12 px-4 text-text-main font-bold outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div><h3 className="font-bold text-primary">Adicionar músicas</h3><p className="text-xs text-text-dim">Selecione e organize as músicas na ordem desejada.</p></div>
            <div className="relative w-full sm:max-w-xs"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" /><input value={manualSearch} onChange={e => setManualSearch(e.target.value)} placeholder="Buscar música ou artista..." className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-white text-sm outline-none focus:border-primary" /></div>
          </div>
          <div className="max-h-[48vh] overflow-y-auto border border-border rounded-xl divide-y divide-border">
            {filteredSongs.map(song => {
              const checked = !!song.id && selectedSongIds.includes(song.id);
              return <button type="button" key={song.id} onClick={() => toggleSong(song.id)} className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${checked ? 'bg-primary/10' : 'bg-white hover:bg-slate-50'}`}>
                <span className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary text-white' : 'border-slate-300 text-transparent'}`}><Check size={15} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-primary truncate">{song.title}</span><span className="block text-[11px] text-text-dim truncate">{song.artist || 'Artista não informado'} · {song.key || 'Tom não informado'} · {song.tempo || 'Andamento não informado'}</span></span>
                {checked && <span className="text-[10px] font-black text-primary">{selectedSongIds.indexOf(song.id!) + 1}</span>}
              </button>;
            })}
            {filteredSongs.length === 0 && <div className="p-8 text-center text-sm text-text-dim">Nenhuma música encontrada.</div>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="text-xs font-bold text-primary">{selectedSongIds.length} música(s) selecionada(s)</span>
            <div className="flex gap-3"><button onClick={onCancel} className="px-5 py-3 rounded-xl border border-border text-text-dim font-bold text-sm">Cancelar</button><button onClick={saveManualBlock} disabled={!title.trim() || selectedSongIds.length === 0} className="px-6 py-3 rounded-xl bg-primary text-white font-black text-sm disabled:opacity-40 flex items-center gap-2"><Save size={16} /> Salvar bloco</button></div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="space-y-6">
            <div className="flex items-center gap-3"><span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm">1</span><h3 className="text-xl font-bold text-text-main tracking-tight">Definir Perfil do Setlist</h3></div>
            <div className="bg-surface border border-border rounded-2xl p-6 lg:p-8 shadow-xl space-y-8">
              <div><label className="text-text-dim text-xs font-bold uppercase tracking-wider mb-2 block">Título da Sugestão</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-bg border border-border rounded-xl h-14 px-5 text-text-main font-bold text-lg outline-none focus:ring-2 focus:ring-primary/50" placeholder="Ex: Show Acústico Barzinho" /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3"><label className="text-text-dim text-xs font-bold uppercase tracking-wider block">Total de Músicas</label><div className="relative"><Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim" size={18} /><input type="number" min={1} value={totalSongs} onChange={e => setTotalSongs(Math.max(1, Number(e.target.value)))} className="w-full bg-bg border border-border rounded-xl h-12 pl-12 pr-5 text-text-main font-bold outline-none" /></div></div>
                <div className="space-y-3"><label className="text-text-dim text-xs font-bold uppercase tracking-wider block">Perfil do Setlist</label><div className="grid grid-cols-2 lg:grid-cols-4 gap-2">{PERFIS.map(p => <button key={p} onClick={() => setProfile(p)} className={`py-3 px-2 rounded-xl text-xs font-bold border ${profile === p ? 'bg-primary border-primary text-white shadow-lg' : 'bg-bg border-border text-text-dim hover:border-primary/50'}`}>{p}</button>)}</div></div>
              </div>
            </div>
          </div>
          <div className="space-y-6"><div className="flex items-center gap-3"><span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm">2</span><h3 className="text-xl font-bold text-text-main tracking-tight">Definir Perfil dos Blocos</h3></div>
            <div className="bg-surface border border-border rounded-2xl p-6 lg:p-8 shadow-xl space-y-8">
              <div className="space-y-3"><label className="text-text-dim text-xs font-bold uppercase tracking-wider block">Máximo de Músicas por Bloco</label><input type="number" min={1} value={maxPerBlock} onChange={e => setMaxPerBlock(Math.max(1, Number(e.target.value)))} className="w-full bg-bg border border-border rounded-xl h-12 px-5 text-text-main font-bold outline-none" /></div>
              <div className="space-y-3"><label className="text-text-dim text-xs font-bold uppercase tracking-wider block">Agrupar por (filtros):</label><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">{FILTROS.map(f => <button key={f.id} onClick={() => toggleFilter(f.id)} className={`py-3 px-2 rounded-xl text-[10px] font-bold border ${selectedFilters.includes(f.id) ? 'bg-primary/10 border-primary text-primary' : 'bg-bg border-border text-text-dim hover:border-primary/50'}`}>{f.label}</button>)}</div></div>
              <button onClick={generateBlocks} disabled={isGenerating || songs.length === 0 || !title.trim()} className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 transition-all shadow-xl ${isGenerating ? 'bg-surface text-text-dim cursor-not-allowed border border-border' : 'bg-green-600 hover:bg-green-500 text-white disabled:opacity-40'}`}>{isGenerating ? <><div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /><span className="text-text-main">{status}</span></> : <><Sparkles size={20} />Gerar Blocos por IA</>}</button>
              {songs.length === 0 && <p className="text-center text-red-500 text-xs font-bold">Você precisa ter músicas cadastradas para gerar blocos.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
