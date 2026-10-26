import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Save, X, Brain, Music, Sparkles, ChevronRight, Hash } from 'lucide-react';
import { Song, SongBlock } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

interface SongBlockFormProps {
  songs: Song[];
  user: any;
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

export function SongBlockForm({ songs, user, onSave, onCancel }: SongBlockFormProps) {
  const [title, setTitle] = useState('');
  const [totalSongs, setTotalSongs] = useState(12);
  const [profile, setProfile] = useState('Aleatório');
  const [maxPerBlock, setMaxPerBlock] = useState(3);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState('');

  const toggleFilter = (filterId: string) => {
    setSelectedFilters(prev => 
      prev.includes(filterId) 
        ? prev.filter(f => f !== filterId) 
        : [...prev, filterId]
    );
  };

  const generateBlocks = async () => {
    if (!title) {
        alert("Por favor, defina um título para este conjunto de blocos.");
        return;
    }
    
    setIsGenerating(true);
    setStatus('Analisando seu acervo...');

    try {
      const apiKey = 
        localStorage.getItem('GEMINI_API_KEY') || 
        (process.env as any).GEMINI_API_KEY || 
        (process.env as any).API_KEY;

      if (!apiKey) {
        setIsGenerating(false);
        setStatus('');
        if (window.confirm("Chave API do Gemini não configurada. Deseja configurar agora nas definições de IA?")) {
            // Emitting this intent isn't easy here, so we just show a clearer alert.
            alert("Por favor, vá em Ajustes -> IA e configure sua chave da API para usar esta função.");
        }
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const songsData = songs.map(s => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        key: s.key,
        tempo: s.tempo,
        category: s.category
      }));

      const systemInstruction = `Você é um produtor musical especialista em criar roteiros de shows e setlists.
Sua tarefa é organizar as músicas fornecidas em pequenos "blocos" seguidos, otimizando a fluidez do show.
Critérios:
- Perfil do setlist: ${profile}
- Máximo de músicas por bloco: ${maxPerBlock}
- Foco dos agrupamentos (filtros): ${selectedFilters.length > 0 ? selectedFilters.join(', ') : 'Mistura livre'}
- Total de músicas no setlist final: ${totalSongs}

Nota sobre filtros:
- Tom/Key: Tente manter músicas do mesmo bloco no mesmo tom ou tons próximos.
- Tons Relativos: Ex: C (maior) para Am (menor).
- Tons Vizinhos: Tons com apenas um sustenido/bemol de diferença no ciclo de quintas.

Retorne APENAS um objeto JSON seguindo este esquema:
{
  "suggestions": [
    {
      "name": "Nome descritivo do bloco (ex: Bloco Romântico em Dó)",
      "songIds": ["id1", "id2", "id3"],
      "reason": "Explicação curta do porquê estas músicas funcionam juntas"
    }
  ]
}`;

      setStatus('Gerando sugestões com IA...');

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Aqui estão as músicas do acervo: ${JSON.stringify(songsData)}. 
        Por favor, gere os blocos de acordo com as instruções do sistema.`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    songIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                    reason: { type: Type.STRING }
                  },
                  required: ["name", "songIds"]
                }
              }
            },
            required: ["suggestions"]
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      
      if (result.suggestions) {
        const newBlock: SongBlock = {
          title,
          totalSongs,
          profile,
          maxPerBlock,
          filters: selectedFilters,
          suggestions: result.suggestions,
          createdBy: user.uid,
          createdAt: new Date().toISOString()
        };
        onSave(newBlock);
      }
    } catch (error) {
      console.error('Erro ao gerar blocos:', error);
      alert('Ocorreu um erro ao gerar os blocos. Verifique os logs.');
    } finally {
      setIsGenerating(false);
      setStatus('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-text-main mb-1">Novo Bloco por IA</h2>
          <p className="text-text-dim text-sm italic">Defina os parâmetros e deixe a IA sugerir os melhores agrupamentos.</p>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-surface rounded-full text-text-dim transition-colors">
          <X size={24} />
        </button>
      </div>

      <div className="space-y-12">
        {/* Step 1 */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm">1</span>
            <h3 className="text-xl font-bold text-text-main tracking-tight">Definir Perfil do Setlist</h3>
          </div>
          
          <div className="bg-surface border border-border rounded-2xl p-6 lg:p-8 shadow-xl space-y-8">
             <div>
                <label className="text-text-dim text-xs font-bold uppercase tracking-wider mb-2 block">Título da Sugestão</label>
                <input 
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-bg border border-border rounded-xl h-14 px-5 text-text-main font-bold text-lg focus:ring-2 focus:ring-primary/50 outline-none transition-all placeholder:text-text-dim/50"
                  placeholder="Ex: Show Acústico Barzinho"
                />
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-text-dim text-xs font-bold uppercase tracking-wider block">Total de Músicas</label>
                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim" size={18} />
                    <input 
                      type="number"
                      value={totalSongs}
                      onChange={e => setTotalSongs(Number(e.target.value))}
                      className="w-full bg-bg border border-border rounded-xl h-12 pl-12 pr-5 text-text-main font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-text-dim text-xs font-bold uppercase tracking-wider block">Perfil do Setlist</label>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {PERFIS.map(p => (
                      <button
                        key={p}
                        onClick={() => setProfile(p)}
                        className={`py-3 px-2 rounded-xl text-xs font-bold transition-all border ${
                          profile === p 
                            ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-105' 
                            : 'bg-bg border-border text-text-dim hover:border-primary/50'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
             </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm">2</span>
            <h3 className="text-xl font-bold text-text-main tracking-tight">Definir Perfil dos Blocos</h3>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-6 lg:p-8 shadow-xl space-y-8">
            <div className="space-y-3">
              <label className="text-text-dim text-xs font-bold uppercase tracking-wider block">Máximo de Músicas por Bloco</label>
              <input 
                type="number"
                value={maxPerBlock}
                onChange={e => setMaxPerBlock(Number(e.target.value))}
                className="w-full bg-bg border border-border rounded-xl h-12 px-5 text-text-main font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all"
              />
            </div>

            <div className="space-y-3">
              <label className="text-text-dim text-xs font-bold uppercase tracking-wider block">Agrupar por (filtros):</label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                {FILTROS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => toggleFilter(f.id)}
                    className={`py-3 px-2 rounded-xl text-[10px] font-bold transition-all border ${
                      selectedFilters.includes(f.id)
                        ? 'bg-primary/10 border-primary text-primary' 
                        : 'bg-bg border-border text-text-dim hover:border-primary/50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={generateBlocks}
              disabled={isGenerating || songs.length === 0}
              className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 transition-all shadow-xl ${
                isGenerating 
                  ? 'bg-surface text-text-dim cursor-not-allowed border border-border' 
                  : 'bg-green-600 hover:bg-green-500 text-white hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <span className="text-text-main">{status}</span>
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  Gerar Blocos por IA
                </>
              )}
            </button>
            {songs.length === 0 && (
                <p className="text-center text-red-500 text-xs font-bold uppercase tracking-tighter">
                  Você precisa ter músicas cadastradas para gerar blocos.
                </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
