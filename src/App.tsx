/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  auth, db, googleProvider, googleProvider as provider, 
  handleFirestoreError, OperationType 
} from './firebase';
import { 
  signInWithPopup, signOut, onAuthStateChanged, User 
} from 'firebase/auth';
import { 
  collection, doc, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc, 
  query, orderBy, serverTimestamp, where, runTransaction 
} from 'firebase/firestore';
import { Song, Session, Category, LabelShortcut, ChordBank, SongBlock, Folder, AppUser } from './types';
import { ChordProRenderer } from './components/ChordProRenderer';
import { ChordBankManager } from './components/ChordBankManager';
import { ChordSelectModal } from './components/ChordSelectModal';
import { SongBlockForm } from './components/SongBlockForm';
import { SongBlockList, SongBlockDetails } from './components/SongBlockList';
import { INITIAL_CHORD_BANKS } from './lib/chordBanks';
import { 
  smartUppercase, detectKey, getSemitones, transposeChordPro 
} from './lib/songUtils';
import { convertPDFToImages, PDFQuality } from './lib/pdfUtils';
import JSZip from 'jszip';
import { 
  Music, Edit2, Trash2, LogIn, LogOut, Mic, User as UserIcon, Speaker,
  ChevronLeft, ChevronRight, ChevronUp, Play, Users, Save, X, Search, Minus, Type, Filter,
  ArrowUp, ArrowDown, Radio, Menu, MoreVertical, PanelLeft, Layout, Settings, ListMusic, Sun, Moon, Archive, Library,
  Share2, CheckSquare, Square, GripVertical, ArrowLeft, Download, Upload, FilePlus, Boxes, Brain, FileText, Check, Plus,
  Folder as FolderIcon, FolderPlus, Hash, Info, Gamepad, LayoutList, Mic2, Music2, FolderOpen, ChevronDown, ArrowUpDown, Tag, Hourglass, RotateCcw, RotateCw, Smile, PlusCircle, FileUp, Eraser, Eye
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { jsPDF } from 'jspdf';

// Normaliza termos para a busca: ignora acentos e diferenças entre maiúsculas/minúsculas.
const normalizeSearchText = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');

function GroupPageView({ group, songs, allIds, repertorio }: { 
  group: any, 
  songs: Song[], 
  allIds: string[],
  repertorio: any
}) {
  const groupIndexInRepertorio = allIds.indexOf(`group:${group.id}`);
  
  // Encontrar o número do bloco baseado na ordem real no repertório (contando apenas marcadores válidos)
  const blockNumber = useMemo(() => {
    if (groupIndexInRepertorio === -1) return 0;
    let count = 0;
    const groups = repertorio?.songGroups || [];
    for (let i = 0; i <= groupIndexInRepertorio; i++) {
      if (allIds[i].startsWith('group:')) {
        const gid = allIds[i].split(':')[1];
        // Apenas conta se o grupo realmente existir no banco para este repertório
        if (groups.find((g: any) => g.id === gid)) {
          count++;
        }
      }
    }
    return count;
  }, [groupIndexInRepertorio, allIds, repertorio?.songGroups]);

  const groupSongs = useMemo(() => {
    if (groupIndexInRepertorio === -1) return [];
    const collected = [];
    for (let i = groupIndexInRepertorio + 1; i < allIds.length; i++) {
      const id = allIds[i];
      if (id.startsWith('group:')) break;
      const song = songs.find(s => s.id === id);
      if (song) collected.push(song);
    }
    return collected;
  }, [groupIndexInRepertorio, allIds, songs]);

  // Limpar o título para evitar duplicar números se já estiverem presentes
  const cleanTitle = useMemo(() => {
    const rawTitle = group.title || 'Marcador de Bloco';
    // Se o título já começa com um número e ponto (ex: "1. Título"), removemos para a exibição padronizada
    // ou deixamos como está se preferir. Aqui vamos garantir que o prefixo "N. " venha da lógica
    return rawTitle.replace(/^\d+[\.\-\s:]+/, '').trim();
  }, [group.title]);

  return (
    <div className="flex flex-col h-full bg-surface/30 backdrop-blur-sm rounded-3xl border border-border/50 overflow-y-auto">
      <div className="p-6 md:p-10 space-y-6">
        <div className="space-y-1 text-center md:text-left border-b border-border/30 pb-6">
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-primary">
            {blockNumber > 0 ? `${blockNumber}. ` : ''}{cleanTitle}
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-text-dim opacity-70">
            Visualização do Bloco
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {groupSongs.length > 0 ? (
            groupSongs.map((song, idx) => (
              <motion.div
                key={song.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.03 }}
                className="relative bg-white/50 border border-border/50 rounded-xl p-3 flex items-center gap-3 overflow-hidden"
              >
                <div className="w-8 h-8 rounded-full bg-primary/5 text-primary/40 flex items-center justify-center font-black text-sm shrink-0 border border-primary/10">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm uppercase tracking-tight truncate leading-tight text-text">
                    {song.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[8px] font-black px-1.5 py-0.5 bg-primary/10 rounded text-primary">
                      {(repertorio?.songKeys && song.id && repertorio.songKeys[song.id]) || song.key}
                    </span>
                    <span className="text-[8px] font-bold text-text-dim truncate uppercase tracking-widest">
                      {song.artist}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-primary/5 text-primary/20 rounded-full flex items-center justify-center mx-auto">
                <Music size={32} />
              </div>
              <p className="text-text-dim font-bold uppercase tracking-widest text-sm">Nenhuma música neste bloco</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type View = 'list' | 'details' | 'form' | 'live' | 'repertorios' | 'repertorio-form' | 'settings' | 'blocks' | 'block-form' | 'block-details' | 'user-management';
type SidebarTab = 'songs' | 'repertorios' | 'blocks' | 'settings';
type SettingsTab = 'geral' | 'pedais' | 'backup' | 'sobre' | 'acordes' | 'ia' | 'users';


const SEMBA_LOGO_SRC = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNjA3IDQ4MCIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSIjc2VtYmEiPjxwYXRoIGZpbGw9IiMwMDAwMDAiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTSA4MjkgMTQzIEwgODE4IDE1NCBMIDgxMSAxNjQgTCA4MDYgMTc0IEwgODAyIDE4NiBMIDgwMSAxOTQgTCA4MDAgMTk1IEwgODAwIDIwMiBMIDc5OSAyMDMgTCA3OTkgNDI2IEwgODAwIDQyNyBMIDc5OSA0NDAgTCA4MDAgNDQxIEwgODAxIDQ0OCBMIDgwNiA0NTcgTCA4MTIgNDYzIEwgODIxIDQ2OCBMIDgyNyA0NjkgTCA4MjggNDcwIEwgODQyIDQ3MCBMIDg0MyA0NjkgTCA4NDYgNDY5IEwgODUyIDQ2NyBMIDg1OCA0NjQgTCA4NjQgNDU5IEwgODcxIDQ0NyBMIDg3MSA0NDMgTCA4NzIgNDQyIEwgODcyIDIwNCBMIDg3NSAxOTcgTCA4ODAgMTkxIEwgODg5IDE4NiBMIDg5OCAxODUgTCA4OTkgMTg2IEwgOTAzIDE4NiBMIDkxMiAxOTEgTCA5MTcgMTk3IEwgOTIxIDIwOCBMIDkyMSA0NDYgTCA5MjUgNDU1IEwgOTMyIDQ2MyBMIDk0MSA0NjggTCA5NDcgNDcwIEwgOTY0IDQ3MCBMIDk2NSA0NjkgTCA5NjggNDY5IEwgOTc5IDQ2NCBMIDk4NSA0NTkgTCA5OTAgNDUyIEwgOTkzIDQ0MyBMIDk5MyAzNDMgTCA5OTIgMzQyIEwgOTkyIDMzMiBMIDk5MyAzMzEgTCA5OTMgMjg4IEwgOTkyIDI4NyBMIDk5MiAyODMgTCA5OTMgMjgyIEwgOTkzIDI2OSBMIDk5MiAyNjggTCA5OTIgMjA4IEwgOTkzIDIwNyBMIDk5NCAyMDAgTCAxMDAwIDE5MSBMIDEwMDggMTg2IEwgMTAxOCAxODUgTCAxMDI4IDE4OSBMIDEwMzQgMTk1IEwgMTAzOCAyMDQgTCAxMDM4IDQ0MyBMIDEwMzkgNDQ0IEwgMTAzOSA0NDggTCAxMDQzIDQ1NiBMIDEwNTEgNDY0IEwgMTA2MSA0NjkgTCAxMDY0IDQ2OSBMIDEwNjUgNDcwIEwgMTA4MiA0NzAgTCAxMDgzIDQ2OSBMIDEwODkgNDY4IEwgMTA5NyA0NjQgTCAxMTA2IDQ1NSBMIDExMDkgNDUwIEwgMTExMSA0NDQgTCAxMTExIDIwMSBMIDExMTAgMjAwIEwgMTEwOSAxODggTCAxMTA4IDE4NyBMIDExMDggMTg0IEwgMTEwNSAxNzUgTCAxMDk4IDE2MSBMIDEwOTIgMTUzIEwgMTA4NSAxNDYgTCAxMDc3IDE0MCBMIDEwNjAgMTMxIEwgMTA1MSAxMjggTCAxMDQ0IDEyNyBMIDEwNDMgMTI2IEwgMTAzMiAxMjUgTCAxMDMxIDEyNCBMIDEwMTAgMTI0IEwgMTAwOSAxMjUgTCA5OTkgMTI2IEwgOTg3IDEzMCBMIDk3MSAxMzkgTCA5NjYgMTQzIEwgOTU4IDE1MiBMIDk0NSAxNDEgTCA5MzQgMTM1IEwgOTMyIDEzMyBMIDkzMCAxMzMgTCA5MjUgMTMwIEwgOTE5IDEyOSBMIDkxNSAxMjcgTCA5MDcgMTI2IEwgOTA2IDEyNSBMIDkwMCAxMjUgTCA4OTkgMTI0IEwgODc5IDEyNCBMIDg3OCAxMjUgTCA4NzIgMTI1IEwgODcxIDEyNiBMIDg2NiAxMjYgTCA4NjUgMTI3IEwgODU4IDEyOCBMIDg0MSAxMzUgWiBNIDY3NSAxMjQgTCA2NzQgMTI1IEwgNjYyIDEyNiBMIDY2MSAxMjcgTCA2NTggMTI3IEwgNjU3IDEyOCBMIDY1NCAxMjggTCA2NDUgMTMxIEwgNjMyIDEzNyBMIDYxOCAxNDcgTCA2MDUgMTYxIEwgNTk5IDE3MCBMIDU5MiAxODUgTCA1OTAgMTkxIEwgNTkwIDE5NCBMIDU4OSAxOTUgTCA1ODkgMTk4IEwgNTg4IDE5OSBMIDU4NyAyMTMgTCA1ODYgMjE0IEwgNTg3IDM4NCBMIDU4OCAzODUgTCA1ODggMzkyIEwgNTg5IDM5MyBMIDU5MCA0MDIgTCA1OTQgNDE0IEwgNjAxIDQyOCBMIDYxMSA0NDEgTCA2MjggNDU1IEwgNjQ2IDQ2NCBMIDY1MiA0NjYgTCA2NTUgNDY2IEwgNjY0IDQ2OSBMIDY3MCA0NjkgTCA2NzEgNDcwIEwgNzAwIDQ3MCBMIDcwMSA0NjkgTCA3MDcgNDY5IEwgNzA4IDQ2OCBMIDcxMyA0NjggTCA3MTcgNDY2IEwgNzIwIDQ2NiBMIDcyOSA0NjMgTCA3MzkgNDU4IEwgNzUzIDQ0OSBMIDc2OCA0MzQgTCA3NzUgNDI0IEwgNzgyIDQxMCBMIDc4NiAzOTggTCA3ODcgMzg2IEwgNzg4IDM4NSBMIDc4OCAzNjQgTCA3ODcgMzYzIEwgNzg3IDM1OSBMIDc4MyAzNTEgTCA3NzcgMzQ1IEwgNzY3IDM0MCBMIDczNiAzNDAgTCA3MjcgMzQ0IEwgNzE5IDM1MyBMIDcxOCAzNTkgTCA3MTcgMzYwIEwgNzE3IDM4MCBMIDcxNCAzODkgTCA3MTIgMzkyIEwgNzA2IDM5OCBMIDY5OCA0MDIgTCA2OTUgNDAyIEwgNjk0IDQwMyBMIDY4NSA0MDMgTCA2ODQgNDAyIEwgNjc4IDQwMSBMIDY3MyAzOTggTCA2NjcgMzkyIEwgNjYzIDM4NCBMIDY2MyAzODAgTCA2NjIgMzc5IEwgNjYyIDMzMyBMIDY2NCAzMzEgTCA2NjYgMzMxIEwgNjgwIDMyNCBMIDY4MiAzMjQgTCA2ODcgMzIxIEwgNjk0IDMxOSBMIDcwMyAzMTQgTCA3MTAgMzEyIEwgNzE3IDMwOCBMIDcxOSAzMDggTCA3MjQgMzA1IEwgNzI2IDMwNSBMIDc0MiAyOTcgTCA3NDYgMjk2IEwgNzYxIDI4NiBMIDc3MiAyNzUgTCA3NzggMjY3IEwgNzgzIDI1NyBMIDc4MyAyNTUgTCA3ODUgMjUyIEwgNzg2IDI0NSBMIDc4NyAyNDQgTCA3ODcgMjM4IEwgNzg4IDIzNyBMIDc4OCAyMDUgTCA3ODcgMjA0IEwgNzg3IDE5OCBMIDc4NiAxOTcgTCA3ODUgMTg5IEwgNzc3IDE3MSBMIDc2OCAxNTggTCA3NTQgMTQ1IEwgNzQ1IDEzOSBMIDczMSAxMzIgTCA3MTkgMTI4IEwgNzA2IDEyNiBMIDcwNSAxMjUgTCA2OTkgMTI1IEwgNjk4IDEyNCBaIE0gNzAyIDE4NiBMIDcxMiAxOTUgTCA3MTcgMjA4IEwgNzE3IDIzMyBMIDcxNiAyMzQgTCA3MTUgMjQxIEwgNzExIDI0OCBMIDcwMyAyNTUgTCA2ODIgMjY1IEwgNjgwIDI2NSBMIDY2NSAyNzMgTCA2NjMgMjczIEwgNjYxIDI3MSBMIDY2MiAyNzAgTCA2NjIgMjUxIEwgNjYxIDI1MCBMIDY2MSAyMzQgTCA2NjIgMjMzIEwgNjYyIDIyOSBMIDY2MSAyMjggTCA2NjEgMjE0IEwgNjYyIDIxMyBMIDY2MiAyMDQgTCA2NjcgMTk0IEwgNjcyIDE4OSBMIDY4MiAxODQgTCA2OTYgMTg0IFogTSA0NjYgMTI0IEwgNDY1IDEyNSBMIDQ1OCAxMjUgTCA0NTcgMTI2IEwgNDQ4IDEyNyBMIDQ0MSAxMzAgTCA0MzggMTMwIEwgNDIzIDEzNyBMIDQwNiAxNTAgTCAzOTggMTU5IEwgMzg4IDE3NiBMIDM4OCAxNzggTCAzODUgMTg0IEwgMzg0IDE5MSBMIDM4MyAxOTIgTCAzODIgMjA3IEwgMzgxIDIwOCBMIDM4MiAyMzIgTCAzODMgMjMzIEwgMzgzIDIzNyBMIDM4NCAyMzggTCAzODQgMjQxIEwgMzg2IDI0NyBMIDM5MSAyNTcgTCA0MDEgMjcwIEwgNDEyIDI3OSBMIDQzMyAyOTMgTCA0NDEgMjk3IEwgNDQ2IDMwMSBMIDQ0OSAzMDIgTCA0ODYgMzI1IEwgNDk5IDMzNiBMIDUwMyAzNDEgTCA1MDcgMzQ5IEwgNTA4IDM1NiBMIDUwOSAzNTcgTCA1MDkgMzc4IEwgNTA4IDM3OSBMIDUwOCAzODMgTCA1MDQgMzkxIEwgNDk4IDM5NyBMIDQ5MSA0MDEgTCA0ODQgNDAyIEwgNDgzIDQwMyBMIDQ3NSA0MDMgTCA0NzQgNDAyIEwgNDY4IDQwMSBMIDQ2MiAzOTggTCA0NTUgMzkxIEwgNDUyIDM4NiBMIDQ1MSAzODAgTCA0NTAgMzc5IEwgNDUwIDM1NCBMIDQ0NiAzNDQgTCA0NDIgMzM5IEwgNDM4IDMzNiBMIDQyOCAzMzIgTCAzOTQgMzMyIEwgMzgzIDMzNyBMIDM3MyAzNDggTCAzNzMgMzUwIEwgMzcxIDM1MyBMIDM3MSAzNTcgTCAzNzAgMzU4IEwgMzcwIDM4NCBMIDM3MSAzODUgTCAzNzEgMzkzIEwgMzcyIDM5NCBMIDM3MyA0MDIgTCAzNzYgNDExIEwgMzgzIDQyNSBMIDM5MiA0MzcgTCA0MDQgNDQ4IEwgNDEzIDQ1NCBMIDQyNyA0NjEgTCA0MjkgNDYxIEwgNDM4IDQ2NSBMIDQ0MSA0NjUgTCA0NTAgNDY4IEwgNDU1IDQ2OCBMIDQ1NiA0NjkgTCA0NjMgNDY5IEwgNDY0IDQ3MCBMIDQ4NiA0NzAgTCA0ODcgNDY5IEwgNDkzIDQ2OSBMIDQ5NCA0NjggTCA1MDcgNDY2IEwgNTI2IDQ1OCBMIDU0MSA0NDggTCA1NTcgNDMxIEwgNTY3IDQxMyBMIDU3MiAzOTggTCA1NzMgMzkxIEwgNTc0IDM5MCBMIDU3NCAzODQgTCA1NzUgMzgzIEwgNTc1IDM0NCBMIDU3NCAzNDMgTCA1NzQgMzM4IEwgNTczIDMzNyBMIDU3MiAzMzAgTCA1NjUgMzE0IEwgNTU4IDMwNCBMIDU0MyAyODkgTCA1MjIgMjc0IEwgNTE5IDI3MyBMIDUxNCAyNjkgTCA1MTEgMjY4IEwgNTA2IDI2NCBMIDUwMyAyNjMgTCA0OTggMjU5IEwgNDk1IDI1OCBMIDQ5MCAyNTQgTCA0NzEgMjQzIEwgNDYxIDIzNCBMIDQ1NyAyMjggTCA0NTUgMjIyIEwgNDU1IDIxOCBMIDQ1NCAyMTcgTCA0NTQgMjA2IEwgNDU1IDIwNSBMIDQ1NSAyMDEgTCA0NTggMTk0IEwgNDY2IDE4NiBMIDQ3MiAxODMgTCA0ODcgMTgzIEwgNDk3IDE4OCBMIDUwMyAxOTUgTCA1MDUgMjAwIEwgNTA1IDIwNSBMIDUwNiAyMDYgTCA1MDYgMjE3IEwgNTA3IDIyMCBMIDUxNSAyMjkgTCA1MjEgMjMyIEwgNTU4IDIzMiBMIDU2OCAyMjYgTCA1NzEgMjIyIEwgNTc1IDIxMCBMIDU3NSAxOTggTCA1NzQgMTk3IEwgNTczIDE4NSBMIDU2NiAxNjcgTCA1NTYgMTUzIEwgNTQ2IDE0NCBMIDUyOSAxMzQgTCA1MjcgMTM0IEwgNTI0IDEzMiBMIDUxNSAxMjkgTCA1MTIgMTI5IEwgNTAzIDEyNiBMIDQ5MiAxMjUgTCA0OTEgMTI0IFogTSAxNDMzIDEzMCBMIDE0MTYgMTM4IEwgMTQwMCAxNDkgTCAxMzkwIDE1OSBMIDEzODIgMTcwIEwgMTM3NiAxODIgTCAxMzcyIDE5NCBMIDEzNzEgMjAyIEwgMTM3MCAyMDMgTCAxMzcwIDIxOSBMIDEzNzUgMjI5IEwgMTM4MiAyMzUgTCAxMzkxIDIzOCBMIDE0MDAgMjM4IEwgMTQwMSAyMzcgTCAxNDI0IDIzNyBMIDE0MzIgMjMzIEwgMTQzOCAyMjcgTCAxNDQyIDIxOSBMIDE0NDIgMjEzIEwgMTQ0MyAyMTIgTCAxNDQ0IDIwNCBMIDE0NDggMTk3IEwgMTQ1NiAxODkgTCAxNDYzIDE4NSBMIDE0NjkgMTgzIEwgMTQ4NSAxODMgTCAxNDkxIDE4NSBMIDE0OTkgMTkwIEwgMTUwNyAxOTkgTCAxNTExIDIwOSBMIDE1MTIgMjMzIEwgMTUwNyAyMzcgTCAxNTA1IDIzNyBMIDE1MDIgMjM5IEwgMTQ5MiAyNDIgTCAxNDg0IDI0NiBMIDE0NzkgMjQ3IEwgMTQ3NiAyNDkgTCAxNDcxIDI1MCBMIDE0NjggMjUyIEwgMTQ2MyAyNTMgTCAxNDU1IDI1NyBMIDE0NDUgMjYwIEwgMTQxMyAyNzUgTCAxMzk4IDI4NSBMIDEzOTIgMjkxIEwgMTM5MSAyOTEgTCAxMzgyIDMwMSBMIDEzNzcgMzA4IEwgMTM3MCAzMjEgTCAxMzY5IDMyNiBMIDEzNjYgMzMyIEwgMTM2NiAzMzUgTCAxMzYzIDM0NCBMIDEzNjMgMzUxIEwgMTM2MiAzNTIgTCAxMzYyIDM4NCBMIDEzNjMgMzg1IEwgMTM2MyAzOTMgTCAxMzY1IDM5OCBMIDEzNjUgNDAyIEwgMTM2NiA0MDMgTCAxMzY2IDQwNiBMIDEzNjkgNDE1IEwgMTM3NCA0MjYgTCAxMzgxIDQzNyBMIDEzOTUgNDUxIEwgMTQwOCA0NjAgTCAxNDE0IDQ2MyBMIDE0MzIgNDY5IEwgMTQzNiA0NjkgTCAxNDQyIDQ3MSBMIDE0NTAgNDcxIEwgMTQ1MSA0NzIgTCAxNDcwIDQ3MSBMIDE0NzEgNDcwIEwgMTQ3OCA0NjkgTCAxNDg3IDQ2NiBMIDE0OTUgNDYyIEwgMTUwNyA0NTMgTCAxNTE0IDQ0NSBMIDE1MTYgNDQ2IEwgMTUxOSA0NTIgTCAxNTI0IDQ1NyBMIDE1MzEgNDYxIEwgMTUzNyA0NjMgTCAxNTQxIDQ2MyBMIDE1NDIgNDY0IEwgMTU1MiA0NjQgTCAxNTUzIDQ2MyBMIDE1NjIgNDYyIEwgMTU3NCA0NTYgTCAxNTgzIDQ0NyBMIDE1OTAgNDMzIEwgMTU5MCA0MzAgTCAxNTkzIDQyMSBMIDE1OTMgNDE1IEwgMTU5NCA0MTQgTCAxNTk0IDM1OSBMIDE1OTMgMzU4IEwgMTU5MyAzMDcgTCAxNTkyIDMwNiBMIDE1OTIgMjQ0IEwgMTU5MSAyNDMgTCAxNTkxIDIxMyBMIDE1OTAgMjEyIEwgMTU4OSAxOTkgTCAxNTg4IDE5OCBMIDE1ODggMTk1IEwgMTU4NyAxOTQgTCAxNTg3IDE5MSBMIDE1ODUgMTg1IEwgMTU4MiAxODAgTCAxNTgxIDE3NiBMIDE1NzkgMTc0IEwgMTU3MyAxNjMgTCAxNTU5IDE0OCBMIDE1NDMgMTM3IEwgMTUzNyAxMzUgTCAxNTMwIDEzMSBMIDE1MjQgMTI5IEwgMTUyMSAxMjkgTCAxNTE3IDEyNyBMIDE1MTMgMTI3IEwgMTUxMiAxMjYgTCAxNTA4IDEyNiBMIDE1MDIgMTI0IEwgMTQ5NyAxMjQgTCAxNDk2IDEyMyBMIDE0ODYgMTIzIEwgMTQ4NSAxMjIgTCAxNDYxIDEyMyBMIDE0NjAgMTI0IEwgMTQ1MCAxMjUgTCAxNDQ5IDEyNiBMIDE0NDYgMTI2IEwgMTQ0MiAxMjggTCAxNDM5IDEyOCBaIE0gMTUxMiAyOTQgTCAxNTEzIDI5NSBMIDE1MTMgMzcwIEwgMTUxMiAzNzEgTCAxNTEyIDM3NCBMIDE1MTAgMzgwIEwgMTUwNSAzODkgTCAxNDk3IDM5NyBMIDE0ODkgNDAyIEwgMTQ4MyA0MDMgTCAxNDgyIDQwNCBMIDE0NzYgNDA0IEwgMTQ3NSA0MDUgTCAxNDYzIDQwMyBMIDE0NTQgMzk4IEwgMTQ0OCAzOTIgTCAxNDQzIDM4MiBMIDE0NDMgMzc5IEwgMTQ0MiAzNzggTCAxNDQyIDM3MCBMIDE0NDEgMzY5IEwgMTQ0MSAzNTkgTCAxNDQyIDM1OCBMIDE0NDIgMzUxIEwgMTQ0MyAzNTAgTCAxNDQzIDM0NyBMIDE0NDUgMzQxIEwgMTQ1MCAzMzIgTCAxNDYyIDMyMSBMIDE0NzggMzExIFogTSAxMTUwIDEyIEwgMTEzOCAxOCBMIDExMzEgMjUgTCAxMTI2IDM0IEwgMTEyNiAzNyBMIDExMjUgMzggTCAxMTI1IDI0MiBMIDExMjYgMjQzIEwgMTEyNiAzNDMgTCAxMTI3IDM0NCBMIDExMjcgMzg1IEwgMTEyOCAzODYgTCAxMTI4IDM5MSBMIDExMjkgMzkyIEwgMTEzMCA0MDAgTCAxMTMzIDQwOSBMIDExMzYgNDE0IEwgMTEzNiA0MTYgTCAxMTQ2IDQzMiBMIDExNTIgNDM4IEwgMTE1MiA0MzkgTCAxMTU4IDQ0NSBMIDExNjYgNDUxIEwgMTE4NiA0NjIgTCAxMjA0IDQ2OCBMIDEyMDggNDY4IEwgMTIxNCA0NzAgTCAxMjE5IDQ3MCBMIDEyMjAgNDcxIEwgMTIzMCA0NzEgTCAxMjMxIDQ3MiBMIDEyNTYgNDcxIEwgMTI1NyA0NzAgTCAxMjYzIDQ3MCBMIDEyNjQgNDY5IEwgMTI3MyA0NjggTCAxMjc3IDQ2NiBMIDEyODAgNDY2IEwgMTI4NiA0NjQgTCAxMzAyIDQ1NiBMIDEzMTQgNDQ4IEwgMTMyMSA0NDEgTCAxMzIyIDQ0MSBMIDEzMzEgNDMxIEwgMTMzNyA0MjIgTCAxMzQzIDQxMCBMIDEzNDMgNDA4IEwgMTM0NyAzOTkgTCAxMzQ4IDM5MSBMIDEzNDkgMzkwIEwgMTM0OSAzODUgTCAxMzUwIDM4NCBMIDEzNTAgMzc2IEwgMTM1MSAzNzUgTCAxMzUxIDIxNSBMIDEzNTAgMjE0IEwgMTM1MCAyMDQgTCAxMzQ5IDIwMyBMIDEzNDcgMTkwIEwgMTMzOCAxNjggTCAxMzI5IDE1NSBMIDEzMjEgMTQ3IEwgMTMxMCAxMzkgTCAxMzAzIDEzNiBMIDEyOTkgMTMzIEwgMTI5NyAxMzMgTCAxMjk0IDEzMSBMIDEyODUgMTI4IEwgMTI3NyAxMjcgTCAxMjc2IDEyNiBMIDEyNzEgMTI2IEwgMTI3MCAxMjUgTCAxMjYzIDEyNSBMIDEyNjIgMTI0IEwgMTI0MiAxMjQgTCAxMjQxIDEyNSBMIDEyMzYgMTI1IEwgMTIzNSAxMjYgTCAxMjMxIDEyNiBMIDEyMjcgMTI4IEwgMTIyNCAxMjggTCAxMjIxIDEzMCBMIDEyMTQgMTMyIEwgMTIwMSAxNDAgTCAxMTk4IDE0MyBMIDExOTcgMTQyIEwgMTE5NyAzOSBMIDExOTYgMzggTCAxMTk2IDM0IEwgMTE5MCAyMyBMIDExODUgMTggTCAxMTc4IDE0IEwgMTE3MiAxMiBaIE0gMTIzNSAxODUgTCAxMjQ4IDE4NiBMIDEyNTQgMTg4IEwgMTI2MiAxOTMgTCAxMjY5IDIwMSBMIDEyNzMgMjA5IEwgMTI3NCAyMTcgTCAxMjc1IDIxOCBMIDEyNzUgMzY4IEwgMTI3NCAzNjkgTCAxMjczIDM3NyBMIDEyNjcgMzg4IEwgMTI1NiAzOTggTCAxMjQ1IDQwMiBMIDEyMzIgNDAyIEwgMTIyMyAzOTkgTCAxMjE4IDM5NiBMIDEyMDggMzg1IEwgMTIwMyAzNzAgTCAxMjAyIDIxOSBMIDEyMDMgMjE4IEwgMTIwNCAyMTEgTCAxMjA5IDIwMSBMIDEyMjEgMTkwIFoiLz48cGF0aCBmaWxsPSIjMEQ0N0ExIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0gMzQxIDY1IEwgMzI5IDYwIEwgMzE2IDYwIEwgMzE1IDYxIEwgMzA4IDYyIEwgMzAyIDY1IEwgMjkxIDc1IEwgMjg2IDg0IEwgMjgzIDkzIEwgMjgzIDk2IEwgMjc5IDEwNiBMIDI3OSAxMDkgTCAyNzcgMTEzIEwgMjc3IDExNiBMIDI3NSAxMjAgTCAyNzUgMTIzIEwgMjczIDEyNyBMIDI3MyAxMzAgTCAyNzAgMTM3IEwgMjcwIDE0MCBMIDI2OCAxNDQgTCAyNjggMTQ3IEwgMjYyIDE2NSBMIDI2MSAxNzIgTCAyNTkgMTc2IEwgMjE4IDE3NiBMIDIxNyAxNzcgTCAyMDMgMTc3IEwgMjAxIDE3NSBMIDIwNSAxNjYgTCAyMDUgMTYzIEwgMjEzIDE0MSBMIDIxMyAxMzggTCAyMjYgOTkgTCAyMjYgOTQgTCAyMjcgOTMgTCAyMjYgODMgTCAyMjEgNzEgTCAyMTEgNjIgTCAxOTkgNTggTCAxODggNTggTCAxODcgNTkgTCAxODAgNjAgTCAxNjcgNjggTCAxNjEgNzUgTCAxNTcgODIgTCAxNTIgOTcgTCAxNTIgMTAwIEwgMTM3IDE0NCBMIDEzNyAxNDcgTCAxMzMgMTU3IEwgMTMzIDE2MCBMIDEzMCAxNjcgTCAxMjggMTc3IEwgMTI3IDE3OCBMIDc4IDE3OCBMIDc3IDE3OSBMIDczIDE3OSBMIDYwIDE4NCBMIDQ4IDE5NSBMIDQ0IDIwMiBMIDQzIDIwOCBMIDQyIDIwOSBMIDQyIDIyMCBMIDQ1IDIyOCBMIDUzIDIzNyBMIDU4IDI0MCBMIDY0IDI0MiBMIDEwNiAyNDIgTCAxMDcgMjQzIEwgOTYgMjc2IEwgOTYgMjc5IEwgODkgMjk4IEwgODkgMzAxIEwgODggMzA0IEwgODYgMzA2IEwgNDUgMzA2IEwgNDQgMzA3IEwgNDEgMzA3IEwgMzIgMzExIEwgMjYgMzE1IEwgMjAgMzIxIEwgMTYgMzI3IEwgMTMgMzM1IEwgMTMgMzQxIEwgMTIgMzQzIEwgMTMgMzQ0IEwgMTMgMzQ5IEwgMTUgMzU1IEwgMjQgMzY1IEwgMjkgMzY4IEwgMzUgMzcwIEwgNjUgMzcwIEwgNjYgMzcxIEwgNjYgMzc0IEwgNjMgMzgzIEwgNjEgMzg2IEwgNTkgMzk0IEwgNTcgMzk3IEwgNTQgNDA4IEwgNTIgNDExIEwgNDUgNDMyIEwgNDUgNDQ2IEwgNDkgNDU2IEwgNTggNDY1IEwgNjMgNDY4IEwgNjkgNDcwIEwgNzIgNDcwIEwgNzMgNDcxIEwgODUgNDcxIEwgODkgNDY5IEwgOTIgNDY5IEwgMTAwIDQ2NSBMIDExMyA0NTMgTCAxMTggNDQ0IEwgMTMyIDQwMCBMIDEzNCAzOTcgTCAxMzUgMzkxIEwgMTM3IDM4OCBMIDEzOCAzODIgTCAxNDAgMzc5IEwgMTQzIDM3MCBMIDIwNCAzNzAgTCAyMDUgMzcyIEwgMjAzIDM3NSBMIDE5MSA0MTEgTCAxOTEgNDE0IEwgMTg5IDQxNyBMIDE4NyA0MjMgTCAxODcgNDI2IEwgMTg0IDQzMyBMIDE4NCA0NDggTCAxODYgNDU0IEwgMTg5IDQ1OSBMIDE5NyA0NjcgTCAyMDQgNDcxIEwgMjExIDQ3MiBMIDIxMiA0NzMgTCAyMjIgNDczIEwgMjIzIDQ3MiBMIDIyNyA0NzIgTCAyMzMgNDcwIEwgMjQyIDQ2NSBMIDI1MSA0NTYgTCAyNTYgNDQ3IEwgMjY2IDQxNSBMIDI2OCA0MTIgTCAyNzEgNDAzIEwgMjcxIDQwMCBMIDI3NCAzOTMgTCAyNzQgMzkwIEwgMjc4IDM4MCBMIDI3OSAzNzQgTCAyODIgMzcwIEwgMzI1IDM3MCBMIDMzOCAzNjUgTCAzNDUgMzYwIEwgMzUyIDM1MiBMIDM1NyAzNDEgTCAzNTcgMzM4IEwgMzU4IDMzNyBMIDM1OCAzMjkgTCAzNTcgMzI4IEwgMzU3IDMyNCBMIDM1NSAzMTkgTCAzNDYgMzA5IEwgMzQzIDMwNyBMIDMzNCAzMDQgTCAyOTggMzA0IEwgMjk3IDMwMyBMIDMxMCAyNjQgTCAzMTAgMjYxIEwgMzEyIDI1NyBMIDMxMiAyNTQgTCAzMTUgMjQ3IEwgMzE2IDI0MSBMIDMxNyAyNDAgTCAzMzcgMjQwIEwgMzM4IDIzOSBMIDM0MiAyMzkgTCAzNTggMjMxIEwgMzY3IDIyMSBMIDM3MiAyMDkgTCAzNzIgMTk4IEwgMzcxIDE5NyBMIDM3MSAxOTQgTCAzNjggMTg4IEwgMzYwIDE4MCBMIDM0NyAxNzUgTCAzMzUgMTc1IEwgMzM0IDE3NCBMIDMzNSAxNjggTCAzMzcgMTY0IEwgMzM3IDE2MSBMIDM0MSAxNTEgTCAzNDEgMTQ4IEwgMzQzIDE0NCBMIDM0MyAxNDEgTCAzNDUgMTM3IEwgMzQ1IDEzNCBMIDM0OSAxMjQgTCAzNDkgMTIxIEwgMzUxIDExNyBMIDM1MSAxMTQgTCAzNTUgMTAyIEwgMzU1IDg4IEwgMzU0IDg3IEwgMzUzIDgwIEwgMzQ5IDczIFogTSAxODMgMjQwIEwgMjQxIDI0MCBMIDI0MiAyNDEgTCAyNDAgMjUxIEwgMjI5IDI4MyBMIDIyOSAyODYgTCAyMjYgMjkzIEwgMjI0IDMwMyBMIDIyMiAzMDUgTCAxNjIgMzA1IEwgMTYxIDMwNCBMIDE3NiAyNjAgTCAxNzYgMjU3IEwgMTgxIDI0MiBaIi8+PC9zdmc+';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [labels, setLabels] = useState<LabelShortcut[]>([]);
  const [repertorios, setRepertorios] = useState<any[]>([]);
  const [songBlocks, setSongBlocks] = useState<SongBlock[]>([]);
  const [chordBanks, setChordBanks] = useState<ChordBank[]>([]);
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [selectedRepertorio, setSelectedRepertorio] = useState<any | null>(null);
  const [selectedBlockSet, setSelectedBlockSet] = useState<SongBlock | null>(null);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [editingRepertorio, setEditingRepertorio] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [transposition, setTransposition] = useState(0);
  const [liveSession, setLiveSession] = useState<Session | null>(null);
  const initialLiveSessionHandledRef = useRef(false);
  const [isMaestroActive, setIsMaestroActive] = useState(false);
  const [followLeader, setFollowLeader] = useState(false);
  const [userRole, setUserRole] = useState<'maestro' | 'musician'>('musician');

  const isMaestro = userRole === 'maestro';

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('songs');
  const [sidebarView, setSidebarView] = useState<'tabs' | 'repertorio-songs'>('tabs');
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const [activeSongFolderId, setActiveSongFolderId] = useState<string | null>(null);
  const [expandedRepFolders, setExpandedRepFolders] = useState<string[]>([]);
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem('GEMINI_API_KEY') || '');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [selectedSongIdForAction, setSelectedSongIdForAction] = useState<string | null>(null);
  const [selectedRepIds, setSelectedRepIds] = useState<string[]>([]);
  const [isKeyPickerOpen, setIsKeyPickerOpen] = useState(false);
  const [isMobileSongActionsOpen, setIsMobileSongActionsOpen] = useState(false);
  const [openArchiveMenu, setOpenArchiveMenu] = useState<string | null>(null);
  useEffect(() => {
    if (!openArchiveMenu) return;
    const handleOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest('[data-archive-menu-root]')) setOpenArchiveMenu(null);
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [openArchiveMenu]);
  useEffect(() => {
    if (!isMobileSongActionsOpen) return;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest('[data-mobile-song-actions]')) {
        setIsMobileSongActionsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [isMobileSongActionsOpen]);
  useEffect(() => {
    if (!isKeyPickerOpen) return;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest('[data-key-picker-root]')) {
        setIsKeyPickerOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [isKeyPickerOpen]);
  const [isSharePopoverOpen, setIsSharePopoverOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSidebarActionOpen, setIsSidebarActionOpen] = useState(false);
  const [isUpdatingKey, setIsUpdatingKey] = useState(false);
  const lastKeyUpdateRef = useRef<{time: number, id: string} | null>(null);
  const [isSidebarArchiveOpen, setIsSidebarArchiveOpen] = useState(false);
  const bottomArchiveRef = useRef<HTMLDivElement>(null);
  const [isExportFolderModalOpen, setIsExportFolderModalOpen] = useState(false);
  const [isRepertorioJsonExportModalOpen, setIsRepertorioJsonExportModalOpen] = useState(false);
  const [isPickingFolderForNewRep, setIsPickingFolderForNewRep] = useState(false);
  const [isPickingFolderForNewBlock, setIsPickingFolderForNewBlock] = useState(false);
  const [selectedBlockFolderId, setSelectedBlockFolderId] = useState<string | null>(null);
  const [managingFolderType, setManagingFolderType] = useState<'song' | 'repertorio' | 'block' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sidebarActionRef = useRef<HTMLDivElement>(null);
  const sidebarCreateMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideDropdown = !dropdownRef.current || !dropdownRef.current.contains(target);
      const isOutsideSidebarAction = !sidebarActionRef.current || !sidebarActionRef.current.contains(target);
      const isOutsideCreateMenu = !sidebarCreateMenuRef.current || !sidebarCreateMenuRef.current.contains(target);
      const isOutsideArchive = !bottomArchiveRef.current || !bottomArchiveRef.current.contains(target);
      
      if (isOutsideDropdown && isOutsideSidebarAction && isOutsideCreateMenu) {
        setIsSidebarActionOpen(false);
      }
      if (isOutsideArchive) {
        setIsSidebarArchiveOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [pedalConfig, setPedalConfig] = useState<any>(() => {
    const saved = localStorage.getItem('pedalConfig');
    return saved ? JSON.parse(saved) : { next: 'ArrowRight', prev: 'ArrowLeft' };
  });

  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageOffsets, setPageOffsets] = useState<number[]>([0]);
  const [pageBreakIndices, setPageBreakIndices] = useState<[number, number][]>([]);
  const [chordProScale, setChordProScale] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const initialIsDesktop = window.innerWidth >= 1024;
    const deviceType = initialIsDesktop ? 'desktop' : window.innerWidth >= 768 ? 'tablet' : 'mobile';
    const saved = localStorage.getItem(`chordProScale_${deviceType}`);
    return saved ? parseFloat(saved) : 1;
  });
  const songViewRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [initialDist, setInitialDist] = useState<number | null>(null);

  // Determine if we should paginate (only on mobile/tablets)
  const isDesktop = useMemo(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
  }, []);

  const maxLineChars = useMemo(() => {
    if (!selectedSong?.chordPro) return 0;
    const transposedText = transposeChordPro(selectedSong.chordPro, transposition);
    const lines = transposedText.trim().split('\n');
    let max = 0;
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) return;
      
      const chunks: { chord: string | null, text: string }[] = [];
      let regex = /\[([^\]]+)\]/g;
      let match;
      let lastLyricEnd = 0;

      while ((match = regex.exec(line)) !== null) {
        if (match.index > lastLyricEnd) {
          const lyricText = line.slice(lastLyricEnd, match.index);
           if (chunks.length === 0) {
              chunks.push({ chord: null, text: lyricText });
           } else if (chunks[chunks.length - 1].chord !== null && chunks[chunks.length - 1].text === "") {
              chunks[chunks.length - 1].text = lyricText;
           } else {
              chunks.push({ chord: null, text: lyricText });
           }
        }
        chunks.push({ chord: match[1], text: "" });
        lastLyricEnd = regex.lastIndex;
      }
      
      if (lastLyricEnd < line.length) {
        const finalLyric = line.slice(lastLyricEnd);
        if (chunks.length > 0 && chunks[chunks.length - 1].text === "") {
          chunks[chunks.length - 1].text = finalLyric;
        } else {
          chunks.push({ chord: null, text: finalLyric });
        }
      }

      let total = 0;
      chunks.forEach((chunk, j) => {
        const chordLen = chunk.chord ? chunk.chord.length : 0;
        const textLen = chunk.text ? chunk.text.length : (j === chunks.length - 1 ? 0 : 1);
        total += Math.max(chordLen, textLen);
      });
      if (total > max) max = total;
    });
    return max;
  }, [selectedSong, transposition]);

  // O zoom mobile é controlado por pinça. O limite superior é calculado
  // para que a linha mais longa alcance, mas nunca ultrapasse, a largura útil.
  const getMobileMaxScale = () => {
    if (!songViewRef.current || maxLineChars <= 0) return 2.5;
    const viewWidth = songViewRef.current.clientWidth;
    const horizontalPadding = viewWidth >= 768 ? 96 : 48;
    const availableWidth = Math.max(120, viewWidth - horizontalPadding - 8);
    const renderedLines = contentRef.current?.querySelectorAll<HTMLElement>('.chordpro-responsive-line');
    let widestLine = 0;
    renderedLines?.forEach(line => { widestLine = Math.max(widestLine, line.scrollWidth); });
    if (widestLine > 0) return Math.min(2.5, Math.max(chordProScale, chordProScale * availableWidth / widestLine));
    return Math.min(2.5, Math.max(0.35, availableWidth / (maxLineChars * 8.4))); 
  };

  // Handle device-specific zoom persistence per song
  useEffect(() => {
    if (selectedSong?.id) {
      const deviceType = isDesktop ? 'desktop' : window.innerWidth >= 768 ? 'tablet' : 'mobile';
      const savedSongScale = localStorage.getItem(`chordProScale_${deviceType}_${selectedSong.id}`);
      if (savedSongScale) {
        setChordProScale(parseFloat(savedSongScale));
      } else {
        const savedDeviceScale = localStorage.getItem(`chordProScale_${deviceType}`);
        setChordProScale(savedDeviceScale ? parseFloat(savedDeviceScale) : 1);
      }
    }
  }, [selectedSong?.id, isDesktop]);

  useEffect(() => {
    const deviceType = isDesktop ? 'desktop' : window.innerWidth >= 768 ? 'tablet' : 'mobile';
    localStorage.setItem(`chordProScale_${deviceType}`, chordProScale.toString());
    if (selectedSong?.id) {
      localStorage.setItem(`chordProScale_${deviceType}_${selectedSong.id}`, chordProScale.toString());
    }
  }, [chordProScale, selectedSong?.id, isDesktop]);

  useEffect(() => {
    if (selectedSong?.isGroup) {
      setTotalPages(1);
      setPageOffsets([0]);
      setCurrentPage(0);
      return;
    }

    if (isDesktop) {
      setTotalPages(1);
      setPageOffsets([0]);
      setCurrentPage(0);
      return;
    }

    if (selectedSong?.pdfPages && selectedSong.pdfPages.length > 0) {
      setTotalPages(selectedSong.pdfPages.length);
      if (songViewRef.current) {
        const offsets = Array.from({ length: selectedSong.pdfPages.length }, (_, i) => i * songViewRef.current!.clientHeight);
        setPageOffsets(offsets);
        setPageBreakIndices([]);
      }
    } else if (contentRef.current && songViewRef.current) {
      const timer = setTimeout(() => {
        const topSafetyMargin = 30;
        const bottomSafetyMargin = 20; 
        const viewHeight = songViewRef.current?.clientHeight || 0;
        
        // Find all line elements inside the music content
        const lines = contentRef.current?.querySelectorAll('.music-line');
        if (!lines || lines.length === 0) {
          setTotalPages(1);
          setPageOffsets([0]);
          setPageBreakIndices([[0, 10000]]);
          return;
        }

        const newOffsets: number[] = [0];
        const newBreakIndices: [number, number][] = [];
        let currentPageStart = 0;
        let currentPageLineStartIdx = 0;
        const availableHeightPerPage = viewHeight - bottomSafetyMargin - topSafetyMargin;
        
        if (availableHeightPerPage <= 0) return;

        lines.forEach((line, index) => {
          const lineEl = line as HTMLElement;
          const lineTop = lineEl.offsetTop;
          const lineBottom = lineTop + lineEl.offsetHeight;

          // Threshold for the current page
          const currentThreshold = currentPageStart + (currentPageStart === 0 ? viewHeight - bottomSafetyMargin : availableHeightPerPage);

          if (lineBottom > currentThreshold) {
            let breakIndex = index;
            
            // Handle chord+lyric pairing: move both to next page if lyric line is about to be cut
            const hasLyrics = lineEl.getAttribute('data-has-lyrics') === 'true';
            const hasChords = lineEl.getAttribute('data-has-chords') === 'true';
            
            if (hasLyrics && !hasChords && index > 0) {
              const prevLine = lines[index - 1] as HTMLElement;
              const prevHasChords = prevLine.getAttribute('data-has-chords') === 'true';
              const prevHasLyrics = prevLine.getAttribute('data-has-lyrics') === 'true';
              if (prevHasChords && !prevHasLyrics) {
                breakIndex = index - 1;
              }
            }

            const breakLine = lines[breakIndex] as HTMLElement;
            // Get the source line index from data attribute
            const sourceStartIdx = parseInt(breakLine.getAttribute('data-line-index') || '0');
            
            // Previous page ends at sourceStartIdx - 1
            const prevSourceStartIdx = parseInt((lines[currentPageLineStartIdx] as HTMLElement).getAttribute('data-line-index') || '0');
            newBreakIndices.push([prevSourceStartIdx, sourceStartIdx - 1]);
            
            const newStartPos = breakLine.offsetTop - topSafetyMargin;
            newOffsets.push(newStartPos);
            currentPageStart = newStartPos;
            currentPageLineStartIdx = breakIndex;
          }
        });

        // Add the last page range
        const lastStartSourceIdx = parseInt((lines[currentPageLineStartIdx] as HTMLElement).getAttribute('data-line-index') || '0');
        newBreakIndices.push([lastStartSourceIdx, 10000]); // Use arbitrary large end index

        setTotalPages(newOffsets.length);
        setPageOffsets(newOffsets);
        setPageBreakIndices(newBreakIndices);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setTotalPages(1);
      setPageOffsets([0]);
      setPageBreakIndices([[0, 10000]]);
    }
    setCurrentPage(0);
  }, [selectedSong, transposition, chordProScale, currentView, isDesktop]);

  const handlePinchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      setInitialDist(dist);
    }
  };

  const handlePinchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDist !== null) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const diff = dist - initialDist;
      if (Math.abs(diff) > 15) {
        const factor = diff > 0 ? 1.02 : 0.98;
        let newScale = chordProScale * factor;

        // Dynamic limit to prevent right margin overflow
        if (songViewRef.current && maxLineChars > 0) {
          const viewWidth = songViewRef.current.clientWidth;
          
          // Calculate total horizontal padding
          let padding = 48; // 1.5rem (24px) each side from the wrapper
          if (viewWidth >= 1024) padding += 160; // lg:px-20 (80px each side)
          else if (viewWidth >= 768) padding += 96; // md:px-12 (48px each side)
          
          const availableWidth = viewWidth - padding - 10; // 10px extra safety
          
          // Estimate char width at scale 1 (fontSize=14)
          // For font-mono at 14px, 1ch is approx 8.4px
          const charWidthAtScale1 = 8.4;
          const maxAllowedScale = availableWidth / (maxLineChars * charWidthAtScale1);
          
          newScale = Math.min(newScale, Math.max(0.1, maxAllowedScale));
        }

        setChordProScale(prev => Math.min(Math.max(0.1, newScale), 2.5));
        setInitialDist(dist);
      }
    }
  };

  const [isCapturingKey, setIsCapturingKey] = useState<any>(null); // 'next' or 'prev'
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('geral');
  const [isMovingSongs, setIsMovingSongs] = useState(false);
  const [isMovingSingleSong, setIsMovingSingleSong] = useState(false);

  // Reset selection mode when changing tabs, views or folders
  useEffect(() => {
    setIsSelectionMode(false);
    setSelectedSongIds([]);
    setSelectedRepIds([]);
    setIsMovingSongs(false);
  }, [sidebarTab, sidebarView, expandedFolders, activeSongFolderId]);
  const [activeMobileSongId, setActiveMobileSongId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'title' | 'composition' | 'artist' | 'updatedAt'>('title');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [filterKey, setFilterKey] = useState<string>('');
  const [filterTempo, setFilterTempo] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [isFilterActive, setIsFilterActive] = useState(false);
  const [pdfQuality, setPdfQuality] = useState<PDFQuality>(() => {
    return (localStorage.getItem('pdfQuality') as PDFQuality) || 'medium';
  });
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTargetFolderId, setImportTargetFolderId] = useState<string | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [isExportFormatModalOpen, setIsExportFormatModalOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : false; // Day mode as native (false)
  });

  // Theme effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }

    // Persist to firestore if user is logged in
    if (appUser && appUser.theme !== (darkMode ? 'dark' : 'light')) {
      const userRef = doc(db, 'users', appUser.uid);
      updateDoc(userRef, { theme: darkMode ? 'dark' : 'light' }).catch(console.error);
    }
  }, [darkMode, appUser]);

  // Auth Listener & User Sync
  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Após autenticar, sempre iniciar na página principal de Músicas.
        setSidebarTab('songs');
        setCurrentView('list');
        setSelectedSong(null);
        setSelectedRepertorio(null);
      }
      
      if (unsubscribeUser) {
        unsubscribeUser();
        unsubscribeUser = null;
      }

      if (u) {
        const userRef = doc(db, 'users', u.uid);
        unsubscribeUser = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as AppUser;
            // Admin auto-healing
            if (u.email === 'camiloctorquato@gmail.com' && (data.role !== 'maestro' || data.status !== 'active')) {
              try {
                await updateDoc(userRef, { role: 'maestro', status: 'active' });
              } catch (e) {
                console.error("Erro ao auto-promover admin:", e);
              }
            }
            setAppUser(data);
            setUserRole(data.role);
            if (data.theme) {
              setDarkMode(data.theme === 'dark');
            }
          } else {
            // New user registration
            const isAdmin = u.email === 'camiloctorquato@gmail.com';
            const newUser: AppUser = {
              uid: u.uid,
              email: u.email || '',
              displayName: u.displayName || 'Novo Usuário',
              role: isAdmin ? 'maestro' : 'musician',
              status: isAdmin ? 'active' : 'pending',
              createdAt: new Date().toISOString()
            };
            try {
              await setDoc(userRef, newUser);
            } catch (error) {
              console.error("Erro ao criar perfil de usuário:", error);
            }
          }
        });
      } else {
        setAppUser(null);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, []);

  // Persist last active song
  useEffect(() => {
    if (selectedSong?.id) {
      localStorage.setItem('lastSongId', selectedSong.id);
    }
  }, [selectedSong]);

  // A página inicial do Maestro permanece na visão de pastas; nenhuma música é aberta automaticamente.

  // Sync selected song with updated data or clear if deleted
  useEffect(() => {
    if (selectedSong && !selectedSong.isGroup && songs.length > 0) {
      const updated = songs.find(s => s.id === selectedSong.id);
      if (!updated) {
        setSelectedSong(null);
        setCurrentView('list');
      } else if (updated.updatedAt !== selectedSong.updatedAt) {
        setSelectedSong(updated);
      }
    }
  }, [songs, selectedSong]);

  // All Users Listener (Adm only)
  useEffect(() => {
    if (!user || userRole !== 'maestro') {
      setAllUsers([]);
      return;
    }
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList = snapshot.docs.map(doc => doc.data() as AppUser);
      setAllUsers(userList);
    }, (error) => {
      console.error("Erro ao listar usuários:", error);
    });
    return () => unsubscribe();
  }, [user, userRole]);

  // Songs Listener
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'songs'), orderBy('title', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const songList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Song)).filter(song => !(song as any).isDraft);
      setSongs(songList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'songs');
    });
    return () => unsubscribe();
  }, [user]);
  
  // Folders Listener
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'folders'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Folder));
      // Sort by order first, then name
      list.sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 999999;
        const orderB = b.order !== undefined ? b.order : 999999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.name || '').localeCompare(b.name || '');
      });
      setFolders(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'folders');
    });
    return () => unsubscribe();
  }, [user]);

  // Categories Listener
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'categories'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        // Initialize default categories
        const defaults = ["Clássico", "Pagode", "Samba Rock", "Samba Urbano", "Samba de Batuque", "Samba de Raiz", "Samba Enredo"];
        defaults.forEach(name => {
          addDoc(collection(db, 'categories'), { name, createdBy: user.uid });
        });
      } else {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
        setCategories(list);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });
    return () => unsubscribe();
  }, [user]);

  // Labels Listener
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'labels'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        // Initialize default labels
        const defaults = [
          { name: 'BIS', color: '#00c853' },
          { name: 'REFRÃO', color: '#00e5ff' },
          { name: 'TRANSIÇÃO', color: '#ff9100' },
          { name: 'OBSERVAÇÃO', color: '#ff8a80' }
        ];
        defaults.forEach(item => {
          addDoc(collection(db, 'labels'), { ...item, createdBy: user.uid });
        });
      } else {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LabelShortcut));
        setLabels(list);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'labels');
    });
    return () => unsubscribe();
  }, [user]);

  // Repertórios Listener
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'setlists'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRepertorios(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'setlists');
    });
    return () => unsubscribe();
  }, [user]);

  // Chord Banks Listener
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'chord_banks'), where('createdBy', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        // Initialize default chord banks
        Object.entries(INITIAL_CHORD_BANKS).forEach(([note, chords]) => {
          addDoc(collection(db, 'chord_banks'), { note, chords, createdBy: user.uid });
        });
      } else {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChordBank));
        setChordBanks(list);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chord_banks');
    });
    return () => unsubscribe();
  }, [user]);

  // Song Blocks Listener
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'song_blocks'), 
      where('createdBy', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SongBlock));
      // Sort in memory to avoid composite index requirement
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSongBlocks(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'song_blocks');
    });
    return () => unsubscribe();
  }, [user]);

  // Live Session Listener
  useEffect(() => {
    if (!user) return;
    const sessionDoc = doc(db, 'sessions', 'current_live');
    initialLiveSessionHandledRef.current = false;
    const unsubscribe = onSnapshot(sessionDoc, (snapshot) => {
      // Não tome decisões de encerramento com dados apenas do cache local.
      // Aguarde a primeira confirmação do servidor. Depois disso, uma queda e
      // recuperação da rede não reinicializa os estados locais do Palco.
      if (!initialLiveSessionHandledRef.current && snapshot.metadata.fromCache) return;

      if (!snapshot.exists()) {
        initialLiveSessionHandledRef.current = true;
        setLiveSession(null);
        setIsMaestroActive(false);
        setFollowLeader(false);
        return;
      }

      const data = snapshot.data() as Session;

      // Na primeira confirmação REAL do servidor após abrir/recarregar o app,
      // encerra apenas uma transmissão antiga iniciada pela mesma conta.
      // Em reconexões posteriores, este bloco não é executado.
      if (!initialLiveSessionHandledRef.current) {
        initialLiveSessionHandledRef.current = true;
        if (data.leaderId === user.uid) {
          runTransaction(db, async (transaction) => {
            const currentSnapshot = await transaction.get(sessionDoc);
            if (currentSnapshot.exists() && (currentSnapshot.data() as Session).leaderId === user.uid) {
              transaction.update(sessionDoc, {
                leaderId: null,
                leaderName: null,
                updatedAt: new Date().toISOString()
              });
            }
          }).catch(error => console.error('Não foi possível limpar a transmissão anterior:', error));
          setLiveSession({ ...data, leaderId: null, leaderName: null });
          setIsMaestroActive(false);
          setFollowLeader(false);
          return;
        }
      }

      setLiveSession(data);
      // O estado acompanha o documento: isso recupera o modo Maestro após
      // uma reconexão, sem reativar uma sessão antiga no primeiro carregamento.
      setIsMaestroActive(Boolean(data.leaderId === user.uid));
      if (!data.leaderId) setFollowLeader(false);
        
        // Ao acompanhar, o dispositivo reproduz o contexto enviado pelo Maestro.
        if (followLeader) {
          if (data.currentRepertorioId) {
            const sharedRepertorio = repertorios.find((r: any) => r.id === data.currentRepertorioId);
            if (sharedRepertorio) {
              setSelectedRepertorio(sharedRepertorio);
              setSidebarTab('repertorios');
            }
          }
          if (typeof data.currentTransposition === 'number') {
            setTransposition(data.currentTransposition);
          }
          if (data.currentSongId && (!selectedSong || selectedSong.id !== data.currentSongId)) {
            if (data.currentSongId.startsWith('group:')) {
              const groupId = data.currentSongId.replace('group:', '');
              const activeRepertorio = repertorios.find((r: any) => r.id === data.currentRepertorioId) || selectedRepertorio;
              const group = activeRepertorio?.songGroups?.find((g: any) => g.id === groupId || g.title === groupId);
              if (group) {
                setSelectedSong({
                  id: data.currentSongId,
                  title: group.title || 'Marcador de Bloco',
                  artist: 'MARCADOR DE BLOCO',
                  isGroup: true,
                  groupData: group
                } as any);
                setCurrentView('details');
              }
            } else {
              const song = songs.find(songItem => songItem.id === data.currentSongId);
              if (song) {
                setSelectedSong(song);
                setCurrentView('details');
              }
            }
          }
        }
    });
    return () => unsubscribe();
  }, [user, followLeader, songs, selectedSong, repertorios, selectedRepertorio]);

  useEffect(() => {
    // Sincronizar o selectedRepertorio com a lista principal de repertórios
    if (selectedRepertorio) {
      const updatedRep = repertorios.find(r => r.id === selectedRepertorio.id);
      if (updatedRep) {
        const structureDiff = JSON.stringify(updatedRep.songIds) !== JSON.stringify(selectedRepertorio.songIds) || 
                             updatedRep.title !== selectedRepertorio.title;
        
        const keysDiff = JSON.stringify(updatedRep.songKeys) !== JSON.stringify(selectedRepertorio.songKeys);

        // Bloqueio de 10 segundos após alteração manual de tom
        const isRecentManualUpdate = lastKeyUpdateRef.current && 
                                    (Date.now() - lastKeyUpdateRef.current.time < 10000);

        if (structureDiff || (keysDiff && !isRecentManualUpdate)) {
          setSelectedRepertorio(updatedRep);
        }
      }
    }
  }, [repertorios]);

  useEffect(() => {
    // Carregar transposição APENAS ao trocar de música ou entrar no modo repertório
    if (!selectedSong) {
      setTransposition(0);
      return;
    }

    if (sidebarView === 'repertorio-songs' && selectedRepertorio) {
      const savedKey = selectedRepertorio.songKeys?.[selectedSong.id || ''];
      if (savedKey) {
        const diff = getSemitones(selectedSong.key, savedKey);
        setTransposition(diff);
      } else {
        setTransposition(0);
      }
    } else {
      // No modo Acervo, sempre começa no 0
      setTransposition(0);
    }
  }, [selectedSong?.id, selectedSong?.key, sidebarView, selectedRepertorio?.id, selectedRepertorio?.songKeys]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = () => signOut(auth);

  const autoSaveSong = async (songData: Partial<Song>, draftId?: string | null): Promise<string | null> => {
    if (!user) return null;
    try {
      const payload = { ...songData, updatedAt: new Date().toISOString() };
      if (editingSong?.id) {
        await updateDoc(doc(db, 'songs', editingSong.id), payload);
        return editingSong.id;
      }
      if (draftId) {
        await updateDoc(doc(db, 'songs', draftId), payload);
        return draftId;
      }
      const created = await addDoc(collection(db, 'songs'), {
        ...payload,
        createdBy: user.uid,
        isDraft: true,
      });
      return created.id;
    } catch (error) {
      console.error('Erro no salvamento automático da música:', error);
      return null;
    }
  };

  const discardAutoSavedSong = async (draftId?: string | null) => {
    try {
      if (!editingSong?.id && draftId) {
        await deleteDoc(doc(db, 'songs', draftId));
      } else if (editingSong?.id) {
        const { id, ...originalData } = editingSong as any;
        await updateDoc(doc(db, 'songs', editingSong.id), {
          ...originalData,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Erro ao descartar alterações da música:', error);
    }
  };

  const saveSong = async (songData: Partial<Song>, draftId?: string | null) => {
    if (!user) return;
    try {
      if (editingSong?.id) {
        // 1. Salvar na música original
        await updateDoc(doc(db, 'songs', editingSong.id), {
          ...songData,
          updatedAt: new Date().toISOString()
        });

        if (selectedSong?.id === editingSong.id) {
          setSelectedSong(prev => prev ? { ...prev, ...songData } as any : null);
        }
        
        setCurrentView('details');
        setEditingSong(null);
      } else {
        const data = {
          ...songData,
          updatedAt: new Date().toISOString(),
          createdBy: user.uid,
        };
        if (draftId) {
          await updateDoc(doc(db, 'songs', draftId), { ...data, isDraft: false });
        } else {
          await addDoc(collection(db, 'songs'), data);
        }
        setCurrentView('list');
      }
    } catch (error) {
      console.error('Error saving song:', error);
      throw error;
    }
  };

  // Mantém espaços e caracteres acentuados nos nomes exportados, removendo apenas caracteres inválidos em nomes de arquivo.
  const getExportFileName = (title: string, fallback: string = 'musica') => {
    const safeName = (title || fallback)
      .replace(/[<>:\"/\\|?*\x00-\x1F]/g, '')
      .replace(/[. ]+$/g, '')
      .trim();
    return safeName || fallback;
  };

  // Centraliza o cabeçalho ChordPro e garante uma linha em branco entre metadados e letra/cifras.
  const buildChordProExport = (song: Song, folderName?: string) => {
    const headerLines = [
      `{title: ${song.title || ''}}`,
      `{artist: ${song.artist || ''}}`,
      `{composition: ${song.composition || ''}}`,
      `{key: ${song.key || ''}}`,
      `{tempo: ${song.tempo || ''}}`,
      `{category: ${song.category || ''}}`,
      folderName ? `{folder: ${folderName}}` : ''
    ].filter(Boolean);
    const lyrics = (song.chordPro || '').replace(/^\n+/, '');
    return `${headerLines.join('\n')}\n\n${lyrics}`;
  };

  const exportArchiveZip = async (list: Song[], filename: string) => {
    if (!list.length) { alert('Não há músicas para exportar.'); return; }
    const zip = new JSZip();
    list.forEach(song => {
      const safeName = getExportFileName(song.title || 'musica');
      const folderName = folders.find(f => f.id === song.folderId)?.name || '';
      zip.file(`${safeName}.cho`, buildChordProExport(song, folderName));
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportArchivePdf = (list: Song[], title: string, filename: string) => {
    const pdf = new jsPDF(); pdf.setFontSize(16); pdf.text(title, 15, 20); pdf.setFontSize(10);
    let y = 30;
    list.forEach((song, index) => {
      if (y > 280) { pdf.addPage(); y = 20; }
      pdf.text(`${index + 1}. ${song.title || ''} | ${song.artist || ''} | Tom: ${song.key || ''}`, 15, y); y += 7;
    });
    pdf.save(filename);
  };

  const saveSongBlock = async (blockData: SongBlock) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'song_blocks'), blockData);
      setSelectedBlockFolderId(null);
      setCurrentView('blocks');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'song_blocks');
    }
  };

  const addBlockSuggestionToRepertorio = async (suggestion: any, repertorioId: string) => {
    const target = repertorios.find((rep: any) => rep.id === repertorioId);
    if (!target) {
      alert('O repertório selecionado não foi encontrado.');
      return;
    }
    const requestedIds = (suggestion.songIds || []).filter((id: string) => songs.some(song => song.id === id));
    const existingIds = new Set((target.songIds || []).filter((id: string) => !String(id).startsWith('group:')));
    const newSongIds = requestedIds.filter((id: string) => !existingIds.has(id));
    if (newSongIds.length === 0) {
      alert('Todas as músicas deste bloco já estão no repertório selecionado.');
      return;
    }

    const groupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const groupTitle = (suggestion.name || 'Novo Bloco').trim();
    const newGroups = [...(target.songGroups || []), { id: groupId, title: groupTitle, songIds: newSongIds }];
    const newIds = [...(target.songIds || []), `group:${groupId}`, ...newSongIds];
    try {
      await updateDoc(doc(db, 'setlists', repertorioId), {
        songGroups: newGroups,
        songIds: newIds,
        updatedAt: new Date().toISOString()
      });
      const updated = { ...target, songGroups: newGroups, songIds: newIds };
      setRepertorios(prev => prev.map(rep => rep.id === repertorioId ? updated : rep));
      if (selectedRepertorio?.id === repertorioId) setSelectedRepertorio(updated);
      alert(`Bloco "${groupTitle}" adicionado ao repertório "${target.title}".`);
    } catch (error) {
      console.error('Erro ao adicionar bloco ao repertório:', error);
      handleFirestoreError(error, OperationType.WRITE, 'setlists');
    }
  };

  const updateSongBlock = async (updatedBlock: SongBlock) => {
    if (!updatedBlock.id) return;
    try {
      const { id, ...data } = updatedBlock as any;
      await updateDoc(doc(db, 'song_blocks', id), data);
      setSongBlocks(prev => prev.map(item => item.id === id ? updatedBlock : item));
      setSelectedBlockSet(updatedBlock);
    } catch (error) {
      console.error('Erro ao atualizar bloco:', error);
      handleFirestoreError(error, OperationType.WRITE, 'song_blocks');
    }
  };

  const openBlockFolder = async (folderId: string, addNewCard = false) => {
    const folder = folders.find(item => item.id === folderId && (item.type as string) === 'block');
    if (!folder) return;

    try {
      const existing = songBlocks.find(item => item.folderId === folderId);
      let target: SongBlock;

      if (existing?.id) {
        target = { ...existing, title: folder.name };
        if (addNewCard) {
          const current = Array.isArray(existing.suggestions) ? existing.suggestions : [];
          const nextSuggestions = [...current, {
            id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: `Novo Bloco ${current.length + 1}`,
            songIds: [],
            reason: 'Bloco criado manualmente pelo usuário.'
          }];
          target = { ...existing, title: folder.name, suggestions: nextSuggestions };
          await updateDoc(doc(db, 'song_blocks', existing.id), { suggestions: nextSuggestions });
          setSongBlocks(prev => prev.map(item => item.id === existing.id ? target : item));
        }
      } else {
        const initialSuggestions = addNewCard ? [{
          id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: 'Novo Bloco 1',
          songIds: [],
          reason: 'Bloco criado manualmente pelo usuário.'
        }] : [];
        const newData = {
          title: folder.name,
          folderId,
          totalSongs: 0,
          profile: 'Manual',
          maxPerBlock: 3,
          filters: [],
          suggestions: initialSuggestions,
          createdBy: user?.uid || '',
          createdAt: new Date().toISOString()
        } as SongBlock;
        const created = await addDoc(collection(db, 'song_blocks'), newData);
        target = { ...newData, id: created.id };
        setSongBlocks(prev => [...prev, target]);
      }

      setSelectedBlockFolderId(folderId);
      setSelectedBlockSet(target);
      setCurrentView('block-details');
      setSidebarTab('blocks');
      setSidebarView('tabs');
      setIsSidebarOpen(false);
    } catch (error) {
      console.error('Erro ao abrir conjunto de blocos:', error);
      handleFirestoreError(error, OperationType.WRITE, 'song_blocks');
    }
  };

  const addBlockToSelectedSet = () => {
    if (!selectedBlockSet) return;
    const current = Array.isArray(selectedBlockSet.suggestions) ? selectedBlockSet.suggestions : [];
    const next = {
      ...selectedBlockSet,
      suggestions: [...current, {
        id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: `Novo Bloco ${current.length + 1}`,
        songIds: [],
        reason: 'Bloco criado manualmente pelo usuário.'
      }]
    } as SongBlock;
    void updateSongBlock(next);
  };

  const deleteSongBlock = async (id: string) => {
    if (!window.confirm('Deseja realmente excluir esta sugestão de blocos?')) return;
    try {
      await deleteDoc(doc(db, 'song_blocks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'song_blocks');
    }
  };

  const deleteSong = async (id: string) => {
    const song = songs.find(item => item.id === id);
    const linkedRepertoires = repertorios.filter(rep => (rep.songIds || []).includes(id));
    const warning = linkedRepertoires.length > 0
      ? `\n\nEsta música está vinculada a ${linkedRepertoires.length} repertório(s):\n${linkedRepertoires.map(rep => `• ${rep.title}`).join('\n')}\n\nA exclusão apagará o cadastro original e a música deixará de aparecer em TODOS esses repertórios.`
      : '';
    if (!window.confirm(`Excluir a música "${song?.title || 'selecionada'}" do acervo?${warning}`)) return;
    try {
      await deleteDoc(doc(db, 'songs', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'songs');
    }
  };

  const handleUpdateUser = async (uid: string, data: Partial<AppUser>) => {
    try {
      await updateDoc(doc(db, 'users', uid), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!window.confirm('Excluir permanentemente este usuário?')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'users');
    }
  };

  const saveRepertorio = async (data: any) => {
    if (!user) {
      alert('Você precisa estar logado para salvar um repertório.');
      return;
    }
    if (!data.title) {
       alert('O título do repertório é obrigatório.');
       return;
    }
    
    try {
      const cleanData = {
        title: data.title,
        date: data.date || '',
        folderId: data.folderId || '',
        songIds: data.songIds || [],
        // Tonalidades pertencem ao vínculo música/repertório.
        // Ao editar, preserva as deste repertório; ao criar, começa vazio.
        songKeys: data.songKeys || (editingRepertorio?.id ? editingRepertorio.songKeys || {} : {}),
        // A edição do cabeçalho não pode apagar os blocos já organizados.
        songGroups: data.songGroups || (editingRepertorio?.id ? editingRepertorio.songGroups || [] : []),
        updatedAt: serverTimestamp()
      };

      if (editingRepertorio?.id) {
        const docRef = doc(db, 'setlists', editingRepertorio.id);
        await updateDoc(docRef, cleanData);
        setSelectedRepertorio({ id: editingRepertorio.id, ...editingRepertorio, ...cleanData });
      } else {
        const docRef = await addDoc(collection(db, 'setlists'), {
          ...cleanData,
          createdBy: user.uid,
          createdAt: serverTimestamp()
        });
        setSelectedRepertorio({ id: docRef.id, ...cleanData, createdBy: user.uid });
      }
      
      setSidebarTab('repertorios');
      setSidebarView('repertorio-songs');
      setIsSidebarOpen(true);
      setCurrentView('repertorios');
      
      // Set main view to first song if exists
      if (cleanData.songIds.length > 0) {
        const firstSong = songs.find(s => s.id === cleanData.songIds[0]);
        if (firstSong) {
          setSelectedSong(firstSong);
          setCurrentView('details');
          updateLiveSong(firstSong.id!);
        }
      }
      
      setEditingRepertorio(null);
    } catch (error) {
       console.error('Erro detalhado ao salvar repertório:', error);
       alert('Erro ao salvar o repertório. Detalhes no console.');
       handleFirestoreError(error, OperationType.WRITE, 'setlists');
    }
  };

  const deleteRepertorio = async (id: string) => {
    if (!window.confirm('Excluir este repertório?')) return;
    try {
      await deleteDoc(doc(db, 'setlists', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'setlists');
    }
  };

  const toggleLeader = async (forceVal?: boolean) => {
    if (!user) return;
    const newIsMaestroActive = forceVal !== undefined ? forceVal : !isMaestroActive;
    const sessionRef = doc(db, 'sessions', 'current_live');

    if (newIsMaestroActive) {
      try {
        // A transação garante que dois Maestros não reservem a mesma sessão ao mesmo tempo.
        await runTransaction(db, async (transaction) => {
          const sessionSnapshot = await transaction.get(sessionRef);
          const currentSession = sessionSnapshot.exists() ? sessionSnapshot.data() as Session : null;
          const currentLeaderId = currentSession?.leaderId || null;
          if (currentLeaderId && currentLeaderId !== user.uid) {
            throw new Error('SESSION_ALREADY_CLAIMED');
          }

          transaction.set(sessionRef, {
            ...(sessionSnapshot.exists() ? sessionSnapshot.data() : {}),
            leaderId: user.uid,
            leaderName: user.displayName || user.email || 'Maestro',
            currentSongId: selectedSong?.id || (sessionSnapshot.exists() ? sessionSnapshot.data().currentSongId : null) || null,
            currentRepertorioId: selectedRepertorio?.id || null,
            currentTransposition: transposition || 0,
            updatedAt: new Date().toISOString()
          });
        });
        setIsMaestroActive(true);
        setFollowLeader(false);
      } catch (error) {
        setIsMaestroActive(false);
        if (error instanceof Error && error.message === 'SESSION_ALREADY_CLAIMED') {
          setFollowLeader(true);
          alert(`O Maestro ${liveSession?.leaderName || 'responsável'} já está transmitindo. Você pode acompanhá-lo pelo Modo Palco.`);
          return;
        }
        console.error('Erro ao iniciar transmissão:', error);
        alert('Não foi possível iniciar a transmissão. Verifique sua conexão e tente novamente.');
      }
    } else {
      // Somente o Maestro proprietário pode encerrar a sessão.
      try {
        await runTransaction(db, async (transaction) => {
          const sessionSnapshot = await transaction.get(sessionRef);
          if (!sessionSnapshot.exists()) return;
          const current = sessionSnapshot.data() as Session;
          if (current.leaderId !== user.uid) return;
          transaction.update(sessionRef, {
            leaderId: null,
            leaderName: null,
            updatedAt: new Date().toISOString()
          });
        });
        setIsMaestroActive(false);
      } catch (error) {
        console.error('Erro ao encerrar transmissão:', error);
        alert('Não foi possível encerrar a transmissão. Tente novamente.');
      }
    }
  };

  const updateLiveSong = async (songId: string) => {
    if (user && (isMaestroActive || liveSession?.leaderId === user.uid)) {
      try {
        await updateDoc(doc(db, 'sessions', 'current_live'), {
          currentSongId: songId,
          currentRepertorioId: selectedRepertorio?.id || null,
          currentTransposition: transposition || 0,
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error updating live song:', error);
      }
    }
  };

  // Mantém repertório e tonalidade da sessão sincronizados quando o Maestro os altera.
  useEffect(() => {
    if (!user || !isMaestroActive) return;
    updateDoc(doc(db, 'sessions', 'current_live'), {
      currentRepertorioId: selectedRepertorio?.id || null,
      currentTransposition: transposition || 0,
      updatedAt: new Date().toISOString()
    }).catch(error => console.error('Erro ao sincronizar contexto do Palco:', error));
  }, [user, isMaestroActive, selectedRepertorio?.id, transposition]);

  // Um único botão Palco controla transmissão (Maestro) ou acompanhamento (todos).
  const togglePalco = async () => {
    if (!user) return;

    // O listener do Firestore pode levar alguns milissegundos para refletir
    // a gravação recém-feita. O estado local do Maestro evita que um segundo
    // clique rápido seja interpretado como uma nova ativação.
    const leaderId = liveSession?.leaderId || (isMaestroActive ? user.uid : null);

    // Maestro inicia ou encerra sua própria transmissão.
    if (isMaestro && (!leaderId || leaderId === user.uid)) {
      if (leaderId === user.uid) {
        await toggleLeader(false);
      } else {
        await toggleLeader(true);
      }
      return;
    }

    // Músicos e outros Maestros entram ou saem da transmissão ativa.
    if (leaderId && leaderId !== user.uid) {
      const willFollow = !followLeader;
      setFollowLeader(willFollow);
      if (willFollow) {
        // Fecha imediatamente a barra lateral ao entrar no acompanhamento.
        // Ela volta a ficar acessível quando o acompanhamento terminar.
        setIsSidebarOpen(false);
      }
      if (willFollow && liveSession?.currentSongId) {
        const song = songs.find(item => item.id === liveSession.currentSongId);
        if (song) {
          setSelectedSong(song);
          setCurrentView('details');
        }
      }
    }
  };

  useEffect(() => {
    if (!isCapturingKey) return;

    const handleKeyCapture = (e: KeyboardEvent) => {
      e.preventDefault();
      const newConfig = { ...pedalConfig, [isCapturingKey]: e.key };
      setPedalConfig(newConfig);
      localStorage.setItem('pedalConfig', JSON.stringify(newConfig));
      setIsCapturingKey(null);
    };

    window.addEventListener('keydown', handleKeyCapture);
    return () => window.removeEventListener('keydown', handleKeyCapture);
  }, [isCapturingKey, pedalConfig]);

  const generatePDF = (songList: Song[], title: string = 'Repertório', returnDoc: boolean = false) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const primaryRed = [220, 38, 38]; // #dc2626
    const leftMargin = 20;
    const rightMargin = 190;
    const lineHeight = 4.2;
    const chordOffset = 3.6;

    songList.forEach((song, index) => {
      if (index > 0) doc.addPage();
      
      let y = 20;

      // Header Line 1: TITULO DA MÚSICA (TOM) • Categoria
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(0, 0, 0);
      doc.text(`${song.title.toUpperCase()} (${song.key || '-'}) • ${song.category}`, leftMargin, y);
      y += 6;

      // Header Line 2: Artista (composição) • Andamento: andamento
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`${song.artist}${song.composition ? ` (${song.composition})` : ''} • Andamento: ${song.tempo}`, leftMargin, y);
      y += 4;
      
      doc.setDrawColor(200, 200, 200);
      doc.line(leftMargin, y, rightMargin, y);
      y += 6;

      if (song.pdfPages && song.pdfPages.length > 0) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        song.pdfPages.forEach((url, idx) => {
          if (idx > 0) {
            doc.addPage();
            doc.addImage(url, 'JPEG', 0, 0, pageWidth, pageHeight);
          } else {
            doc.deletePage(doc.getNumberOfPages());
            doc.addPage();
            doc.addImage(url, 'JPEG', 0, 0, pageWidth, pageHeight);
          }
        });
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const lines = song.chordPro.split('\n');
        
        let isChorus = false;
        let textFillColor: string | null = null;

        lines.forEach(line => {
          const trimmed = line.trim();
          
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            const content = trimmed.slice(1, -1);
            const [key, ...valueParts] = content.split(':');
            const directive = key.trim().toLowerCase();
            const value = valueParts.join(':').trim();

            if (directive === 'c' || directive === 'comment') {
              if (value.toLowerCase() === 'chorus') {
                isChorus = true;
              } else if (value === '') {
                isChorus = false;
              } else {
                if (y > 270) { doc.addPage(); y = 20; }
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(100, 100, 100);
                doc.setDrawColor(primaryRed[0], primaryRed[1], primaryRed[2]);
                doc.line(leftMargin, y - 3, leftMargin, y + 1);
                doc.text(value, leftMargin + 3, y);
                y += lineHeight * 1.2;
                doc.setFont('helvetica', 'normal');
              }
            } else if (directive === 'textfill') {
              textFillColor = value === '' ? null : (value === 'yellow' ? '#ffff00' : value);
            }
            return;
          }

          const chunks: { chord: string | null, text: string }[] = [];
          const regex = /\[([^\]]+)\]/g;
          let match;
          let lastLyricEnd = 0;

          while ((match = regex.exec(line)) !== null) {
            if (match.index > lastLyricEnd) {
              if (chunks.length === 0) {
                chunks.push({ chord: null, text: line.slice(0, match.index) });
              } else {
                chunks[chunks.length - 1].text += line.slice(lastLyricEnd, match.index);
              }
            }
            chunks.push({ chord: match[1], text: "" });
            lastLyricEnd = regex.lastIndex;
          }
          if (lastLyricEnd < line.length) {
            if (chunks.length === 0) {
              chunks.push({ chord: null, text: line.slice(lastLyricEnd) });
            } else {
              chunks[chunks.length - 1].text += line.slice(lastLyricEnd);
            }
          }

          if (chunks.length === 0 && trimmed === '') {
            y += lineHeight * 1.5;
            return;
          }

          const isLabelLine = trimmed === 'BIS' || trimmed === 'REFRÃO' || trimmed === 'TRANSIÇÃO' || trimmed === 'OBSERVAÇÃO' || (textFillColor !== null && chunks.every(c => c.chord === null));
          const hasChords = chunks.some(c => c.chord !== null);

          if (y > (hasChords ? 260 : 275)) {
            doc.addPage();
            y = 20;
          }

          if (isLabelLine) {
            const labelText = chunks.map(c => c.text).join('').trim() || trimmed;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            const txtWidth = doc.getTextWidth(labelText) + 4;
            
            if (textFillColor) {
              doc.setFillColor(200, 200, 200);
              if (textFillColor.startsWith('#')) {
                const r = parseInt(textFillColor.slice(1, 3), 16);
                const g = parseInt(textFillColor.slice(3, 5), 16);
                const b = parseInt(textFillColor.slice(5, 7), 16);
                doc.setFillColor(r, g, b);
              }
              doc.rect(leftMargin, y - 3, txtWidth, 5, 'F');
            } else {
              doc.setFillColor(150, 150, 150);
              doc.rect(leftMargin, y - 3, txtWidth, 5, 'F');
            }
            
            doc.setTextColor(0, 0, 0);
            doc.text(labelText, leftMargin + 2, y + 0.5);
            y += lineHeight + 2;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
          } else if (hasChords) {
            let cursorX = leftMargin;
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(primaryRed[0], primaryRed[1], primaryRed[2]);
            chunks.forEach(chunk => {
              if (chunk.chord) doc.text(chunk.chord, cursorX, y);
              const chordWidth = chunk.chord ? doc.getTextWidth(chunk.chord) : 0;
              doc.setFont('helvetica', isChorus ? 'bold' : 'normal');
              const lyricWidth = chunk.text ? doc.getTextWidth(chunk.text) : 0;
              cursorX += Math.max(chordWidth, lyricWidth);
              doc.setFont('helvetica', 'bold');
            });
            
            y += chordOffset;
            cursorX = leftMargin;

            doc.setFont('helvetica', isChorus ? 'bold' : 'normal');
            doc.setTextColor(0, 0, 0);
            chunks.forEach(chunk => {
              if (chunk.text) doc.text(chunk.text, cursorX, y);
              const lyricWidth = chunk.text ? doc.getTextWidth(chunk.text) : 0;
              doc.setFont('helvetica', 'bold');
              const chordWidth = chunk.chord ? doc.getTextWidth(chunk.chord) : 0;
              cursorX += Math.max(chordWidth, lyricWidth);
              doc.setFont('helvetica', isChorus ? 'bold' : 'normal');
            });
            
            y += lineHeight * 1.15;
          } else {
            doc.setFont('helvetica', isChorus ? 'bold' : 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text(line, leftMargin, y);
            y += lineHeight * 1.15;
          }
        });
      }
    });

    if (returnDoc) return doc;
    doc.save(`${title.trim().toLocaleUpperCase('pt-BR')}.pdf`);
  };

  const shareAsPDF = async (songList: Song[], title: string) => {
    const docObj = generatePDF(songList, title, true) as jsPDF;
    const pdfBlob = docObj.output('blob');
    const fileName = `${title.trim().toLocaleUpperCase('pt-BR')}.pdf`;
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: title,
          text: `Compartilhando: ${title}`
        });
      } catch (err) {
        console.error("Error sharing PDF:", err);
        docObj.save(fileName);
      }
    } else {
      docObj.save(fileName);
    }
  };

  const handleBatchDelete = async () => {
    if (!window.confirm(`Excluir ${selectedSongIds.length} músicas?`)) return;
    try {
      for (const id of selectedSongIds) {
        await deleteDoc(doc(db, 'songs', id));
      }
      setIsSelectionMode(false);
      setSelectedSongIds([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'songs');
    }
  };

  const handleBatchMove = async (folderId: string) => {
    try {
      for (const id of selectedSongIds) {
        await updateDoc(doc(db, 'songs', id), { 
          folderId: folderId || null,
          updatedAt: new Date().toISOString()
        });
      }
      setIsSelectionMode(false);
      setSelectedSongIds([]);
      setIsMovingSongs(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'songs');
    }
  };

  const handleMoveSingleSong = async (folderId: string) => {
    const songId = selectedSongIdForAction;
    if (!songId) return;
    try {
      await updateDoc(doc(db, 'songs', songId), {
        folderId: folderId || null,
        updatedAt: new Date().toISOString()
      });
      setSongs(prev => prev.map(song => song.id === songId ? { ...song, folderId: folderId || null } : song));
      setIsMovingSingleSong(false);
      setSelectedSongIdForAction(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'songs');
    }
  };

  const handleBatchShare = () => {
    const selectedSongs = songs.filter(s => selectedSongIds.includes(s.id!));
    shareAsPDF(selectedSongs, 'Músicas Selecionadas');
  };

  const handleBulkImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      setPendingImportFile(file);
      setIsImportModalOpen(true);
    };
    input.click();
  };

  const processBulkImport = async (targetFolderId: string | null) => {
    if (!pendingImportFile) return;
    const file = pendingImportFile;

    try {
      setImportProgress({ current: 0, total: 1, message: 'Iniciando importação...' });
      
      if (file.name.toLowerCase().endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file);
        const entries = Object.entries(zip.files).filter(([filename, zipEntry]) => 
          !zipEntry.dir && (filename.endsWith('.cho') || filename.endsWith('.chordpro') || filename.endsWith('.txt') || filename.endsWith('.pdf'))
        );

        let count = 0;
        setImportProgress({ current: 0, total: entries.length, message: `Preparando ${entries.length} arquivos...` });

        // Sequencial processing to avoid crashing the browser with many PDFs
        for (const [filename, zipEntry] of entries) {
          try {
            setImportProgress({ 
              current: count + 1, 
              total: entries.length, 
              message: `Processando: ${filename}` 
            });

            const isPdf = filename.toLowerCase().endsWith('.pdf');
            let pdfPages: string[] | undefined = undefined;
            let content = '';

            if (isPdf) {
              const pdfBuffer = await zipEntry.async('arraybuffer');
              pdfPages = await convertPDFToImages(pdfBuffer, pdfQuality);
              content = `[ARQUIVO PDF IMPORTADO: ${filename}]`;
            } else {
              content = await zipEntry.async('text');
            }
            
            const metadata: any = {
              title: filename.replace(/\.\w+$/, '').replace(/_/g, ' '),
              artist: 'Desconhecido',
              composition: '',
              category: 'Geral',
              tempo: 'Moderado',
              key: ''
            };

            const cleanContent = content.replace(/\{(\w+):\s*([^\}]+)\}/g, (match, key, value) => {
              const k = key.toLowerCase();
              if (['title', 'artist', 'composition', 'category', 'tempo', 'key'].includes(k)) {
                metadata[k] = value.trim();
              }
              return ''; 
            }).trim();

            const processedChordPro = smartUppercase(cleanContent);
            const finalKey = metadata.key || detectKey(processedChordPro);
            
            const songData = {
              ...metadata,
              folderId: targetFolderId,
              key: finalKey,
              chordPro: processedChordPro,
              ...(pdfPages ? { pdfPages } : {}),
              createdBy: user?.uid || auth.currentUser?.uid || 'unknown',
              updatedAt: new Date().toISOString()
            };

            await addDoc(collection(db, 'songs'), songData);
            count++;
          } catch (itemError) {
            console.error(`Erro ao importar ${filename}:`, itemError);
            // Non-blocking error for individual items
          }
        }

        alert(`${count} músicas/arquivos importados com sucesso!`);
      } else {
        const isPdf = file.name.toLowerCase().endsWith('.pdf');
        let pdfPages: string[] | undefined = undefined;
        let content = '';

        setImportProgress({ current: 0, total: 1, message: 'Processando arquivo individual...' });

        if (isPdf) {
          pdfPages = await convertPDFToImages(file, pdfQuality);
          content = `[ARQUIVO PDF IMPORTADO: ${file.name}]`;
        } else {
          content = await file.text();
        }

        const metadata: any = {
          title: file.name.replace(/\.\w+$/, '').replace(/_/g, ' '),
          artist: 'Desconhecido',
          composition: '',
          category: 'Geral',
          tempo: 'Moderado',
          key: ''
        };

        const cleanContent = content.replace(/\{(\w+):\s*([^\}]+)\}/g, (match, key, value) => {
          const k = key.toLowerCase();
          if (['title', 'artist', 'composition', 'category', 'tempo', 'key'].includes(k)) {
            metadata[k] = value.trim();
          }
          return ''; 
        }).trim();

        const processedChordPro = smartUppercase(cleanContent);
        const finalKey = metadata.key || detectKey(processedChordPro);

        const songData = {
          ...metadata,
          folderId: targetFolderId,
          key: finalKey,
          chordPro: processedChordPro,
          ...(pdfPages ? { pdfPages } : {}),
          createdBy: user?.uid || auth.currentUser?.uid || 'unknown',
          updatedAt: new Date().toISOString()
        };

        await addDoc(collection(db, 'songs'), songData);
        alert(`Música "${metadata.title}" importada com sucesso!`);
      }
    } catch (error: any) {
      console.error('Erro na importação:', error);
      alert(`Erro na importação: ${error.message || 'Ocorreu um erro ao processar o arquivo.'}`);
    } finally {
      setImportProgress(null);
      setIsImportModalOpen(false);
      setPendingImportFile(null);
      setImportTargetFolderId(null);
    }
  };

  const handleManualExport = async () => {
    if (selectedSongIds.length === 0) {
      alert("Selecione pelo menos uma música para exportar.");
      return;
    }
    setIsExportFormatModalOpen(true);
  };

  const handleBatchExportFormat = async (format: 'cho' | 'pdf') => {
    if (selectedSongIds.length === 0) return;

    if (selectedSongIds.length === 1) {
      const song = songs.find(s => s.id === selectedSongIds[0]);
      if (song) {
        if (format === 'pdf') {
          generatePDF([song], song.title);
        } else {
          // Force .cho download
          const folderName = folders.find(f => f.id === song.folderId)?.name || '';
          const content = buildChordProExport(song, folderName);
          const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${getExportFileName(song.title)}.cho`;
          link.click();
          URL.revokeObjectURL(url);
        }
      }
    } else {
      const zip = new JSZip();
      const selectedSongs = songs.filter(s => selectedSongIds.includes(s.id!));
      
      setImportProgress({ current: 0, total: selectedSongs.length, message: 'Preparando ZIP...' });

      for (let i = 0; i < selectedSongs.length; i++) {
        const song = selectedSongs[i];
        setImportProgress({ current: i + 1, total: selectedSongs.length, message: `Exportando: ${song.title}` });
        
        if (format === 'pdf') {
          const docObj = generatePDF([song], song.title, true) as jsPDF;
          zip.file(`${getExportFileName(song.title)}.pdf`, docObj.output('blob'));
        } else {
          zip.file(`${getExportFileName(song.title)}.cho`, buildChordProExport(song));
        }
      }
      
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Exportacao_${format.toUpperCase()}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      setImportProgress(null);
    }
  };

  const processFolderExport = async (folderId: string | null) => {
    const zip = new JSZip();
    const songsToExport = folderId 
      ? songs.filter(s => s.folderId === folderId)
      : songs;

    if (songsToExport.length === 0) {
      alert("Nenhuma música encontrada nesta pasta.");
      return;
    }

    setImportProgress({ current: 0, total: songsToExport.length, message: 'Preparando exportação...' });

    for (let i = 0; i < songsToExport.length; i++) {
      const song = songsToExport[i];
      setImportProgress({ current: i + 1, total: songsToExport.length, message: `Adicionando: ${song.title}` });

      if (song.pdfPages && song.pdfPages.length > 0) {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        song.pdfPages.forEach((url, idx) => {
          if (idx > 0) pdf.addPage();
          try { pdf.addImage(url, 'JPEG', 0, 0, pageWidth, pageHeight); } catch(e) {}
        });
        const pdfBlob = pdf.output('blob');
        zip.file(`${getExportFileName(song.title)}.pdf`, pdfBlob);
      } else {
        const folderName = folders.find(f => f.id === song.folderId)?.name || '';
        zip.file(`${getExportFileName(song.title)}.cho`, buildChordProExport(song, folderName));
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const folderName = folderId ? folders.find(f => f.id === folderId)?.name : 'Acervo_Completo';
    link.download = `${folderName}_Export.zip`;
    link.click();
    URL.revokeObjectURL(url);
    setImportProgress(null);
  };

  const buildRepertorioJson = (repertorio: any) => {
    const songReferences = (repertorio.songIds || [])
      .filter((id: string) => !String(id).startsWith('group:'))
      .map((id: string) => {
        const song = songs.find(item => item.id === id);
        return song ? { id: song.id, title: song.title, artist: song.artist } : { id, title: '', artist: '' };
      });

    return {
      id: repertorio.id,
      title: repertorio.title,
      date: repertorio.date || null,
      songIds: repertorio.songIds || [],
      songReferences,
      songKeys: repertorio.songKeys || {},
      songGroups: repertorio.songGroups || []
    };
  };

  const downloadRepertorioJson = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_') || 'Repertorio'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRepertorioJsonExport = (selection: { type: 'folder' | 'setlist'; id: string }) => {
    if (selection.type === 'folder') {
      const folder = folders.find(item => item.id === selection.id && item.type === 'repertorio');
      if (!folder) return;
      const folderSetlists = repertorios.filter(item => item.folderId === folder.id);
      const data = {
        format: 'recifra-repertory',
        version: 1,
        exportType: 'folder',
        folder: { name: folder.name },
        setlists: folderSetlists.map(buildRepertorioJson)
      };
      downloadRepertorioJson(data, folder.name);
      setIsRepertorioJsonExportModalOpen(false);
      return;
    }

    const repertorio = repertorios.find(item => item.id === selection.id);
    if (!repertorio) return;
    const data = {
      format: 'recifra-repertory',
      version: 1,
      exportType: 'setlist',
      setlist: buildRepertorioJson(repertorio)
    };
    downloadRepertorioJson(data, repertorio.title);
    setIsRepertorioJsonExportModalOpen(false);
  };

  const handleRepertorioJsonImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (event: any) => {
      const file = event.target.files?.[0];
      if (!file || !user) return;

      try {
        const data = JSON.parse(await file.text());
        if (data.format !== 'recifra-repertory' || data.version !== 1 || !['folder', 'setlist'].includes(data.exportType)) {
          throw new Error('Formato JSON do #semba inválido ou não suportado.');
        }

        const resolveSongIds = (source: any) => {
          const refs = Array.isArray(source.songReferences) ? source.songReferences : [];
          const idMap = new Map<string, string>();
          refs.forEach((ref: any) => {
            const match = songs.find(song => song.id === ref.id) || songs.find(song =>
              (song.title || '').trim().toLocaleLowerCase('pt-BR') === (ref.title || '').trim().toLocaleLowerCase('pt-BR') &&
              (song.artist || '').trim().toLocaleLowerCase('pt-BR') === (ref.artist || '').trim().toLocaleLowerCase('pt-BR')
            );
            if (match?.id && ref.id) idMap.set(ref.id, match.id);
          });

          const missing: string[] = [];
          const mappedSongIds = (source.songIds || []).map((entry: string) => {
            if (String(entry).startsWith('group:')) return entry;
            const ref = refs.find((item: any) => item.id === entry);
            const mapped = idMap.get(entry) || (songs.some(song => song.id === entry) ? entry : undefined);
            if (mapped) return mapped;
            if (ref?.title) missing.push(`${ref.title}${ref.artist ? ` (${ref.artist})` : ''}`);
            return null;
          }).filter(Boolean);

          const mappedKeys: Record<string, string> = {};
          Object.entries(source.songKeys || {}).forEach(([sourceId, key]) => {
            const mappedId = idMap.get(sourceId) || (songs.some(song => song.id === sourceId) ? sourceId : undefined);
            if (mappedId) mappedKeys[mappedId] = String(key);
          });

          const mappedGroups = (source.songGroups || []).map((group: any) => ({
            ...group,
            songIds: (group.songIds || []).map((songId: string) =>
              idMap.get(songId) || (songs.some(song => song.id === songId) ? songId : null)
            ).filter(Boolean)
          }));

          return { songIds: mappedSongIds, songKeys: mappedKeys, songGroups: mappedGroups, missing };
        };

        let importedCount = 0;
        let missingSongs: string[] = [];
        if (data.exportType === 'folder') {
          if (!data.folder?.name || !Array.isArray(data.setlists)) throw new Error('Estrutura de pasta inválida.');
          const folderRef = await addDoc(collection(db, 'folders'), {
            name: data.folder.name,
            type: 'repertorio',
            createdBy: user.uid,
            order: folders.filter(folder => folder.type === 'repertorio').length
          });
          for (const source of data.setlists) {
            const mapped = resolveSongIds(source);
            missingSongs = missingSongs.concat(mapped.missing);
            await addDoc(collection(db, 'setlists'), {
              title: source.title || 'Setlist importado',
              date: source.date || null,
              songIds: mapped.songIds,
              songKeys: mapped.songKeys,
              songGroups: mapped.songGroups,
              folderId: folderRef.id,
              createdBy: user.uid,
              updatedAt: new Date().toISOString()
            });
            importedCount++;
          }
        } else {
          if (!data.setlist?.title || !Array.isArray(data.setlist.songIds)) throw new Error('Estrutura de setlist inválida.');
          const source = data.setlist;
          const mapped = resolveSongIds(source);
          missingSongs = missingSongs.concat(mapped.missing);
          const newSetlist = {
            title: source.title,
            date: source.date || null,
            songIds: mapped.songIds,
            songKeys: mapped.songKeys,
            songGroups: mapped.songGroups,
            createdBy: user.uid,
            updatedAt: new Date().toISOString()
          };
          const docRef = await addDoc(collection(db, 'setlists'), newSetlist);
          setSelectedRepertorio({ id: docRef.id, ...newSetlist });
          importedCount = 1;
        }

        const missingMessage = missingSongs.length
          ? `\n\nMúsicas não localizadas e ignoradas: ${[...new Set(missingSongs)].join(', ')}`
          : '';
        alert(`${data.exportType === 'folder' ? `Pasta importada com ${importedCount} setlist(s)` : 'Setlist importado'} com sucesso.${missingMessage}`);
        setCurrentView('repertorios');
        setSidebarTab('repertorios');
      } catch (error) {
        console.error('Erro ao importar repertório JSON:', error);
        alert('Não foi possível importar o arquivo. Verifique se ele é um JSON válido exportado pelo #semba.');
      }
    };
    input.click();
  };

  const handleRepertorioSonglist = (repertorioToExport: any) => {
    if (!repertorioToExport) return;
    // Mantém a sequência do repertório e ignora os marcadores de blocos.
    const repertorioSongs = (repertorioToExport.songIds || [])
      .filter((id: string) => !String(id).startsWith('group:'))
      .map((id: string) => {
        const song = songs.find(item => item.id === id);
        if (!song) return null;
        // Aplica a tonalidade escolhida no set à cifra, não apenas ao cabeçalho do PDF.
        const selectedKey = repertorioToExport.songKeys?.[song.id] || song.key;
        const originalKey = song.key || detectKey(song.chordPro || '');
        const semitones = selectedKey && originalKey
          ? getSemitones(originalKey, selectedKey)
          : 0;
        const transposedChordPro = semitones !== 0
          ? transposeChordPro(song.chordPro || '', semitones)
          : (song.chordPro || '');
        return { ...song, key: selectedKey, chordPro: transposedChordPro };
      })
      .filter(Boolean) as Song[];

    if (repertorioSongs.length === 0) return;
    const pdf = generatePDF(repertorioSongs, repertorioToExport.title || 'Songlist', true) as jsPDF;
    pdf.save(`SONGLIST_${getExportFileName(repertorioToExport.title || 'Repertorio')}.pdf`);
  };

  const handleRepertorioPdfList = (repertorioToExport: any = selectedRepertorio) => {
    if (!repertorioToExport) return;
    const doc = new jsPDF();
    let y = 20;
    const songIds = repertorioToExport.songIds || [];
    const songGroups = repertorioToExport.songGroups || [];
    // Vocalistas são repertórios cadastrados dentro da pasta "VOCALISTAS".
    const vocalistFolderIds = new Set(
      folders
        .filter((folder: any) => (folder.name || '').trim().toLocaleUpperCase('pt-BR') === 'VOCALISTAS')
        .map((folder: any) => folder.id)
    );
    const vocalistRepertorios = repertorios.filter((rep: any) =>
      !!rep.folderId && vocalistFolderIds.has(rep.folderId)
    );
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(repertorioToExport.title.toUpperCase(), 20, y);
    
    if (repertorioToExport.date) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const dateDisplay = new Date(repertorioToExport.date + 'T12:00:00').toLocaleDateString('pt-BR');
      doc.text(dateDisplay, 190, y, { align: 'right' });
    }
    
    y += 12;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('#', 20, y);
    doc.text('Título / Artista', 30, y);
    doc.text('Tom', 120, y);
    doc.text('Vocalista(s)', 145, y);
    doc.text('Pasta', 172, y);
    
    y += 5;
    doc.setDrawColor(200, 200, 200);
    doc.line(20, y - 3, 190, y - 3);

    doc.setFont('helvetica', 'normal');
    let songCounter = 0;
    let blockCounter = 0;

    songIds.forEach((id: string) => {
      if (y > 285) {
        doc.addPage();
        y = 20;
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('#', 20, y);
        doc.text('Título / Artista', 30, y);
        doc.text('Tom', 120, y);
        doc.text('Vocalista(s)', 145, y);
        doc.text('Pasta', 172, y);
        
        y += 5;
        doc.line(20, y - 3, 190, y - 3);
        doc.setFont('helvetica', 'normal');
      }

      if (id.startsWith('group:')) {
        const groupId = id.replace('group:', '');
        const group = songGroups.find((g: any) => g.id === groupId);
        if (group) {
          blockCounter++;
          y += 2;
          doc.setFillColor(245, 248, 252);
          doc.rect(20, y - 4, 170, 6, 'F');
          
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(13, 71, 161);
          doc.setFontSize(9);
          doc.text(`${blockCounter}. ${group.title.toUpperCase()}`, 25, y);
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          y += 7;
        }
      } else {
        const song = songs.find(s => s.id === id);
        if (song) {
          songCounter++;
          
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text(`${songCounter}`, 20, y);
          
          doc.text(song.title.toUpperCase().substring(0, 50), 30, y);
          
          const selectedSongKey = repertorioToExport.songKeys?.[song.id] || song.key || '-';
          doc.setTextColor(13, 71, 161);
          doc.text(selectedSongKey, 120, y);
          doc.setTextColor(0, 0, 0);

          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          const songVocalistRepertorios = vocalistRepertorios.filter((rep: any) =>
            Array.isArray(rep.songIds) && rep.songIds.includes(song.id)
          );
          // O tom escolhido no setlist identifica o vocalista quando coincide
          // com a tonalidade cadastrada no repertório daquele vocalista.
          const matchingVocalists = songVocalistRepertorios.filter((rep: any) =>
            typeof rep.songKeys?.[song.id] === 'string' &&
            rep.songKeys[song.id].trim() === selectedSongKey
          );
          const identifiedVocalists = matchingVocalists.length > 0
            ? matchingVocalists
            : songVocalistRepertorios;
          const vocalistNames = [...new Set(
            identifiedVocalists.map((rep: any) => (rep.title || '').trim()).filter(Boolean)
          )];
          const vocalistLabel = vocalistNames.length > 0 ? vocalistNames.join(', ') : '-';
          doc.text(vocalistLabel.substring(0, 35), 145, y);
          const sourceFolderName = folders.find((folder: any) => folder.id === song.folderId)?.name || '-';
          doc.text(sourceFolderName.substring(0, 18), 172, y);          
          y += 4;
          doc.setFontSize(7);
          doc.setTextColor(100, 100, 100);
          const artistText = `${song.artist}${song.composition ? ` (${song.composition})` : ''}`.toUpperCase();
          doc.text(artistText.substring(0, 70), 30, y);
          doc.setTextColor(0, 0, 0);
          
          y += 5;
          doc.setFontSize(8);
        }
      }
    });

    doc.save(`SETLIST_${getExportFileName(repertorioToExport.title || 'Repertorio')}.pdf`);
  };

const primaryRed = [220, 38, 38]; // #dc2626
const handleRepertorioPdfFull = async () => {
    if (!selectedRepertorio) return;
    const items = selectedRepertorio.songIds.map((id: string) => songs.find(s => s.id === id)).filter(Boolean);
    setImportProgress({ current: 0, total: items.length, message: 'Gerando PDF completo...' });
    
    // We can use the refined generatePDF for this as well, but handleRepertorioPdfFull has specific setlist logic?
    // Actually generatePDF now contains the robust logic.
    generatePDF(items, selectedRepertorio.title);
    setImportProgress(null);
  };

  const handleIndividualImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.cho,.chordpro,.txt,.pdf';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      setPendingImportFile(file);
      setIsImportModalOpen(true);
    };
    input.click();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentView !== 'details' || isSidebarOpen || isCapturingKey) return;
      
      if (e.key === pedalConfig.next) {
        navigateRepertorio('next');
      } else if (e.key === pedalConfig.prev) {
        navigateRepertorio('prev');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView, isSidebarOpen, pedalConfig, selectedRepertorio, selectedSong]);

  const navigateRepertorio = (direction: 'next' | 'prev') => {
    if (!selectedSong) return;
    
    // Pagination logic
    if (direction === 'next' && currentPage < totalPages - 1) {
      setCurrentPage(prev => prev + 1);
      return;
    }
    if (direction === 'prev' && currentPage > 0) {
      setCurrentPage(prev => prev - 1);
      return;
    }

    if (!selectedRepertorio) return;
    
    const currentIndex = selectedRepertorio.songIds.indexOf(selectedSong.id!);
    if (currentIndex === -1) return;

    let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    
    if (nextIndex >= 0 && nextIndex < selectedRepertorio.songIds.length) {
      const nextId = selectedRepertorio.songIds[nextIndex];
      
      if (nextId.startsWith('group:')) {
        const groupId = nextId.replace('group:', '');
        const group = selectedRepertorio.songGroups?.find((g: any) => g.id === groupId);
        if (group) {
          setSelectedSong({
            id: nextId,
            title: group.title || 'Marcador de Bloco',
            artist: 'MARCADOR DE BLOCO',
            isGroup: true,
            groupData: group
          } as any);
          setTransposition(0);
          updateLiveSong(nextId);
          setCurrentPage(0);
          return;
        }
      }

      const nextSong = songs.find(s => s.id === nextId);
      if (nextSong) {
        setSelectedSong(nextSong);
        updateLiveSong(nextSong.id!);
        setCurrentPage(0);
      }
    }
  };

  const handlePageChange = (direction: 'next' | 'prev') => {
    if (direction === 'next' && currentPage < totalPages - 1) {
      setCurrentPage(prev => prev + 1);
    } else if (direction === 'prev' && currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleReorderSongs = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id || !selectedRepertorio) return;

    const originalIds: string[] = [...(selectedRepertorio.songIds || [])];
    const activeId = String(active.id);
    const overId = String(over.id);
    const oldIdx = originalIds.indexOf(activeId);
    const overIdx = originalIds.indexOf(overId);
    if (oldIdx < 0 || overIdx < 0) return;

    let finalNewSongIds = [...originalIds];
    const activeItem = sortableItemsData.find((item: any) => item.id === activeId);

    // Arrastar pelo marcador move o bloco inteiro, tanto para cima quanto para baixo.
    if (activeItem?.type === 'group_handle') {
      let endIdx = oldIdx + 1;
      while (endIdx < originalIds.length && !originalIds[endIdx].startsWith('group:')) endIdx++;
      const blockChunk = originalIds.slice(oldIdx, endIdx);
      if (overIdx >= oldIdx && overIdx < endIdx) return;

      const remaining = [...originalIds.slice(0, oldIdx), ...originalIds.slice(endIdx)];
      let anchorId = overId;

      // Se o destino for uma música, ancora no marcador do bloco a que ela pertence.
      if (!anchorId.startsWith('group:')) {
        let destinationMarkerIndex = -1;
        for (let i = 0; i < overIdx; i++) {
          if (originalIds[i].startsWith('group:') && !(i >= oldIdx && i < endIdx)) {
            destinationMarkerIndex = i;
          }
        }
        if (destinationMarkerIndex >= 0) anchorId = originalIds[destinationMarkerIndex];
      }

      const anchorIndex = remaining.indexOf(anchorId);
      if (anchorIndex < 0) return;

      // A posição relativa do ponteiro define antes/depois do bloco-alvo.
      // A correção explícita do índice após remover o bloco evita a falha ao mover para baixo.
      const activeRect = active.rect.current.translated;
      const overRect = over.rect;
      const activeCenterY = activeRect ? activeRect.top + activeRect.height / 2 : null;
      const overCenterY = overRect ? overRect.top + overRect.height / 2 : null;
      const movingDown = oldIdx < overIdx;
      const insertAfter = activeCenterY !== null && overCenterY !== null
        ? activeCenterY > overCenterY
        : movingDown;

      let insertionIndex = anchorIndex + (insertAfter ? 1 : 0);
      // Ao soltar sobre o marcador de um bloco abaixo, inserir após o bloco-alvo
      // mantém seus itens juntos, sem intercalar os dois blocos.
      if (insertAfter && anchorId.startsWith('group:')) {
        insertionIndex = anchorIndex + 1;
        while (insertionIndex < remaining.length && !remaining[insertionIndex].startsWith('group:')) insertionIndex++;
      }
      finalNewSongIds = [...remaining.slice(0, insertionIndex), ...blockChunk, ...remaining.slice(insertionIndex)];
    } else {
      // Arrastar pelo marcador da música move somente aquela música.
      // Soltar diretamente sobre um marcador posiciona a música dentro do bloco.
      if (overId.startsWith('group:')) {
        finalNewSongIds = originalIds.filter(id => id !== activeId);
        const markerIndex = finalNewSongIds.indexOf(overId);
        if (markerIndex < 0) return;

        // Diferencia soltar acima ou abaixo do marcador que foi detectado.
        // Acima do marcador significa fim do bloco anterior; abaixo significa
        // início do bloco identificado pelo marcador. Isso evita que uma música
        // solta após a última faixa de um bloco salte para o bloco seguinte.
        const activeRect = active.rect.current.translated;
        const overRect = over.rect;
        const activeCenterY = activeRect
          ? activeRect.top + activeRect.height / 2
          : null;
        const overCenterY = overRect
          ? overRect.top + overRect.height / 2
          : null;
        const insertAfterMarker = activeCenterY !== null && overCenterY !== null
          ? activeCenterY >= overCenterY
          : true;
        const insertionIndex = markerIndex + (insertAfterMarker ? 1 : 0);
        finalNewSongIds.splice(insertionIndex, 0, activeId);
      } else {
        // Sobre outra música, preserva a lógica natural de ordenação: a música
        // pode ficar antes ou depois do destino conforme a direção do arrasto.
        finalNewSongIds = arrayMove(originalIds, oldIdx, overIdx);
      }
    }

    try {
      const updatedRepertorio = { ...selectedRepertorio, songIds: finalNewSongIds };
      setSelectedRepertorio(updatedRepertorio);
      setRepertorios(prev => prev.map(r => r.id === selectedRepertorio.id ? updatedRepertorio : r));
      await updateDoc(doc(db, 'setlists', selectedRepertorio.id), {
        songIds: finalNewSongIds,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error reordering items:', error);
      setSelectedRepertorio(selectedRepertorio);
      handleFirestoreError(error, OperationType.WRITE, 'setlists');
    }
  };

  const handleCreateBlock = async () => {
    if (!selectedRepertorio) return;
    
    const newGroupId = `group-${Date.now()}`;
    const newGroups = [...(selectedRepertorio.songGroups || [])];
    const newSongIds = [...(selectedRepertorio.songIds || [])];
    
    const newGroup = {
      id: newGroupId,
      title: `Novo Bloco`,
      songIds: []
    };
    
    newGroups.push(newGroup);

    // Insert group handle marker into songIds
    let insertIdx = newSongIds.length;
    if (selectedSongIdForAction) {
      const idx = newSongIds.indexOf(selectedSongIdForAction);
      if (idx !== -1) insertIdx = idx;
    }
    
    newSongIds.splice(insertIdx, 0, `group:${newGroupId}`);

    try {
      const setlistRef = doc(db, 'setlists', selectedRepertorio.id);
      await updateDoc(setlistRef, { 
        songIds: newSongIds,
        songGroups: newGroups,
        updatedAt: new Date().toISOString() 
      });
      setSelectedRepertorio({ ...selectedRepertorio, songIds: newSongIds, songGroups: newGroups });
      setSelectedSongIdForAction(null); // Reset selection
    } catch (error) {
       console.error('Error creating block:', error);
    }
  };

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortableItemsData = useMemo(() => {
    if (!selectedRepertorio) return [];
    const items: any[] = [];
    const songIds = selectedRepertorio.songIds || [];
    const groups = selectedRepertorio.songGroups || [];
    let songCounter = 1;
    let blockCounter = 1;

    songIds.forEach((id: string) => {
      if (id.startsWith('group:')) {
        const gid = id.split(':')[1];
        const group = groups.find((g: any) => g.id === gid);
        if (group) items.push({ id, type: 'group_handle', group, displayIndex: blockCounter++ });
      } else {
        items.push({ id, type: 'song', index: songCounter++ });
      }
    });
    return items;
  }, [selectedRepertorio?.songIds, selectedRepertorio?.songGroups]);

  const sortableIds = useMemo(() => sortableItemsData.map(item => item.id), [sortableItemsData]);

  const handleUpdateGroupTitle = async (groupId: string, newTitle: string) => {
    if (!selectedRepertorio) return;
    const newGroups = (selectedRepertorio.songGroups || []).map((g: any) => 
      g.id === groupId ? { ...g, title: newTitle } : g
    );
    try {
      const setlistRef = doc(db, 'setlists', selectedRepertorio.id);
      await updateDoc(setlistRef, {
        songGroups: newGroups,
        updatedAt: new Date().toISOString()
      });
      const updated = { ...selectedRepertorio, songGroups: newGroups };
      setSelectedRepertorio(updated);
      setRepertorios(prev => prev.map(r => r.id === selectedRepertorio.id ? updated : r));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'setlists');
    }
  };

  const handleUngroupSong = async (songId: string, groupId: string) => {
    if (!selectedRepertorio) return;
    const group = selectedRepertorio.songGroups?.find((g: any) => g.id === groupId);
    if (!group) return;

    const newSongIdsInGroup = group.songIds.filter((id: string) => id !== songId);
    let newGroups = selectedRepertorio.songGroups || [];

    if (newSongIdsInGroup.length < 2) {
      // Dissolve group if only 1 song left
      newGroups = newGroups.filter((g: any) => g.id !== groupId);
    } else {
      newGroups = newGroups.map((g: any) => 
        g.id === groupId ? { ...g, songIds: newSongIdsInGroup } : g
      );
    }

    try {
      const setlistRef = doc(db, 'setlists', selectedRepertorio.id);
      await updateDoc(setlistRef, {
        songGroups: newGroups,
        updatedAt: new Date().toISOString()
      });
      const updated = { ...selectedRepertorio, songGroups: newGroups };
      setSelectedRepertorio(updated);
      setRepertorios(prev => prev.map(r => r.id === selectedRepertorio.id ? updated : r));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'setlists');
    }
  };

  const handleReorderSongsInsideGroup = async (groupId: string, activeId: string, overId: string) => {
    if (!selectedRepertorio) return;
    const group = selectedRepertorio.songGroups?.find((g: any) => g.id === groupId);
    if (!group) return;

    const oldIndex = group.songIds.indexOf(activeId);
    const newIndex = group.songIds.indexOf(overId);
    const newSongIdsInGroup = arrayMove(group.songIds, oldIndex, newIndex);

    const newGroups = selectedRepertorio.songGroups?.map((g: any) => 
      g.id === groupId ? { ...g, songIds: newSongIdsInGroup } : g
    );

    // Also need to adjust the master songIds order to match the visual order
    const masterSongIds = [...selectedRepertorio.songIds];
    // This is trickier: find where the group songs are and replace them
    const groupSongsInMaster = masterSongIds.filter(id => group.songIds.includes(id));
    const firstIndex = masterSongIds.indexOf(groupSongsInMaster[0]);
    
    const filteredMaster = masterSongIds.filter(id => !group.songIds.includes(id));
    filteredMaster.splice(firstIndex, 0, ...newSongIdsInGroup);

    try {
      const setlistRef = doc(db, 'setlists', selectedRepertorio.id);
      await updateDoc(setlistRef, {
        songIds: filteredMaster,
        songGroups: newGroups,
        updatedAt: new Date().toISOString()
      });
      const updated = { ...selectedRepertorio, songIds: filteredMaster, songGroups: newGroups };
      setSelectedRepertorio(updated);
      setRepertorios(prev => prev.map(r => r.id === selectedRepertorio.id ? updated : r));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'setlists');
    }
  };

  const downloadSongFile = (song: Song) => {
    if (song.pdfPages && song.pdfPages.length > 0) {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      song.pdfPages.forEach((url, i) => {
        if (i > 0) pdf.addPage();
        try {
          pdf.addImage(url, 'JPEG', 0, 0, pageWidth, pageHeight);
        } catch (err) {
          console.error("Error adding image to PDF:", err);
        }
      });
      pdf.save(`${song.title} - ${song.artist}.pdf`);
    } else {
      const folderName = folders.find(f => f.id === song.folderId)?.name || '';
      const content = buildChordProExport(song, folderName);
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${getExportFileName(song.title)}.cho`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const shareContent = async (song: Song) => {
    shareAsPDF([song], song.title);
    setIsSharePopoverOpen(false);
  };

  const filteredSongs = useMemo(() => {
    const normalizedTerm = normalizeSearchText(searchTerm.trim());
    let result = songs.filter(s => {
      if (activeSongFolderId && s.folderId !== activeSongFolderId) return false;
      if (!normalizedTerm) return true;
      return (
        normalizeSearchText(s.title).includes(normalizedTerm) ||
        normalizeSearchText(s.artist).includes(normalizedTerm) ||
        normalizeSearchText(s.composition).includes(normalizedTerm) ||
        normalizeSearchText(s.category).includes(normalizedTerm) ||
        // Pesquisa no texto musical como ele aparece no ChordOver:
        // remove cifras entre colchetes e diretivas ChordPro antes de comparar.
        normalizeSearchText(
          (s.chordPro || '')
            .replace(/\[[^\]]*\]/g, '')
            .replace(/\{[^}]*\}/g, ' ')
            .replace(/\s+/g, ' ')
        ).includes(normalizedTerm)
      );
    });

    if (filterKey) {
      result = result.filter(s => s.key === filterKey);
    }
    if (filterTempo) {
      result = result.filter(s => s.tempo === filterTempo);
    }
    if (filterCategory) {
      result = result.filter(s => s.category === filterCategory);
    }

    result.sort((a: any, b: any) => {
      if (sortBy === 'updatedAt') {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      const valA = (a[sortBy] || '').toString().toLowerCase();
      const valB = (b[sortBy] || '').toString().toLowerCase();
      return valA.localeCompare(valB);
    });

    return result;
  }, [songs, searchTerm, sortBy, filterKey, filterTempo, filterCategory, activeSongFolderId]);

  const songsInActiveContext = useMemo(() => {
    if (activeSongFolderId || searchTerm) return filteredSongs;
    if (expandedFolders.length > 0) {
      if (expandedFolders.includes('all')) return filteredSongs;
      return filteredSongs.filter(s => s.folderId && expandedFolders.includes(s.folderId));
    }
    return filteredSongs.filter(s => !s.folderId);
  }, [searchTerm, filteredSongs, expandedFolders, activeSongFolderId]);

  const filteredRepertorios = useMemo(() => {
    return repertorios.filter(s => 
      s.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [repertorios, searchTerm]);

  const allKeys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  // A lista do seletor acompanha o modo da tonalidade original: maior ou menor.
  const songKeyOptions = selectedSong?.key?.endsWith('m')
    ? allKeys.map(k => `${k}m`)
    : allKeys;

  // Vocalistas identificados pelo título dos repertórios que contêm esta música
  // e possuem uma tonalidade específica cadastrada para ela.
  const vocalistKeyOptions = useMemo(() => {
    if (!selectedSong?.id) return [];
    // Somente repertórios vinculados à pasta/seção "VOCALISTAS".
    // O título do repertório continua sendo o nome exibido do vocalista.
    const vocalistFolderIds = new Set(
      folders
        .filter(folder => (folder.name || '').trim().toLocaleUpperCase('pt-BR') === 'VOCALISTAS')
        .map(folder => folder.id)
    );
    return repertorios
      .filter(rep =>
        !!rep.folderId &&
        vocalistFolderIds.has(rep.folderId) &&
        Array.isArray(rep.songIds) &&
        rep.songIds.includes(selectedSong.id) &&
        typeof rep.songKeys?.[selectedSong.id] === 'string' &&
        rep.songKeys[selectedSong.id].trim() !== ''
      )
      .map(rep => ({
        id: rep.id || rep.title,
        name: rep.title || 'Vocalista sem identificação',
        key: rep.songKeys[selectedSong.id]
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [repertorios, folders, selectedSong?.id]);
  
  const handleKeySelect = async (targetKey: string) => {
    if (!selectedSong) return;
    const diff = getSemitones(selectedSong.key, targetKey);
    
    // 1. Atualizar visualmente IMEDIATAMENTE (Feedback Instantâneo)
    setTransposition(diff);
    setIsKeyPickerOpen(false);

    // 2. Se estiver em modo Repertório, salvar no banco
    if (sidebarView === 'repertorio-songs' && selectedRepertorio && selectedSong.id) {
      // Registrar timestamp para bloquear o sync do Firebase por 10s
      lastKeyUpdateRef.current = { time: Date.now(), id: selectedSong.id };
      
      const newSongKeys = { 
        ...(selectedRepertorio.songKeys || {}), 
        [selectedSong.id]: targetKey 
      };

      // Atualizar estado local do repertório para consistência imediata
      setSelectedRepertorio(prev => prev ? { ...prev, songKeys: newSongKeys } : null);

      try {
        const repRef = doc(db, 'setlists', selectedRepertorio.id);
        await updateDoc(repRef, { 
          songKeys: newSongKeys,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.error("Erro ao salvar tom no banco:", error);
      }
    }
  };

  // A escolha por vocalista é sempre temporária: não altera songKeys nem o Firestore.
  const handleVocalistKeySelect = (targetKey: string) => {
    if (!selectedSong) return;
    setTransposition(getSemitones(selectedSong.key, targetKey));
    setIsKeyPickerOpen(false);
  };

  // Qualquer saída da página de execução descarta a transposição temporária.
  useEffect(() => {
    if (currentView !== 'details') {
      setTransposition(0);
      setIsKeyPickerOpen(false);
    }
  }, [currentView]);

  const currentKey = useMemo(() => {
    if (!selectedSong) return '';
    const isMinor = selectedSong.key?.endsWith('m') || false;
    const sourceRoot = (selectedSong.key || '').replace(/m$/, '');
    const sourceIndex = allKeys.indexOf(sourceRoot);
    if (sourceIndex === -1) return selectedSong.key;
    const targetIndex = (sourceIndex + transposition + 12) % 12;
    return `${allKeys[targetIndex]}${isMinor ? 'm' : ''}`;
  }, [selectedSong, transposition]);

  if (!user) {
    return (
      <div className="min-h-screen bg-bg text-text-main flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <h1 className="mb-2 flex justify-center">
            <img src={SEMBA_LOGO_SRC} alt="#semba — O palco aos seus pés" className="h-14 w-auto max-w-full object-contain" />
          </h1>
          <p className="text-text-dim mb-12">Gestão de repertório para o palco.</p>
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-primary hover:bg-[#1565c0] text-white py-4 px-6 rounded-xl font-bold transition-all active:scale-95"
          >
            <LogIn size={20} />
            Login rápido com Google
          </button>
        </motion.div>
      </div>
    );
  }

  if (user && appUser?.status === 'pending') {
    return (
      <div className="min-h-screen bg-bg text-text-main flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full p-8 bg-surface border border-border rounded-2xl"
        >
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
            <Radio className="animate-pulse" size={32} />
          </div>
          <h1 className="text-3xl font-bold mb-4 tracking-tighter">Aguardando Aprovação</h1>
          <p className="text-text-dim mb-8">
            Seu cadastro foi realizado com sucesso! Para garantir a segurança do repertório, um **Maestro** precisa autorizar seu acesso e definir seu perfil.
          </p>
          <div className="bg-bg/50 p-4 rounded-xl border border-border/50 text-sm text-text-dim text-left mb-8">
            <p className="font-bold text-text-main mb-1 uppercase tracking-widest text-[10px]">Próximos passos:</p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Notifique um maestro responsável pela banda.</li>
              <li>Aguarde a liberação do seu perfil como Músico ou Maestro.</li>
              <li>A atualização é automática nesta tela.</li>
            </ul>
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="w-full flex items-center justify-center gap-2 text-text-dim hover:text-red-400 transition-colors py-2 font-medium"
          >
            <LogOut size={18} /> Sair da conta
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text-main font-sans selection:bg-primary selection:text-white flex justify-center overflow-hidden">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 z-[150] backdrop-blur-[4px]"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={{ x: '-100%' }}
        animate={{ x: isSidebarOpen ? 0 : '-100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed top-0 left-0 bottom-0 w-80 bg-bg border-r border-border z-[200] flex flex-col"
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            {sidebarView === 'repertorio-songs' && (
              <button 
                onClick={() => {
                  setSidebarView('tabs');
                  setSelectedSongIdForAction(null);
                  setSelectedRepertorio(null);
                  setTransposition(0);
                }}
                className="p-2 -ml-2 hover:bg-surface rounded-full text-primary"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="flex items-center">
              <img src={SEMBA_LOGO_SRC} alt="#semba" className="h-9 w-auto max-w-full object-contain" />
            </div>
          </div>
          <div className="flex items-center gap-1.5" ref={dropdownRef}>

            <div className="w-px h-4 bg-border mx-1 translate-y-1" />

            {isSelectionMode ? (
              <button 
                onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedSongIds([]);
                  setSelectedRepIds([]);
                }}
                className="p-2 bg-[#0D47A1] text-white rounded-full hover:scale-110 active:scale-95 transition-all"
                title="Sair da Seleção"
              >
                <X size={18} />
              </button>
            ) : (
              <button 
                onClick={() => setIsSidebarOpen(false)} 
                className="p-2 hover:bg-surface rounded-full text-text-dim translate-y-1"
                title="Fechar"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        <nav className="p-2 border-b border-border bg-[#0D47A1] flex justify-around">
          <SidebarNavItem 
            icon={<Music size={18} />} 
            label="Músicas" 
            tooltip="Consulte, pesquise e organize seu acervo musical."
            active={sidebarTab === 'songs'} 
            onClick={() => {
              setSidebarTab('songs');
              setSidebarView('tabs');
              setCurrentView('list');
              setSelectedRepertorio(null);
              setTransposition(0);
              setSelectedSongIds([]);
              setIsSelectionMode(false);
            }} 
          />
          <SidebarNavItem 
            icon={<ListMusic size={18} />} 
            label="Repertórios" 
            tooltip="Monte e gerencie listas de músicas para apresentações."
            active={sidebarTab === 'repertorios'} 
            onClick={() => {
              setSidebarTab('repertorios');
              setSidebarView('tabs');
              setCurrentView('repertorios');
              setSelectedRepertorio(null);
              setTransposition(0);
              setSelectedSongIds([]);
              setIsSelectionMode(false);
            }} 
          />
          <SidebarNavItem 
            icon={<LayoutList size={18} />} 
            label="Blocos" 
            tooltip="Organize músicas em blocos para orientar a execução."
            active={sidebarTab === 'blocks'} 
            onClick={() => {
              setSidebarTab('blocks');
              setSidebarView('tabs');
              setSelectedRepertorio(null);
              setTransposition(0);
              setCurrentView('blocks');
              setSelectedSongIds([]);
              setIsSelectionMode(false);
            }} 
          />
          <SidebarNavItem
            icon={<Mic size={18} />}
            label="Palco"
            tooltip={isMaestroActive || followLeader ? "Desativar Modo Palco." : "Ativar ou acompanhar o Modo Palco."}
            active={isMaestroActive || followLeader}
            activeColorOverride="text-[#ff6900]"
            showActiveIndicator={false}
            onClick={togglePalco}
          />
        </nav>

        <div className={`px-4 pb-2 ${sidebarTab === 'songs' ? 'pt-4 space-y-2' : 'pt-4 space-y-4'}`}>
          {sidebarTab === 'songs' && activeSongFolderId && (() => {
            const activeFolder = folders.find(folder => folder.id === activeSongFolderId);
            if (!activeFolder) return null;
            return (
              <div
                role="button"
                tabIndex={0}
                onClick={() => { setActiveSongFolderId(null); setSearchTerm(''); setExpandedFolders([]); }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setActiveSongFolderId(null);
                    setSearchTerm('');
                    setExpandedFolders([]);
                  }
                }}
                aria-label="Voltar para todas as pastas"
                title="Voltar para todas as pastas"
                className="flex items-center gap-3 min-h-[48px] px-3 py-2 rounded-xl bg-[#EEF1F5] border border-[#DCE3EC] cursor-pointer hover:bg-[#E7ECF3] active:scale-[0.99] transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#174EA6]"
              >
                <span className="shrink-0 p-1 text-[#174EA6] rounded-lg" aria-hidden="true"><ArrowLeft size={19} /></span>
                <FolderOpen size={20} className="shrink-0 text-[#174EA6]" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-black uppercase tracking-[0.06em] text-black">{activeFolder.name}</span>
                <span className="shrink-0 text-[10px] min-w-[22px] h-[20px] px-1.5 bg-[#174EA6] rounded-md text-white font-bold flex items-center justify-center tabular-nums">{songs.filter(song => song.folderId === activeSongFolderId).length}</span>
              </div>
            );
          })()}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={16} />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => {
                const value = e.target.value;
                setSearchTerm(value);
                if (!activeSongFolderId) setExpandedFolders(value.trim() ? ['all'] : []);
              }}
              className={`w-full bg-white border border-[#D1D5DB] rounded-lg py-2 pl-9 ${sidebarTab === 'songs' && (activeSongFolderId || expandedFolders.length > 0 || searchTerm) ? 'pr-[82px]' : 'pr-10'} text-sm focus:ring-1 focus:ring-[#D1D5DB] outline-none text-[#666666] placeholder:text-[#B8BEC8]`}
            />
            {sidebarTab === 'songs' && (activeSongFolderId || expandedFolders.length > 0 || searchTerm) && (
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => { setIsFilterActive(false); setIsSortMenuOpen(prev => !prev); }}
                  aria-label="Ordenar músicas"
                  aria-haspopup="menu"
                  aria-expanded={isSortMenuOpen}
                  title={`Ordenar por: ${{ title: 'Título', composition: 'Composição', artist: 'Artista', updatedAt: 'Modificação' }[sortBy]}`}
                  className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${isSortMenuOpen ? 'bg-[#EEF4FF] text-[#174EA6]' : 'text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#666666]'}`}
                >
                  <ArrowUpDown size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => { setIsSortMenuOpen(false); setIsFilterActive(prev => !prev); }}
                  aria-label="Filtrar músicas"
                  aria-haspopup="dialog"
                  aria-expanded={isFilterActive}
                  title="Filtros"
                  className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${isFilterActive ? 'bg-[#EEF4FF] text-[#174EA6]' : 'text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#666666]'}`}
                >
                  <Filter size={16} />
                </button>
              </div>
            )}
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                aria-label="Limpar busca"
                className={`absolute top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#666666] transition-colors ${sidebarTab === 'songs' && (activeSongFolderId || expandedFolders.length > 0 || searchTerm) ? 'right-[86px]' : 'right-3'}`}
              >
                <X size={16} />
              </button>
            )}

            <AnimatePresence>
              {isSortMenuOpen && sidebarTab === 'songs' && (activeSongFolderId || expandedFolders.length > 0 || searchTerm) && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.12 }}
                  role="menu"
                  className="absolute right-10 top-full mt-1.5 z-[90] min-w-[190px] overflow-hidden rounded-xl border border-[#D1D5DB] bg-white shadow-xl shadow-black/10 [&_svg]:!text-[#174EA6]"
                >
                  <div className="flex items-center justify-between gap-2.5 border-b border-[#E5E7EB] px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <ArrowUpDown size={15} className="text-[#666666]" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#111827]">ORDENAR POR</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSortMenuOpen(false)}
                      aria-label="Fechar menu de ordenação"
                      title="Fechar"
                      className="h-7 w-7 flex items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#666666] transition-colors"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <div className="py-1">
                  {([
                    { value: 'title', label: 'Título', Icon: Type },
                    { value: 'composition', label: 'Composição', Icon: FileText },
                    { value: 'artist', label: 'Artista', Icon: UserIcon },
                    { value: 'updatedAt', label: 'Modificação', Icon: RotateCw },
                  ] as const).map((item, index) => (
                    <React.Fragment key={item.value}>
                      {index > 0 && <div className="mx-2 border-t border-[#E5E7EB]" />}
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={sortBy === item.value}
                        onClick={() => { setSortBy(item.value); setIsSortMenuOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide transition-colors ${sortBy === item.value ? 'bg-[#EEF4FF] text-[#174EA6]' : 'text-[#111827] hover:bg-[#F3F4F6]'}`}
                      >
                        <item.Icon size={14} className={sortBy === item.value ? 'text-[#174EA6]' : 'text-[#9CA3AF]'} />
                        <span className="flex-1">{item.label}</span>
                        {sortBy === item.value && <Check size={13} className="text-[#174EA6]" />}
                      </button>
                    </React.Fragment>
                  ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isFilterActive && sidebarTab === 'songs' && (activeSongFolderId || expandedFolders.length > 0 || searchTerm) && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.12 }}
                  role="dialog"
                  aria-label="Filtros de músicas"
                  className="absolute right-0 top-full mt-1.5 z-[90] w-[min(250px,calc(100vw-48px))] overflow-hidden rounded-xl border border-[#D1D5DB] bg-white p-2 shadow-xl shadow-black/10 [&_svg]:!text-[#174EA6]"
                >
                  <div className="flex items-center justify-between gap-2 px-2 pb-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#666666]">
                      <Filter size={14} className="text-[#9CA3AF]" /> Filtros
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsFilterActive(false)}
                      aria-label="Fechar menu de filtros"
                      title="Fechar"
                      className="h-7 w-7 flex items-center justify-center rounded-md text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#666666] transition-colors"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <div className="border-t border-[#E5E7EB]" />
                  <label className="flex items-center gap-2 px-2 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[#666666]"><Hash size={13} className="text-[#9CA3AF]" /> Tonalidade</label>
                  <select
                    value={filterKey}
                    onChange={(e) => setFilterKey(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#D1D5DB] bg-white px-2.5 py-2 text-xs text-[#111827] outline-none focus:border-[#9CA3AF]"
                  >
                    <option value="">Todas as tonalidades</option>
                    {allKeys.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <div className="mx-1 my-2 border-t border-[#E5E7EB]" />
                  <label className="flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-[#666666]"><Hourglass size={13} className="text-[#9CA3AF]" /> Andamento</label>
                  <select
                    value={filterTempo}
                    onChange={(e) => setFilterTempo(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#D1D5DB] bg-white px-2.5 py-2 text-xs text-[#111827] outline-none focus:border-[#9CA3AF]"
                  >
                    <option value="">Todos os andamentos</option>
                    <option value="Lento">Lento</option>
                    <option value="Moderado">Moderado</option>
                    <option value="Rápido">Rápido</option>
                  </select>
                  <div className="mx-1 my-2 border-t border-[#E5E7EB]" />
                  <label className="flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-[#666666]"><Tag size={13} className="text-[#9CA3AF]" /> Categoria</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#D1D5DB] bg-white px-2.5 py-2 text-xs text-[#111827] outline-none focus:border-[#9CA3AF]"
                  >
                    <option value="">Todas as categorias</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  {(filterKey || filterTempo || filterCategory) && (
                    <>
                      <div className="mx-1 my-2 border-t border-[#E5E7EB]" />
                      <button
                        type="button"
                        onClick={() => { setFilterKey(''); setFilterTempo(''); setFilterCategory(''); }}
                        className="w-full rounded-lg px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-[#666666] hover:bg-[#F3F4F6]"
                      >Limpar filtros</button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sidebarView === 'tabs' ? (
            <>
          {sidebarTab === 'songs' && (
                <div className="space-y-0">
                  <div className="sticky top-0 z-30 bg-bg pt-0">
                    {isSelectionMode && isDesktop && (
                      <button 
                        onClick={() => {
                          const allIdsInContext = songsInActiveContext.map(s => s.id!);
                          const allSelected = allIdsInContext.every(id => selectedSongIds.includes(id));
                          
                          if (allSelected) {
                            setSelectedSongIds(prev => prev.filter(id => !allIdsInContext.includes(id)));
                          } else {
                            setSelectedSongIds(prev => {
                              const newIds = [...prev];
                              allIdsInContext.forEach(id => {
                                if (!newIds.includes(id)) newIds.push(id);
                              });
                              return newIds;
                            });
                          }
                        }}
                        className="w-full flex items-center justify-between p-3 mb-2 bg-surface border border-border rounded-xl text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/5 transition-all shadow-md"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 border-2 rounded flex items-center justify-center transition-all ${
                            songsInActiveContext.length > 0 && songsInActiveContext.every(s => selectedSongIds.includes(s.id!)) 
                            ? 'bg-primary border-primary' 
                            : 'border-border'
                          }`}>
                            {songsInActiveContext.length > 0 && songsInActiveContext.every(s => selectedSongIds.includes(s.id!)) && <CheckSquare size={10} className="text-white" />}
                          </div>
                          <span>
                            {songsInActiveContext.length > 0 && songsInActiveContext.every(s => selectedSongIds.includes(s.id!)) 
                              ? 'Deselecionar Contexto' 
                              : searchTerm 
                                ? 'Selecionar Resultados' 
                                : expandedFolders.length > 0 
                                  ? 'Selecionar Tudo na Pasta' 
                                  : 'Selecionar Músicas da Raiz'}
                          </span>
                        </div>
                        <span className="text-text-dim">
                          {songsInActiveContext.filter(s => selectedSongIds.includes(s.id!)).length} / {songsInActiveContext.length}
                        </span>
                      </button>
                    )}
                  </div>

                  {activeSongFolderId && (
                    <div className="space-y-1 px-1 pt-1">
                      {filteredSongs.length === 0 ? (
                        <div className="px-3 py-5 text-center text-[10px] font-bold uppercase tracking-widest text-text-dim">Nenhuma música encontrada nesta pasta</div>
                      ) : filteredSongs.map(song => (
                        <SongSidebarItem
                          isMobile={!isDesktop}
                          key={song.id}
                          song={song}
                          isSelectionMode={isSelectionMode}
                          isSelected={selectedSongIds.includes(song.id!)}
                          onToggleSelect={() => setSelectedSongIds(prev => prev.includes(song.id!) ? prev.filter(id => id !== song.id) : [...prev, song.id!])}
                          onLongPress={() => { if (!isMaestro) return; setIsSelectionMode(true); setSelectedSongIds([song.id!]); }}
                          onDownload={() => downloadSongFile(song)}
                          onListPDF={() => generatePDF([song], song.title || 'Música')}
                          onShare={() => shareAsPDF([song], song.title || 'Música')}
                          onMove={() => { setSelectedSongIdForAction(song.id!); setIsMovingSingleSong(true); }}
                          isMaestro={isMaestro}
                          onDelete={() => deleteSong(song.id!)}
                          onClick={() => {
                            if (isSelectionMode) {
                              setSelectedSongIds(prev => prev.includes(song.id!) ? prev.filter(id => id !== song.id) : [...prev, song.id!]);
                            } else {
                              setSelectedSong(song);
                              setCurrentView('details');
                              setIsSidebarOpen(false);
                              updateLiveSong(song.id!);
                            }
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* TODAS Folder — shown only in the archive root */}
                  {!activeSongFolderId && <div className={`relative mx-2 mt-2 mb-2 border border-[#ECEDEF] rounded-[14px] overflow-visible bg-[#EEF1F5] ${openArchiveMenu === 'all' ? 'z-[999]' : 'z-0'}`}>
                    <div className={`w-full min-h-[48px] flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#EEF1F5] transition-colors ${expandedFolders.includes('all') ? 'rounded-t-[13px]' : 'rounded-[13px]'}`}>
                    <button type="button"
                      onClick={() => setExpandedFolders(prev => prev.includes('all') ? [] : ['all'])}
                      className="flex flex-1 min-w-0 items-center justify-between gap-3 text-left"
                    >
                      <div className="flex w-full min-w-0 items-center gap-3">
                        {!isDesktop && isSelectionMode ? (
                          <span
                            role="checkbox"
                            aria-checked={filteredSongs.length > 0 && filteredSongs.every(song => selectedSongIds.includes(song.id!))}
                            onClick={(event) => {
                              event.stopPropagation();
                              const ids = filteredSongs.map(song => song.id!);
                              const allSelected = ids.length > 0 && ids.every(id => selectedSongIds.includes(id));
                              setSelectedSongIds(prev => allSelected ? prev.filter(id => !ids.includes(id)) : Array.from(new Set([...prev, ...ids])));
                            }}
                            className="flex h-6 w-6 shrink-0 items-center justify-center text-[#174EA6]"
                            title="Selecionar ou desmarcar todas as músicas"
                          >
                            {filteredSongs.length > 0 && filteredSongs.every(song => selectedSongIds.includes(song.id!)) ? <CheckSquare size={21} /> : <Square size={21} />}
                          </span>
                        ) : <FolderIcon size={16} fill="currentColor" className="text-[#174EA6]" />}
                        <span className="min-w-0 flex-1 text-left text-[13px] font-bold uppercase tracking-[0.08em] text-black">TODAS</span>
                        <span className="ml-auto text-[10px] min-w-[18px] h-[18px] px-1 bg-[#174EA6] rounded-[4px] text-white font-bold flex items-center justify-center tabular-nums">{filteredSongs.length}</span>
                      </div>
                    </button>
                    <div data-archive-menu-root className="relative shrink-0" onClick={e => e.stopPropagation()}>
                      <button type="button" aria-label="Ações de todas as músicas" onClick={() => setOpenArchiveMenu(openArchiveMenu === 'all' ? null : 'all')} className="p-1.5 text-[#666666] hover:bg-white rounded-md transition-colors"><MoreVertical size={18}/></button>
                      {openArchiveMenu === 'all' && <div className="absolute right-0 top-9 z-[10000] w-max min-w-0 max-w-[240px] bg-white border border-[#D1D5DB] rounded-xl shadow-2xl p-1.5 text-left text-black [&_svg]:!text-[#174EA6]">
                        <div className="flex items-center justify-between gap-3 px-2 py-1.5 mb-1 border-b border-[#D1D5DB]"><div className="flex items-center gap-2 text-xs font-bold text-black"><Music size={15}/>MÚSICAS</div><button type="button" aria-label="Fechar menu" title="Fechar" onClick={() => setOpenArchiveMenu(null)} className="p-1 rounded-md text-[#666666] hover:bg-[#EEF1F5]"><X size={15}/></button></div>
                        <button className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold whitespace-nowrap hover:bg-[#EEF5FF] rounded" onClick={() => { setOpenArchiveMenu(null); exportArchiveZip(filteredSongs, 'Todas_as_musicas.zip'); }}><Download size={14}/>Download (zip)</button>
                        <div className="border-t border-[#D1D5DB]"/>
                        <button className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold whitespace-nowrap hover:bg-[#EEF5FF] rounded" onClick={() => { setOpenArchiveMenu(null); exportArchivePdf(filteredSongs, 'Setlist — Todas as músicas', 'Todas_as_musicas.pdf'); }}><FileText size={14}/>Setlist (pdf)</button>
                        <div className="border-t border-[#D1D5DB]"/>
                        <button className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold whitespace-nowrap hover:bg-[#EEF5FF] rounded" onClick={() => { setOpenArchiveMenu(null); const pdf = generatePDF(filteredSongs, "Songlist — Todas as músicas", true) as jsPDF; pdf.save("SONGLIST_TODAS_AS_MUSICAS.pdf"); }}><Music size={14}/>Songlist (pdf)</button>
                      </div>}
                    </div>
                    </div>
                    <AnimatePresence>
                      {expandedFolders.includes('all') && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="bg-white"
                        >
                          {filteredSongs.length === 0 ? (
                            <div className="p-4 text-[10px] text-center text-text-dim italic uppercase tracking-widest">Sem músicas</div>
                          ) : (
                            filteredSongs.map(song => (
                              <SongSidebarItem 
                                isMobile={!isDesktop}
                                key={song.id}
                                song={song}
                                isSelectionMode={isSelectionMode}
                                isSelected={selectedSongIds.includes(song.id!)}
                                onToggleSelect={() => {
                                  setSelectedSongIds(prev => 
                                    prev.includes(song.id!) ? prev.filter(id => id !== song.id) : [...prev, song.id!]
                                  );
                                }}
                                onLongPress={() => {
                                  if (!isMaestro) return;
                                  setIsSelectionMode(true);
                                  setSelectedSongIds([song.id!]);
                                }}
                                onDownload={() => downloadSongFile(song)}
                                onListPDF={() => generatePDF([song], song.title || 'Música')}
                                onShare={() => shareAsPDF([song], song.title || 'Música')}
                                onMove={() => { setSelectedSongIdForAction(song.id!); setIsMovingSingleSong(true); }}
                          isMaestro={isMaestro}
                          onDelete={() => deleteSong(song.id!)}
                                onClick={() => {
                                  if (isSelectionMode) {
                                    setSelectedSongIds(prev => 
                                      prev.includes(song.id!) ? prev.filter(id => id !== song.id) : [...prev, song.id!]
                                    );
                                  } else {
                                    setSelectedSong(song);
                                    setCurrentView('details');
                                    setIsSidebarOpen(false);
                                    updateLiveSong(song.id!);
                                  }
                                }}
                              />
                            ))
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>}

                  {/* Archive Folders */}
                  {folders.filter(f => (!f.type || f.type === 'song') && f.id !== activeSongFolderId).map(folder => {
                    const isExpanded = false;
                    const folderSongs = songs.filter(s => s.folderId === folder.id);
                    // Durante uma busca no acervo geral, exibe somente pastas
                    // que contenham músicas correspondentes, sem expandi-las.
                    const matchingFolderSongs = searchTerm.trim() && !activeSongFolderId
                      ? filteredSongs.filter(song => song.folderId === folder.id)
                      : folderSongs;
                    if (searchTerm.trim() && !activeSongFolderId && matchingFolderSongs.length === 0) return null;

                    return (
                      <div key={folder.id} className={`relative mx-2 mt-2 mb-2 border border-[#ECEDEF] rounded-[14px] overflow-visible bg-[#EEF1F5] ${openArchiveMenu === folder.id ? 'z-[999]' : 'z-0'}`}>
                        <div className={`w-full min-h-[48px] flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#EEF1F5] transition-colors ${isExpanded ? 'rounded-t-[13px]' : 'rounded-[13px]'}`}>
                        <button type="button"
                          onClick={() => { setActiveSongFolderId(folder.id!); setSearchTerm(''); setExpandedFolders([]); }}
                          className="flex flex-1 min-w-0 items-center justify-between gap-3 text-left"
                        >
                          <div className="flex w-full min-w-0 items-center gap-3">
                            {!isDesktop && isSelectionMode ? (
                              <span
                                role="checkbox"
                                aria-checked={matchingFolderSongs.length > 0 && matchingFolderSongs.every(song => selectedSongIds.includes(song.id!))}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  const ids = matchingFolderSongs.map(song => song.id!);
                                  const allSelected = ids.length > 0 && ids.every(id => selectedSongIds.includes(id));
                                  setSelectedSongIds(prev => allSelected ? prev.filter(id => !ids.includes(id)) : Array.from(new Set([...prev, ...ids])));
                                }}
                                className="flex h-6 w-6 shrink-0 items-center justify-center text-[#174EA6]"
                                title="Selecionar ou desmarcar músicas desta pasta"
                              >
                                {matchingFolderSongs.length > 0 && matchingFolderSongs.every(song => selectedSongIds.includes(song.id!)) ? <CheckSquare size={21} /> : <Square size={21} />}
                              </span>
                            ) : <FolderIcon size={16} className="text-[#174EA6]" />}
                            <span className="min-w-0 flex-1 text-left text-[13px] font-bold uppercase tracking-[0.08em] truncate max-w-[140px] text-black">{folder.name}</span>
                            <span className="ml-auto text-[10px] min-w-[18px] h-[18px] px-1 bg-[#174EA6] rounded-[4px] text-white font-bold flex items-center justify-center tabular-nums">{searchTerm.trim() && !activeSongFolderId ? matchingFolderSongs.length : folderSongs.length}</span>
                          </div>
                        </button>
                        <div data-archive-menu-root className="relative shrink-0" onClick={e => e.stopPropagation()}>
                          <button type="button" aria-label={`Ações da pasta ${folder.name}`} onClick={() => setOpenArchiveMenu(openArchiveMenu === folder.id ? null : folder.id!)} className="p-1.5 text-[#666666] hover:bg-white rounded-md transition-colors"><MoreVertical size={18}/></button>
                          {openArchiveMenu === folder.id && <div className="absolute right-0 top-9 z-[10000] w-max min-w-0 max-w-[240px] bg-white border border-[#D1D5DB] rounded-xl shadow-2xl p-1.5 text-left text-black [&_svg]:!text-[#174EA6]">
                            <div className="flex items-center justify-between gap-3 px-2 py-1.5 mb-1 border-b border-[#D1D5DB]"><div className="flex items-center gap-2 text-xs font-bold text-black"><Music size={15}/>MÚSICAS</div><button type="button" aria-label="Fechar menu" title="Fechar" onClick={() => setOpenArchiveMenu(null)} className="p-1 rounded-md text-[#666666] hover:bg-[#EEF1F5]"><X size={15}/></button></div>
                            <button className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold whitespace-nowrap hover:bg-[#EEF5FF] rounded" onClick={() => { setOpenArchiveMenu(null); exportArchiveZip(folderSongs, `${(folder.name || 'Pasta').replace(/[^\w-]+/g, '_')}.zip`); }}><Download size={14}/>Download</button>
                            <div className="border-t border-[#D1D5DB]"/>
                            <button className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold whitespace-nowrap hover:bg-[#EEF5FF] rounded" onClick={() => { setOpenArchiveMenu(null); exportArchivePdf(folderSongs, `Músicas — ${folder.name}`, `${(folder.name || 'pasta').replace(/[^\w-]+/g, '_')}.pdf`); }}><FileText size={14}/>Setlist (pdf)</button>
                            <div className="border-t border-[#D1D5DB]"/>
                            <button className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold whitespace-nowrap hover:bg-[#EEF5FF] rounded" onClick={() => { setOpenArchiveMenu(null); const pdf = generatePDF(folderSongs, `Songlist — ${folder.name}`, true) as jsPDF; pdf.save(`SONGLIST_${getExportFileName(folder.name || 'Pasta')}.pdf`); }}><Music size={14}/>Songlist (pdf)</button>
                            <div className="border-t border-[#D1D5DB]"/>
                            <button className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold whitespace-nowrap hover:bg-[#EEF5FF] rounded" onClick={() => { setOpenArchiveMenu(null); shareAsPDF(folderSongs, `Músicas — ${folder.name}`); }}><Share2 size={14}/>Compartilhar</button>
                          </div>}
                        </div>
                        </div>
                        
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="bg-[#EEF1F5]/70 rounded-b-[14px]"
                            >
                              {folderSongs.length === 0 ? (
                                <div className="p-4 text-[10px] text-center text-text-dim italic uppercase tracking-widest">Pasta Vazia</div>
                              ) : (
                                folderSongs.map(song => (
                                  <SongSidebarItem 
                                    isMobile={!isDesktop}
                                    key={song.id}
                                    song={song}
                                    isSelectionMode={isSelectionMode}
                                    isSelected={selectedSongIds.includes(song.id!)}
                                    onToggleSelect={() => {
                                      setSelectedSongIds(prev => 
                                        prev.includes(song.id!) ? prev.filter(id => id !== song.id) : [...prev, song.id!]
                                      );
                                    }}
                                    onLongPress={() => {
                                      if (!isMaestro) return;
                                      setIsSelectionMode(true);
                                      setSelectedSongIds([song.id!]);
                                    }}
                                    onDownload={() => downloadSongFile(song)}
                                    onListPDF={() => generatePDF([song], song.title || 'Música')}
                                    onShare={() => shareAsPDF([song], song.title || 'Música')}
                                    onMove={() => { setSelectedSongIdForAction(song.id!); setIsMovingSingleSong(true); }}
                          isMaestro={isMaestro}
                          onDelete={() => deleteSong(song.id!)}
                                    onClick={() => {
                                      if (isSelectionMode) {
                                        setSelectedSongIds(prev => 
                                          prev.includes(song.id!) ? prev.filter(id => id !== song.id) : [...prev, song.id!]
                                        );
                                      } else {
                                        setSelectedSong(song);
                                        setCurrentView('details');
                                        setIsSidebarOpen(false);
                                        updateLiveSong(song.id!);
                                      }
                                    }}
                                  />
                                ))
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}

                  {/* Root Songs (Archive Home) */}
                  {!activeSongFolderId && <div className="px-2 mt-4 mb-1">
                    <span className="text-[9px] font-black uppercase text-text-dim/50 tracking-[0.2em] ml-1">Sem Pasta (Raiz)</span>
                  </div>}
                  {!activeSongFolderId && filteredSongs.filter(s => !s.folderId).map(song => (
                    <SongSidebarItem 
                      isMobile={!isDesktop}
                      key={song.id}
                      song={song}
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedSongIds.includes(song.id!)}
                      onToggleSelect={() => {
                        setSelectedSongIds(prev => 
                          prev.includes(song.id!) ? prev.filter(id => id !== song.id) : [...prev, song.id!]
                        );
                      }}
                      onLongPress={() => {
                        if (!isMaestro) return;
                        setIsSelectionMode(true);
                        setSelectedSongIds([song.id!]);
                      }}
                      onDownload={() => downloadSongFile(song)}
                      onListPDF={() => generatePDF([song], song.title || 'Música')}
                      onShare={() => shareAsPDF([song], song.title || 'Música')}
                      onMove={() => { setSelectedSongIdForAction(song.id!); setIsMovingSingleSong(true); }}
                          isMaestro={isMaestro}
                          onDelete={() => deleteSong(song.id!)}
                      onClick={() => {
                        if (isSelectionMode) {
                          setSelectedSongIds(prev => 
                            prev.includes(song.id!) ? prev.filter(id => id !== song.id) : [...prev, song.id!]
                          );
                        } else {
                          setSelectedSong(song);
                          setCurrentView('details');
                          setIsSidebarOpen(false);
                          updateLiveSong(song.id!);
                        }
                      }}
                    />
                  ))}
                </div>
              )}

              {sidebarTab === 'repertorios' && sidebarView === 'tabs' && (
                <div className="space-y-0 text-primary">
                  {/* Repertoire Markers (Labels) */}
                  {folders.filter(f => f.type === 'repertorio').map(folder => {
                    const isExpanded = expandedRepFolders.includes(folder.id!);
                    const folderReps = filteredRepertorios.filter(r => r.folderId === folder.id);
                    if (folderReps.length === 0 && searchTerm) return null;

                    return (
                      <div key={folder.id} className={`relative mx-2 mt-2 mb-2 border border-[#ECEDEF] rounded-[14px] overflow-visible bg-[#EEF1F5] ${isExpanded ? 'z-[20]' : 'z-0'}`}>
                        <button 
                          onClick={() => {
                            setExpandedRepFolders(prev => 
                              isExpanded ? [] : [folder.id!]
                            );
                          }}
                          className={`w-full min-h-[48px] flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#EEF1F5] transition-colors ${isExpanded ? 'rounded-t-[13px]' : 'rounded-[13px]'}`}
                        >
                          <div className="flex w-full min-w-0 items-center gap-3">
                            <FolderIcon size={16} className="text-[#174EA6]" />
                            <span className="min-w-0 flex-1 text-left text-[13px] font-bold uppercase tracking-[0.08em] truncate max-w-[140px] text-black">{folder.name}</span>
                            <span className="ml-auto text-[10px] min-w-[18px] h-[18px] px-1 bg-[#174EA6] rounded-[4px] text-white font-bold flex items-center justify-center tabular-nums">{folderReps.length}</span>
                          </div>
                          <ChevronRight size={16} className={`text-text-dim transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                        
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="bg-white"
                            >
                              {folderReps.length === 0 ? (
                                <div className="p-4 text-[10px] text-center text-text-dim italic uppercase tracking-widest">Pasta Vazia</div>
                              ) : (
                                folderReps.map(repertorio => (
                                  <RepertorioSidebarItem 
                                    key={repertorio.id}
                                    repertorio={repertorio}
                                    isMaestro={isMaestro}
                                    isSelectionMode={sidebarTab === 'repertorios' && isSelectionMode}
                                    isSelected={selectedRepIds.includes(repertorio.id!)}
                                    onToggleSelect={() => {
                                      setSelectedRepIds(prev => 
                                        prev.includes(repertorio.id!) ? prev.filter(id => id !== repertorio.id) : [...prev, repertorio.id!]
                                      );
                                    }}
                                    onLongPress={() => {
                                      if (!isMaestro) return;
                                      setIsSelectionMode(true);
                                      setSelectedRepIds([repertorio.id!]);
                                    }}
                                    onClick={() => {
                                      // A seleção de ações é contextual ao repertório; não deve
                                      // permanecer marcada ao abrir outro repertório.
                                      setSelectedSongIdForAction(null);
                                      setSelectedRepertorio(repertorio);
                                      setSidebarView('repertorio-songs');
                                      setCurrentView('repertorios');
                                    }}
                                    onDelete={() => deleteRepertorio(repertorio.id)}
                                    onEdit={() => { setEditingRepertorio(repertorio); setIsSidebarOpen(false); setCurrentView('repertorio-form'); }}
                                    onDownload={() => {
                                      const repertorioSongs = (repertorio.songIds || [])
                                        .filter((id: string) => !String(id).startsWith('group:'))
                                        .map((id: string) => songs.find(song => song.id === id))
                                        .filter(Boolean) as Song[];
                                      exportArchiveZip(repertorioSongs, `${getExportFileName(repertorio.title || 'Repertorio')}.zip`);
                                    }}
                                    onSetlist={() => handleRepertorioPdfList(repertorio)}
                                    onSonglist={() => handleRepertorioSonglist(repertorio)}
                                    onShare={() => {
                                      const repertorioSongs = songs.filter(s => repertorio.songIds.includes(s.id!));
                                      if (navigator.share) {
                                        navigator.share({
                                          title: repertorio.title,
                                          text: `Repertório: ${repertorio.title}\n(${repertorioSongs.length} músicas)`,
                                          url: window.location.href
                                        }).catch(err => console.log('Error sharing:', err));
                                      } else {
                                        generatePDF(repertorioSongs, repertorio.title);
                                      }
                                    }}
                                  />
                                ))
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}

                  {/* Repertorios outside markers */}
                  {filteredRepertorios.filter(r => !r.folderId).map(repertorio => (
                    <RepertorioSidebarItem 
                      key={repertorio.id}
                      repertorio={repertorio}
                      isMaestro={isMaestro}
                      isSelectionMode={sidebarTab === 'repertorios' && isSelectionMode}
                      isSelected={selectedRepIds.includes(repertorio.id!)}
                      onToggleSelect={() => {
                        setSelectedRepIds(prev => 
                          prev.includes(repertorio.id!) ? prev.filter(id => id !== repertorio.id) : [...prev, repertorio.id!]
                        );
                      }}
                      onLongPress={() => {
                        if (!isMaestro) return;
                        setIsSelectionMode(true);
                        setSelectedRepIds([repertorio.id!]);
                      }}
                      onClick={() => {
                        // Limpa qualquer seleção de ação herdada do repertório anterior.
                        setSelectedSongIdForAction(null);
                        setSelectedRepertorio(repertorio);
                        setSidebarView('repertorio-songs');
                        setCurrentView('repertorios');
                      }}
                      onDelete={() => deleteRepertorio(repertorio.id)}
                      onEdit={() => { setEditingRepertorio(repertorio); setCurrentView('repertorio-form'); }}
                      onSetlist={() => handleRepertorioPdfList(repertorio)}
                      onSonglist={() => handleRepertorioSonglist(repertorio)}
                      onShare={() => {
                        const repertorioSongs = songs.filter(s => repertorio.songIds.includes(s.id!));
                        if (navigator.share) {
                          navigator.share({
                            title: repertorio.title,
                            text: `Repertório: ${repertorio.title}\n(${repertorioSongs.length} músicas)`,
                            url: window.location.href
                          }).catch(err => console.log('Error sharing:', err));
                        } else {
                          generatePDF(repertorioSongs, repertorio.title);
                        }
                      }}
                    />
                  ))}
                </div>
              )}

              {sidebarTab === 'blocks' && (
                <div className="space-y-0 text-primary">
                  {folders.filter(folder => (folder.type as string) === 'block').map(folder => {
                    const folderBlocks = songBlocks.filter(block => block.folderId === folder.id);
                    const cardCount = folderBlocks.reduce((total, block) => total + (block.suggestions || []).length, 0);
                    return (
                      <div key={folder.id} className="relative mx-2 mt-2 mb-2 border border-[#ECEDEF] rounded-[14px] overflow-visible bg-[#EEF1F5]">
                        <button
                          type="button"
                          onClick={() => { void openBlockFolder(folder.id!); }}
                          className="w-full min-h-[48px] flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#EEF1F5] transition-colors rounded-[13px]"
                        >
                          <div className="flex w-full min-w-0 items-center gap-3">
                            <FolderIcon size={16} className="text-[#174EA6]" />
                            <span className="min-w-0 flex-1 text-left text-[13px] font-bold uppercase tracking-[0.08em] truncate max-w-[140px] text-black">{folder.name}</span>
                            <span className="ml-auto text-[10px] min-w-[18px] h-[18px] px-1 bg-[#174EA6] rounded-[4px] text-white font-bold flex items-center justify-center tabular-nums">{cardCount}</span>
                          </div>
                          <ChevronRight size={16} className="text-text-dim" />
                        </button>
                      </div>
                    );
                  })}
                  {folders.filter(folder => (folder.type as string) === 'block').length === 0 && (
                    <p className="p-3 text-center text-[11px] text-text-dim">Crie um conjunto para organizar seus blocos.</p>
                  )}
                </div>
              )}

              {sidebarTab === 'settings' && (
                <div className="flex flex-col h-full bg-white">
                  <div className="mx-2 mt-2 mb-2 min-h-[48px] flex items-center px-3.5 py-2.5 border border-[#ECEDEF] rounded-[14px] bg-[#EEF1F5]">
                    <h3 className="text-[13px] font-bold uppercase tracking-[0.08em] text-black">Ajustes & Configurações</h3>
                  </div>
                  <div className="flex-1 py-1 bg-white">
                   {[
                      { id: 'geral', label: 'Geral', icon: <Settings size={18} /> },
                      { id: 'ia', label: 'Chave API', icon: <Brain size={18} /> },
                      { id: 'acordes', label: 'Banco de Acordes', icon: <Hash size={18} /> },
                      { id: 'users', label: 'Controle de Usuários', icon: <Users size={18} />, maestroOnly: true },
                      { id: 'pedais', label: 'Controladores', icon: <Gamepad size={18} /> },
                      { id: 'sobre', label: 'Sobre', icon: <Info size={18} /> }
                    ].filter(item => !item.maestroOnly || isMaestro).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (['geral', 'pedais', 'sobre', 'acordes', 'ia', 'users'].includes(item.id)) {
                            setActiveSettingsTab(item.id as any);
                            setCurrentView('settings');
                            setIsSidebarOpen(false);
                          }
                        }}
                        className={`w-full min-h-[48px] text-left px-3.5 py-2.5 text-[13px] font-bold uppercase tracking-[0.08em] border-b border-b-[#D1D5DB] transition-all flex items-center gap-3 text-black ${
                          currentView === 'settings' && activeSettingsTab === item.id 
                            ? 'bg-[#EEF1F5] border-l-4 border-l-[#174EA6]' 
                            : 'bg-white border-l-4 border-l-transparent hover:bg-[#F3F6FB]'
                        } [&_svg]:text-[#174EA6]`}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    ))}
                    <button 
                      onClick={() => setIsLogoutDialogOpen(true)}
                      className="w-full min-h-[48px] text-left px-3.5 py-2.5 text-[13px] font-bold uppercase tracking-[0.08em] border-l-4 border-l-transparent border-b border-b-[#D1D5DB] bg-white text-black hover:bg-[#F3F6FB] transition-all flex items-center gap-3"
                    >
                      <LogOut size={18} className="text-[#174EA6]" />
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-0 mt-2">
              <div className="px-4 pt-1 pb-2 border-b border-border/60 mb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg truncate uppercase tracking-tight text-black leading-none mb-1">
                      {selectedRepertorio?.title} {selectedRepertorio?.songIds?.filter((id: string) => !id.startsWith('group:')).length || 0}
                    </h3>
                    {selectedRepertorio?.date ? (
                      <p className="text-[10px] text-text-dim uppercase font-bold tracking-[0.2em] mt-1">
                        {new Date(selectedRepertorio.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">

                    <button 
                      onClick={() => {
                        setSidebarView('tabs');
                        setSelectedSongIdForAction(null);
                        setSelectedRepertorio(null);
                        setTransposition(0);
                      }}
                      className="p-2 hover:bg-surface rounded-full text-text-dim transition-all hover:scale-110 active:scale-95"
                      title="Fechar"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              </div>
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleReorderSongs}
                onDragCancel={() => setActiveId(null)}
              >
                <SortableContext 
                  items={sortableIds}
                  strategy={verticalListSortingStrategy}
                >
                    {(() => {
                      return sortableItemsData.map((item: any, idx: number) => {
                        if (item.type === 'group_handle') {
                          return (
                            <SortableGroupItem 
                              key={item.id}
                              id={item.id}
                              group={item.group}
                              displayIndex={item.displayIndex}
                              onUpdateGroupTitle={handleUpdateGroupTitle}
                              onClick={() => {
                                setSelectedSong({
                                  id: item.id,
                                  title: item.group.title || 'Marcador de Bloco',
                                  artist: 'MARCADOR DE BLOCO',
                                  isGroup: true,
                                  groupData: item.group
                                } as any);
                                setCurrentView('details');
                                setIsSidebarOpen(false);
                                updateLiveSong(item.id);
                              }}
                              onDelete={async () => {
                                if (!window.confirm('Excluir este marcador de bloco? As músicas permanecerão no repertório.')) return;

                                const gid = item.group.id;
                                const groupMarkerId = `group:${gid}`;
                                const newIds = selectedRepertorio.songIds.filter((id: string) => id !== groupMarkerId);

                                const newGroups = (selectedRepertorio.songGroups || []).filter((g: any) => g.id !== gid);
                                await updateDoc(doc(db, 'setlists', selectedRepertorio.id), { 
                                  songIds: newIds, 
                                  songGroups: newGroups 
                                });
                                setSelectedRepertorio({ ...selectedRepertorio, songIds: newIds, songGroups: newGroups });
                              }}
                            />
                          );
                        } else {
                          const song = songs.find(s => s.id === item.id);
                          if (!song) return null;
                          
                          // Usar o tom do repertório se disponível para EXIBIÇÃO
                          const displayKey = (selectedRepertorio?.songKeys && item.id && selectedRepertorio.songKeys[item.id]) || song.key;

                          return (
                            <SortableSongItem 
                              key={item.id}
                              id={item.id}
                              song={song}
                              displayKey={displayKey}
                              index={item.index}
                              isMaestro={isMaestro}
                              isInsideGroup={false}
                              isLastInGroup={false}
                              isSelected={selectedSongIdForAction === item.id}
                              onToggleSelect={() => {
                                setSelectedSongIdForAction(prev => prev === item.id ? null : item.id);
                              }}
                              onClick={() => {
                                setSelectedSong(song);
                                setCurrentView('details');
                                setIsSidebarOpen(false);
                                updateLiveSong(song.id!);
                              }}
                              onDelete={async () => {
                                if (!window.confirm('Remover música do repertório?')) return;
                                const newIds = selectedRepertorio.songIds.filter((id: string) => id !== item.id);
                                await updateDoc(doc(db, 'setlists', selectedRepertorio.id), { songIds: newIds });
                                setSelectedRepertorio({ ...selectedRepertorio, songIds: newIds });
                                // Se a música removida estava marcada para alguma ação,
                                // limpa a marcação para não reaparecer em outro repertório.
                                setSelectedSongIdForAction(prev => prev === item.id ? null : prev);
                              }}
                              onShare={() => {
                                if (navigator.share) {
                                  navigator.share({
                                    title: song.title,
                                    text: `Música: ${song.title} - ${song.artist}`,
                                    url: window.location.href
                                  }).catch(err => console.log('Error sharing:', err));
                                } else {
                                  generatePDF([song], song.title);
                                }
                              }}
                            />
                          );
                        }
                      });
                    })()}
                </SortableContext>
                <DragOverlay adjustScale={false}>
                  {activeId ? (
                    (() => {
                      if (activeId.startsWith('group:')) {
                        const groupId = activeId.split(':')[1];
                        const group = (selectedRepertorio?.songGroups || []).find((g: any) => g.id === groupId);
                        if (!group) return null;
                        return (
                          <div className="bg-[#F5F8FC] border-b border-border p-3 min-w-[280px] pointer-events-none opacity-90 shadow-xl flex items-center gap-4">
                            <div className="w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center text-[11px] font-bold">
                              {/* We don't have the index here easily without searching, but we can show something consistent */}
                              #
                            </div>
                            <div className="text-xs font-black uppercase tracking-widest text-[#0D47A1]">
                              {group.title || 'Marcador de Bloco'}
                            </div>
                          </div>
                        );
                      } else {
                        const song = songs.find(s => s.id === activeId);
                        if (!song) return null;
                        return (
                          <div className="bg-white border-b border-border/40 flex items-center gap-4 p-3.5 min-w-[280px] pointer-events-none opacity-90 shadow-xl">
                            <div className="w-7 h-7 rounded-full bg-surface border-2 border-gray-200 text-text-dim flex items-center justify-center text-[10px] font-bold">
                              {/* Placeholder for index during drag */}
                              #
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm truncate tracking-normal uppercase leading-none mb-1 text-black">
                                {song.title?.length > 22 ? song.title.substring(0, 22) + '...' : song.title}
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-[10px] text-[#666666] font-medium uppercase tracking-widest truncate leading-tight flex-1">
                                  {song.artist?.length > 22 ? song.artist.substring(0, 22) + '...' : song.artist}
                                </div>
                                <div className="text-[12px] text-[#666666] font-bold tracking-tight shrink-0 text-right">
                                  {(selectedRepertorio?.songKeys && song.id && selectedRepertorio.songKeys[song.id]) || song.key}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    })()
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          )}
        </div>

        {isMaestro && isSelectionMode && sidebarTab === 'songs' && sidebarView === 'tabs' && (
          <div className="absolute bottom-16 left-0 right-0 p-4 bg-surface border-t border-border flex flex-col gap-2 z-[80]">
            <div className="flex gap-2">
              <button 
                onClick={() => setIsMovingSongs(!isMovingSongs)}
                disabled={selectedSongIds.length === 0}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl font-bold text-[9px] uppercase tracking-tighter disabled:opacity-50 border transition-all ${isMovingSongs ? 'bg-primary text-white border-primary' : 'bg-surface border-border text-text-dim hover:text-primary'}`}
              >
                <FolderIcon size={isDesktop ? 12 : 22} /> {isDesktop && 'Mover'}
              </button>
              <button 
                onClick={handleBatchShare}
                disabled={selectedSongIds.length === 0}
                className="flex-1 flex items-center justify-center gap-1 bg-primary/10 text-primary py-1.5 rounded-xl font-bold text-[9px] uppercase tracking-tighter disabled:opacity-50 border border-primary/20"
              >
                <Share2 size={isDesktop ? 12 : 22} /> {isDesktop && 'Compartilhar'}
              </button>
              <button 
                onClick={handleBatchDelete}
                disabled={selectedSongIds.length === 0}
                className="flex-1 flex items-center justify-center gap-1 bg-red-500/10 text-red-500 py-1.5 rounded-xl font-bold text-[9px] uppercase tracking-tighter disabled:opacity-50 border border-red-500/20"
              >
                <Trash2 size={isDesktop ? 12 : 22} /> {isDesktop && 'Excluir'}
              </button>
            </div>
            
            <AnimatePresence>
              {isMovingSongs && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-surface border border-border rounded-xl overflow-hidden"
                >
                  <div className="p-2 border-b border-border text-[9px] font-bold uppercase tracking-widest text-text-dim bg-bg/50">Mover para...</div>
                  <div className="max-h-[150px] overflow-y-auto">
                    <button 
                      onClick={() => handleBatchMove('')}
                      className="w-full text-left p-2.5 hover:bg-primary/10 text-[10px] font-bold uppercase tracking-wider border-b border-border/30 last:border-0"
                    >
                      Sem Pasta (Raiz)
                    </button>
                    {folders.filter(f => !f.type || f.type === 'song').map(f => (
                      <button 
                        key={f.id}
                        onClick={() => handleBatchMove(f.id!)}
                        className="w-full text-left p-2.5 hover:bg-primary/10 text-[10px] font-bold uppercase tracking-wider border-b border-border/30 last:border-0"
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <nav className="p-2 border-t border-border bg-[#E6ECF5] flex justify-around relative">
          {sidebarTab === 'songs' ? (
            <>
              <SidebarNavItem
                icon={<Plus size={18} />}
                label="Música"
                tooltip="Cadastrar uma nova música."
                active={true}
                variant="light"
                disabled={isSelectionMode}
                onClick={() => {
                  setEditingSong(null);
                  setCurrentView('form');
                  setIsSidebarOpen(false);
                }}
              />
              <SidebarNavItem
                icon={<FolderIcon size={18} />}
                label="Pastas"
                tooltip="Criar ou organizar pastas de músicas."
                active={true}
                variant="light"
                disabled={isSelectionMode}
                onClick={() => {
                  setManagingFolderType('song');
                  setIsSidebarOpen(false);
                }}
              />
              <div className="relative" ref={bottomArchiveRef}>
                <SidebarNavItem
                  icon={<Save size={18} />}
                  label="Arquivo"
                  tooltip="Importar e exportar músicas e acervos."
                  active={true}
                  variant="light"
                  disabled={isSelectionMode}
                  onClick={() => { setIsSidebarArchiveOpen(!isSidebarArchiveOpen); setIsSidebarActionOpen(false); }}
                />
                <AnimatePresence>
                  {isSidebarArchiveOpen && sidebarTab === 'songs' && (
                    <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-fit min-w-max max-w-[calc(100vw-24px)] bg-white border border-[#DDE3EC] rounded-xl shadow-2xl z-[300] overflow-hidden [&_svg]:!text-[#174EA6]">
                      <div className="flex items-center justify-between gap-6 px-4 py-3 border-b border-gray-300 text-black"><div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest whitespace-nowrap"><Music size={15} /> MÚSICAS</div><button type="button" onClick={() => setIsSidebarArchiveOpen(false)} aria-label="Fechar menu" title="Fechar" className="p-1 rounded-md hover:bg-[#E6ECF5] transition-colors"><X size={16} /></button></div>
                      <button onClick={() => { handleIndividualImport(); setIsSidebarArchiveOpen(false); setIsSidebarOpen(false); }} className="w-full px-4 py-3 text-left whitespace-nowrap text-[11px] font-bold tracking-widest text-black hover:bg-[#E6ECF5] border-b border-gray-300 flex items-center gap-2"><Download size={14} /> Importar Música</button>
                      <button onClick={() => { handleBulkImport(); setIsSidebarArchiveOpen(false); setIsSidebarOpen(false); }} className="w-full px-4 py-3 text-left whitespace-nowrap text-[11px] font-bold tracking-widest text-black hover:bg-[#E6ECF5] border-b border-gray-300 flex items-center gap-2"><Download size={14} /> Importar Acervo (zip)</button>
                      <button disabled={selectedSongIds.length === 0} onClick={() => { handleManualExport(); setIsSidebarArchiveOpen(false); if (selectedSongIds.length > 0) setIsSidebarOpen(false); }} className={`w-full px-4 py-3 text-left whitespace-nowrap text-[11px] font-bold tracking-widest border-b border-gray-300 flex items-center gap-2 ${selectedSongIds.length === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-black hover:bg-[#E6ECF5]'}`}><Upload size={14} /> Exportar Música</button>
                      <button disabled={songs.length === 0} onClick={() => { setIsExportFolderModalOpen(true); setIsSidebarArchiveOpen(false); setIsSidebarOpen(false); }} className={`w-full px-4 py-3 text-left whitespace-nowrap text-[11px] font-bold tracking-widest flex items-center gap-2 ${songs.length === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-black hover:bg-[#E6ECF5]'}`}><Upload size={14} /> Exportar Acervo (zip)</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <SidebarNavItem icon={<Settings size={18} />} label="Ajustes" tooltip="Configure as preferências e ferramentas do aplicativo." active={true} variant="light" onClick={() => { setSidebarTab('settings'); setSidebarView('tabs'); setCurrentView('settings'); }} />
            </>
          ) : sidebarTab === 'repertorios' && sidebarView === 'repertorio-songs' && selectedRepertorio ? (
            <>
              <SidebarNavItem
                icon={<Plus size={18} />}
                label="Música"
                tooltip="Adicionar músicas ao repertório aberto."
                active={true}
                variant="light"
                onClick={() => {
                  setEditingRepertorio(selectedRepertorio);
                  setCurrentView('repertorio-form');
                  setIsSidebarOpen(false);
                }}
              />
              <SidebarNavItem
                icon={<Hash size={18} />}
                label="Marcador"
                tooltip="Adicionar novo marcador ao setlist."
                active={true}
                variant="light"
                onClick={handleCreateBlock}
              />
              <div className="relative" ref={bottomArchiveRef}>
                <SidebarNavItem
                  icon={<Save size={18} />}
                  label="Arquivo"
                  tooltip="Exportar o repertório e seus documentos."
                  active={true}
                  variant="light"
                  onClick={() => { setIsSidebarArchiveOpen(!isSidebarArchiveOpen); setIsSidebarActionOpen(false); }}
                />
                <AnimatePresence>
                  {isSidebarArchiveOpen && (
                    <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-fit min-w-max max-w-[calc(100vw-24px)] bg-white border border-[#DDE3EC] rounded-xl shadow-2xl z-[300] overflow-hidden [&_svg]:!text-[#174EA6]">
                      <div className="flex items-center justify-between gap-6 px-4 py-3 border-b border-gray-300 text-black"><div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest whitespace-nowrap"><ListMusic size={15} /> REPERTÓRIO</div><button type="button" onClick={() => setIsSidebarArchiveOpen(false)} aria-label="Fechar menu" title="Fechar" className="p-1 rounded-md hover:bg-[#E6ECF5] transition-colors"><X size={16} /></button></div>
                      <button disabled={!(selectedRepertorio.songIds || []).some((id: string) => !id.startsWith('group:'))} onClick={() => { handleRepertorioPdfList(); setIsSidebarArchiveOpen(false); }} className={`w-full px-4 py-3 text-left whitespace-nowrap text-[11px] font-bold uppercase tracking-widest border-b border-gray-300 flex items-center gap-2 ${!(selectedRepertorio.songIds || []).some((id: string) => !id.startsWith('group:')) ? 'text-gray-300 cursor-not-allowed' : 'text-black hover:bg-[#E6ECF5]'}`}><FileText size={14} /> Exportar Setlist</button>
                      <button disabled={!(selectedRepertorio.songIds || []).some((id: string) => songs.some(song => song.id === id))} onClick={() => { handleRepertorioPdfFull(); setIsSidebarArchiveOpen(false); }} className={`w-full px-4 py-3 text-left whitespace-nowrap text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 ${!(selectedRepertorio.songIds || []).some((id: string) => songs.some(song => song.id === id)) ? 'text-gray-300 cursor-not-allowed' : 'text-black hover:bg-[#E6ECF5]'}`}><FileText size={14} /> Exportar Set Musical</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <SidebarNavItem icon={<Settings size={18} />} label="Ajustes" tooltip="Configure as preferências e ferramentas do aplicativo." active={true} variant="light" onClick={() => { setSidebarTab('settings'); setSidebarView('tabs'); setCurrentView('settings'); }} />
            </>
          ) : sidebarTab === 'repertorios' ? (
            <>
              <SidebarNavItem
                icon={<Plus size={18} />}
                label="Setlist"
                tooltip="Criar um novo repertório."
                active={true}
                variant="light"
                onClick={() => {
                  const repFolders = folders.filter(f => f.type === 'repertorio');
                  if (repFolders.length === 0) {
                    alert('Por favor, crie uma pasta para repertórios primeiro usando o botão “Pastas”.');
                    return;
                  }
                  setIsPickingFolderForNewRep(true);
                  setIsSidebarOpen(false);
                }}
              />
              <SidebarNavItem
                icon={<FolderIcon size={18} />}
                label="Pastas"
                tooltip="Criar ou organizar pastas de repertórios."
                active={true}
                variant="light"
                onClick={() => {
                  setManagingFolderType('repertorio');
                  setIsSidebarOpen(false);
                }}
              />
              <div className="relative" ref={bottomArchiveRef}>
                <SidebarNavItem
                  icon={<Save size={18} />}
                  label="Arquivo"
                  tooltip="Importar e exportar repertórios e documentos."
                  active={true}
                  variant="light"
                  onClick={() => { setIsSidebarArchiveOpen(!isSidebarArchiveOpen); setIsSidebarActionOpen(false); }}
                />
                <AnimatePresence>
                  {isSidebarArchiveOpen && sidebarTab === 'repertorios' && (
                    <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-fit min-w-max max-w-[calc(100vw-24px)] bg-white border border-[#DDE3EC] rounded-xl shadow-2xl z-[300] overflow-hidden [&_svg]:!text-[#174EA6]">
                      <div className="flex items-center justify-between gap-6 px-4 py-3 border-b border-gray-300 text-black"><div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest whitespace-nowrap"><ListMusic size={15} /> REPERTÓRIOS</div><button type="button" onClick={() => setIsSidebarArchiveOpen(false)} aria-label="Fechar menu" title="Fechar" className="p-1 rounded-md hover:bg-[#E6ECF5] transition-colors"><X size={16} /></button></div>
                      <button onClick={() => { handleRepertorioJsonImport(); setIsSidebarArchiveOpen(false); }} className="w-full px-4 py-3 text-left whitespace-nowrap text-[11px] font-bold tracking-widest text-black hover:bg-[#E6ECF5] border-b border-gray-300 flex items-center gap-2"><Download size={14} /> Importar Repertório (json)</button>
                      <button onClick={() => { setIsRepertorioJsonExportModalOpen(true); setIsSidebarArchiveOpen(false); }} className="w-full px-4 py-3 text-left whitespace-nowrap text-[11px] font-bold tracking-widest text-black hover:bg-[#E6ECF5] flex items-center gap-2"><Upload size={14} /> Exportar Repertório (json)</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <SidebarNavItem icon={<Settings size={18} />} label="Ajustes" tooltip="Configure as preferências e ferramentas do aplicativo." active={true} variant="light" onClick={() => { setSidebarTab('settings'); setSidebarView('tabs'); setCurrentView('settings'); }} />
            </>
          ) : sidebarTab === 'blocks' ? (
            <>
              <div className="contents">
                <div className="flex-1 min-w-0 flex justify-center">
                  <SidebarNavItem icon={<Plus size={18} />} label="BLOCO" tooltip="Criar um novo bloco." active={true} variant="light" onClick={() => {
                    const blockFolders = folders.filter(folder => (folder.type as string) === 'block');
                    if (blockFolders.length === 0) { alert('Crie um conjunto de blocos primeiro usando o botão “Conjuntos”.'); return; }
                    setIsPickingFolderForNewBlock(true);
                    setIsSidebarOpen(false);
                  }} />
                </div>
                <div className="flex-1 min-w-0 flex justify-center">
                  <SidebarNavItem icon={<FolderIcon size={18} />} label="Conjuntos" tooltip="Criar ou organizar conjuntos de blocos." active={true} variant="light" onClick={() => { setManagingFolderType('block'); setIsSidebarOpen(false); }} />
                </div>
              </div>
              <div className="relative flex-1 min-w-0 flex justify-center" ref={bottomArchiveRef}>
                <SidebarNavItem icon={<Save size={18} />} label="Arquivo" tooltip="Acessar as opções gerais de importação e exportação." active={isSidebarArchiveOpen} variant="light" onClick={() => { setIsSidebarArchiveOpen(!isSidebarArchiveOpen); setIsSidebarActionOpen(false); }} />
                <AnimatePresence>
                  {isSidebarArchiveOpen && sidebarTab === 'blocks' && (
                    <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-fit min-w-max max-w-[calc(100vw-24px)] bg-white border border-[#DDE3EC] rounded-xl shadow-2xl z-[300] overflow-hidden [&_svg]:!text-[#174EA6]">
                      <div className="flex items-center justify-between gap-6 px-4 py-3 border-b border-gray-300 text-black"><div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest whitespace-nowrap"><Save size={15} /> ARQUIVO</div><button type="button" onClick={() => setIsSidebarArchiveOpen(false)} aria-label="Fechar menu" title="Fechar" className="p-1 rounded-md hover:bg-[#E6ECF5] transition-colors"><X size={16} /></button></div>
                      <button onClick={() => { handleIndividualImport(); setIsSidebarArchiveOpen(false); setIsSidebarOpen(false); }} className="w-full px-4 py-3 text-left whitespace-nowrap text-[11px] font-bold tracking-widest text-black hover:bg-[#E6ECF5] border-b border-gray-300 flex items-center gap-2"><Download size={14} /> Importar Música</button>
                      <button onClick={() => { handleBulkImport(); setIsSidebarArchiveOpen(false); setIsSidebarOpen(false); }} className="w-full px-4 py-3 text-left whitespace-nowrap text-[11px] font-bold tracking-widest text-black hover:bg-[#E6ECF5] border-b border-gray-300 flex items-center gap-2"><Download size={14} /> Importar Acervo (zip)</button>
                      <button onClick={() => { handleRepertorioJsonImport(); setIsSidebarArchiveOpen(false); }} className="w-full px-4 py-3 text-left whitespace-nowrap text-[11px] font-bold tracking-widest text-black hover:bg-[#E6ECF5] border-b border-gray-300 flex items-center gap-2"><Download size={14} /> Importar Repertório (json)</button>
                      <button onClick={() => { setIsRepertorioJsonExportModalOpen(true); setIsSidebarArchiveOpen(false); }} className="w-full px-4 py-3 text-left whitespace-nowrap text-[11px] font-bold tracking-widest text-black hover:bg-[#E6ECF5] flex items-center gap-2"><Upload size={14} /> Exportar Repertório (json)</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex-1 min-w-0 flex justify-center">
                <SidebarNavItem icon={<Settings size={18} />} label="Ajustes" tooltip="Configure as preferências e ferramentas do aplicativo." active={true} variant="light" onClick={() => { setSidebarTab('settings'); setSidebarView('tabs'); setCurrentView('settings'); }} />
              </div>
            </>
          ) : (
            <div className="flex w-full items-center justify-around">
              <div className="flex-1 min-w-0 flex justify-center">
                <SidebarNavItem icon={<Plus size={18} />} label="Música" tooltip="Cadastrar uma nova música." active={false} variant="light" disabled={true} onClick={() => {}} />
              </div>
              <div className="flex-1 min-w-0 flex justify-center">
                <SidebarNavItem icon={<FolderIcon size={18} />} label="Pastas" tooltip="Criar ou organizar pastas." active={false} variant="light" disabled={true} onClick={() => {}} />
              </div>
              <div className="flex-1 min-w-0 flex justify-center">
                <SidebarNavItem icon={<Save size={18} />} label="Arquivo" tooltip="Acessar as opções gerais de importação e exportação." active={false} variant="light" disabled={true} onClick={() => {}} />
              </div>
              <div className="flex-1 min-w-0 flex justify-center">
                <SidebarNavItem icon={<Settings size={18} />} label="Ajustes" tooltip="Configure as preferências e ferramentas do aplicativo." active={true} variant="light" onClick={() => { setSidebarTab('settings'); setSidebarView('tabs'); }} />
              </div>
            </div>
          )}
        </nav>
      </motion.aside>

      <div className="w-full max-w-[1000px] bg-bg border-x border-border h-screen flex flex-col relative overflow-hidden">
        {/* Sticky Header Section */}
        <div className={`sticky top-0 ${followLeader ? "z-[140]" : "z-[100]"} bg-[#174EA6] border-b border-[#0D3F8A] transition-colors`}>
          <header className="px-5 py-3 flex items-center justify-between bg-[#174EA6]">
          <div className="flex items-center gap-4">
            {followLeader ? (
              <button
                onClick={() => {
                  setFollowLeader(false);
                  setIsSidebarOpen(true);
                }}
                title="Desativar Modo Palco"
                aria-label="Sair do Palco"
                className="p-2 -ml-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff6900] px-3 py-2 text-white text-[11px] font-black uppercase tracking-wide shadow hover:bg-[#e65f00] active:scale-[0.98] transition-all"
              >
                <Mic2 size={17} />
                <span>SAIR DO PALCO</span>
              </button>
            ) : (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 -ml-2 hover:bg-white/15 rounded-full transition-colors text-white"
                title="Abrir Menu"
              >
                <PanelLeft size={24} />
              </button>
            )}
            <AnimatePresence mode="wait">
              {currentView === 'details' && selectedSong && isDesktop ? (
                <motion.div
                  key="desktop-song-zoom"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute left-1/2 -translate-x-1/2 hidden lg:flex items-center bg-white border border-white rounded-full h-[28px] overflow-hidden shadow-sm"
                  aria-label="Controle de zoom da música"
                >
                  <button
                    type="button"
                    onClick={() => setChordProScale(prev => Math.max(0.6, prev - 0.1))}
                    className="w-8 h-full flex items-center justify-center hover:bg-[#E6ECF5] text-[#174EA6] hover:text-[#0D3F8A] transition-colors border-r border-[#D3DDEB]"
                    title="Diminuir Zoom"
                  ><Minus size={14} /></button>
                  <span className="px-2 text-[10px] font-black text-[#174EA6] min-w-[40px] text-center">{Math.round(chordProScale * 100)}%</span>
                  <button
                    type="button"
                    onClick={() => {
                      let nextScale = chordProScale + 0.1;
                      if (songViewRef.current && maxLineChars > 0) {
                        const viewWidth = songViewRef.current.clientWidth;
                        let padding = 48;
                        if (viewWidth >= 1024) padding += 160;
                        else if (viewWidth >= 768) padding += 96;
                        const availableWidth = viewWidth - padding - 10;
                        const charWidthAtScale1 = 8.4;
                        const maxAllowedScale = availableWidth / (maxLineChars * charWidthAtScale1);
                        nextScale = Math.min(nextScale, maxAllowedScale);
                      }
                      setChordProScale(Math.min(2.5, nextScale));
                    }}
                    className="w-8 h-full flex items-center justify-center hover:bg-[#E6ECF5] text-[#174EA6] hover:text-[#0D3F8A] transition-colors border-l border-[#D3DDEB]"
                    title="Aumentar Zoom"
                  ><Plus size={14} /></button>
                  <button
                    type="button"
                    onClick={() => setChordProScale(1)}
                    className="w-8 h-full flex items-center justify-center hover:bg-[#E6ECF5] text-[#174EA6] hover:text-[#0D3F8A] transition-colors border-l border-[#D3DDEB]"
                    title="Resetar Zoom"
                  ><RotateCcw size={14} /></button>
                </motion.div>
              ) : currentView === 'details' && selectedRepertorio ? (
                <motion.div 
                  key="next-song-header"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex flex-col h-11 justify-center"
                >
                  {(() => {
                    const currentIndex = selectedRepertorio.songIds.indexOf(selectedSong?.id || '');
                    const nextId = selectedRepertorio.songIds[currentIndex + 1];
                    let nextItemTitle = '';
                    let nextItemKey = '';
                    let isEndOfBlock = false;

                    if (nextId) {
                      if (nextId.startsWith('group:')) {
                        isEndOfBlock = true;
                      } else {
                        const nextSong = songs.find(s => s.id === nextId);
                        if (nextSong) {
                          nextItemTitle = nextSong.title;
                          nextItemKey = (selectedRepertorio.songKeys && nextSong.id && selectedRepertorio.songKeys[nextSong.id]) || nextSong.key;
                        }
                      }
                    } else {
                      isEndOfBlock = true;
                    }
                    
                    if (isEndOfBlock || !nextItemTitle) return (
                      <div className="font-bold text-2xl tracking-tighter uppercase text-primary">
                        FIM DO BLOCO
                      </div>
                    );

                    return (
                      <>
                        <span className="text-[12px] font-black uppercase tracking-[0.25em] text-white/75 leading-none mb-1">
                          Próxima:
                        </span>
                        <span className="font-black text-xl md:text-2xl uppercase tracking-tighter text-white truncate max-w-[160px] sm:max-w-[220px] md:max-w-[380px] leading-none">
                          {nextItemTitle} {nextItemKey && <span className="opacity-60 text-lg md:text-xl normal-case">({nextItemKey})</span>}
                        </span>
                      </>
                    );
                  })()}
                </motion.div>
              ) : currentView === 'details' && selectedSong && !selectedRepertorio && sidebarTab === 'songs' && !selectedSong.isGroup && !isDesktop ? (
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center" data-key-picker-root>
                  <button
                    type="button"
                    onClick={() => setIsKeyPickerOpen(!isKeyPickerOpen)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white text-[#174EA6] border border-white px-3 py-1.5 text-[12px] font-black shadow-sm whitespace-nowrap"
                  >
                    <Music size={14} /> Tom: {currentKey}
                  </button>
                  <AnimatePresence>
                    {isKeyPickerOpen && (
                      <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:6}} className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-white border border-border rounded-xl shadow-2xl z-[200] grid grid-cols-4 p-2 gap-1">
                        {songKeyOptions.map(k => <button key={k} type="button" onClick={e => { e.stopPropagation(); handleKeySelect(k); }} className={`p-2 text-[10px] font-bold rounded-lg border ${k === currentKey ? 'bg-primary border-primary text-white' : 'bg-bg border-border text-text-dim'}`}>{k}</button>)}
                        {vocalistKeyOptions.length > 0 && (
                          <div className="col-span-4 mt-1 pt-2 border-t border-border/70">
                            <div className="flex items-center gap-1.5 px-1 pb-1.5 text-[9px] font-black uppercase tracking-wider text-text-dim"><Mic2 size={11} /> Tons dos vocalistas</div>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                              {vocalistKeyOptions.map(vocalist => <button key={vocalist.id} type="button" onClick={e => { e.stopPropagation(); handleVocalistKeySelect(vocalist.key); }} className={`w-full flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left ${currentKey === vocalist.key ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-bg border-border text-text-dim'}`}><span className="min-w-0 truncate text-[10px] font-bold">{vocalist.name}</span><span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">{vocalist.key}</span></button>)}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : currentView === 'form' ? (
                <motion.div
                  key="song-form-header-title"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute left-1/2 -translate-x-1/2 text-sm sm:text-base font-black uppercase tracking-wide text-white whitespace-nowrap"
                >
                  Editor de Música
                </motion.div>
              ) : (
                <motion.div
                  key={`main-menu-title-${sidebarTab}`}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute left-1/2 -translate-x-1/2 text-sm sm:text-base font-black uppercase tracking-wide text-white whitespace-nowrap pointer-events-none"
                >
                  {currentView === 'block-details' && selectedBlockSet ? (folders.find(folder => folder.id === selectedBlockFolderId)?.name || selectedBlockSet.title) : sidebarTab === 'songs' ? 'Músicas' : sidebarTab === 'repertorios' ? 'Repertórios' : sidebarTab === 'blocks' ? 'Conjuntos' : 'Ajustes'}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="flex items-center gap-3">
            {currentView === 'list' && sidebarTab === 'songs' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-white px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#174EA6]" title="Quantidade de pastas">
                <FolderIcon size={13} /> {folders.filter(f => !f.type || f.type === 'song').length}
              </span>
            )}
            {currentView === 'blocks' && sidebarTab === 'blocks' && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-white px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#174EA6]" title="Quantidade de conjuntos">
                <LayoutList size={13} /> {songBlocks.length}
              </span>
            )}
            {currentView === 'block-details' && selectedBlockSet && (
              <div className="flex items-center gap-2">
                <button type="button" onClick={addBlockToSelectedSet}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#174EA6] hover:bg-white/90"
                  title="Adicionar bloco ao conjunto">
                  <Plus size={13} /> Bloco
                </button>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#174EA6]" title="Quantidade de blocos no conjunto">
                  <LayoutList size={13} /> {(selectedBlockSet.suggestions || []).length}
                </span>
              </div>
            )}
            {currentView === 'repertorios' && sidebarTab === 'repertorios' && !selectedRepertorio && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-white px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#174EA6]" title="Quantidade de repertórios">
                <ListMusic size={13} /> {repertorios.length}
              </span>
            )}
            {currentView === 'details' && selectedRepertorio && selectedSong && !selectedSong.isGroup && (
              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                <div
                  data-key-picker-root
                  className="cursor-pointer hover:scale-105 transition-transform relative"
                  onClick={() => setIsKeyPickerOpen(!isKeyPickerOpen)}
                >
                  <span className="hidden lg:inline-flex text-[10px] font-bold tracking-[0.1em] px-3 py-1.5 rounded-full bg-white text-[#174EA6] border border-white whitespace-nowrap items-center gap-1.5">
                    <Music size={13} /> Tom: {currentKey}
                  </span>
                  <AnimatePresence>
                    {isKeyPickerOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute top-full right-0 mt-2 w-56 bg-surface border border-border rounded-xl shadow-2xl z-[200] grid grid-cols-4 p-2 gap-1"
                      >
                        {songKeyOptions.map(k => (
                          <button
                            key={k}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleKeySelect(k);
                            }}
                            className={`p-2 text-[10px] font-bold rounded-lg border transition-all ${k === currentKey ? 'bg-primary border-primary text-white scale-105' : 'bg-bg border-border text-text-dim hover:border-primary/50'}`}
                          >
                            {k}
                          </button>
                        ))}
                        {vocalistKeyOptions.length > 0 && (
                          <div className="col-span-4 mt-1 pt-2 border-t border-border/70">
                            <div className="flex items-center gap-1.5 px-1 pb-1.5 text-[9px] font-black uppercase tracking-wider text-text-dim">
                              <Mic2 size={11} /> Tons dos vocalistas
                            </div>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                              {vocalistKeyOptions.map(vocalist => (
                                <button
                                  key={vocalist.id}
                                  type="button"
                                  onClick={e => { e.stopPropagation(); handleVocalistKeySelect(vocalist.key); }}
                                  className={`w-full flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${currentKey === vocalist.key ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-bg border-border text-text-dim hover:border-primary/40'}`}
                                >
                                  <span className="min-w-0 truncate text-[10px] font-bold">{vocalist.name}</span>
                                  <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">{vocalist.key}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <span
                  className="hidden lg:inline-flex text-[10px] font-bold tracking-[0.1em] px-3 py-1.5 rounded-full text-[#174EA6] bg-white border border-white whitespace-nowrap"
                >
                  <span className="inline-flex items-center gap-1.5"><Hourglass size={13} />{selectedSong.tempo}</span>
                </span>
                <span className="hidden lg:inline-flex text-[10px] font-bold tracking-[0.1em] px-3 py-1.5 rounded-full bg-white text-[#174EA6] border border-white whitespace-nowrap items-center gap-1.5">
                  <Tag size={13} /> {selectedSong.category}
                </span>
              </div>
            )}
            {currentView === 'form' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('recifra:save-song-form'))}
                  title="Salvar música"
                  aria-label="Salvar música"
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-white text-[#174EA6] hover:bg-[#E6ECF5] transition-all shadow-md"
                >
                  <Save size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('recifra:cancel-song-form'))}
                  title="Descartar edição"
                  aria-label="Descartar edição"
                  className="w-9 h-9 rounded-full bg-white text-[#0D47A1] border border-[#0D47A1] flex items-center justify-center hover:bg-red-50 hover:text-red-600 hover:border-red-600 hover:scale-110 active:scale-95 transition-all shadow-md"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            )}
            {currentView === 'details' && selectedSong && !selectedRepertorio && (
              <>
              <div className="hidden md:flex items-center gap-2">
                {isMaestro && (
                  <button 
                    onClick={() => {
                      setEditingSong(selectedSong);
                      setCurrentView('form');
                    }}
                    className="p-2 bg-white text-[#174EA6] border border-white rounded-full hover:bg-[#E6ECF5] hover:scale-110 active:scale-95 transition-all shadow-md"
                    title="Editar Música"
                  >
                    <Edit2 size={16} />
                  </button>
                )}

                <button 
                  onClick={() => downloadSongFile(selectedSong)}
                  className="p-2 bg-white text-[#174EA6] border border-white rounded-full hover:bg-[#E6ECF5] hover:scale-110 active:scale-95 transition-all shadow-md"
                  title="Baixar Música"
                >
                  <Download size={16} />
                </button>

                <button 
                  onClick={() => shareAsPDF([selectedSong], selectedSong.title)}
                  className="p-2 bg-white text-[#174EA6] border border-white rounded-full hover:bg-[#E6ECF5] hover:scale-110 active:scale-95 transition-all shadow-md"
                  title="Compartilhar"
                >
                  <Share2 size={16} />
                </button>
                
                {/* Repovido popover redundante */}

                {isMaestro && (
                  <button 
                    onClick={() => {
                      if (window.confirm('Excluir esta música permanentemente?')) {
                        deleteSong(selectedSong.id!);
                        setCurrentView('list');
                      }
                    }}
                    className="p-2 bg-white text-[#0D47A1] border border-[#0D47A1] rounded-full hover:bg-red-50 hover:text-red-600 hover:border-red-600 hover:scale-110 active:scale-95 transition-all shadow-md"
                    title="Excluir Música"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="md:hidden relative" data-mobile-song-actions>
                <button
                  type="button"
                  onClick={() => setIsMobileSongActionsOpen(open => !open)}
                  aria-label="Abrir ações da música"
                  title="Ações da música"
                  className="w-9 h-9 rounded-full text-white flex items-center justify-center"
                >
                  <MoreVertical size={22} />
                </button>
                <AnimatePresence>
                  {isMobileSongActionsOpen && (
                    <motion.div initial={{opacity:0,y:-5}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-5}} className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-[#D1D5DB] bg-white py-1 shadow-xl z-[220] text-black">
                      {isMaestro && <button type="button" onClick={() => { setEditingSong(selectedSong); setCurrentView('form'); setIsMobileSongActionsOpen(false); }} className="w-full px-4 py-3 flex items-center gap-3 text-left text-sm font-bold hover:bg-[#EEF1F5]"><Edit2 size={16} /> Editar</button>}
                      <button type="button" onClick={() => { downloadSongFile(selectedSong); setIsMobileSongActionsOpen(false); }} className="w-full px-4 py-3 flex items-center gap-3 text-left text-sm font-bold hover:bg-[#EEF1F5]"><Download size={16} /> Baixar</button>
                      <button type="button" onClick={() => { shareAsPDF([selectedSong], selectedSong.title); setIsMobileSongActionsOpen(false); }} className="w-full px-4 py-3 flex items-center gap-3 text-left text-sm font-bold hover:bg-[#EEF1F5]"><Share2 size={16} /> Compartilhar</button>
                      {isMaestro && <button type="button" onClick={() => { if (window.confirm('Excluir esta música permanentemente?')) { deleteSong(selectedSong.id!); setCurrentView('list'); } setIsMobileSongActionsOpen(false); }} className="w-full px-4 py-3 flex items-center gap-3 text-left text-sm font-bold text-red-600 hover:bg-red-50"><Trash2 size={16} /> Excluir</button>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              </>
            )}
          </div>
        </header>

        {/* Busca, ordenação e filtros permanecem disponíveis na navegação lateral. */}
        {false && currentView === 'list' && isMaestro && (
          <div className="px-5 pb-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                <input 
                  type="text"
                  placeholder="Buscar música, artista ou trecho da letra..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-[#D1D5DB] rounded-xl py-3 pl-10 pr-10 focus:ring-1 focus:ring-[#D1D5DB] transition-all outline-none text-[#666666] placeholder:text-[#B8BEC8]"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0D47A1] hover:text-[#0D47A1]/80 transition-colors"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <div className="flex-1 sm:w-48 bg-surface border border-border rounded-xl px-3 flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-text-dim whitespace-nowrap">Ordenar:</span>
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full bg-transparent border-none text-[10px] font-bold uppercase tracking-wider text-primary outline-none cursor-pointer py-3 pr-8"
                  >
                    <option value="title">Título</option>
                    <option value="composition">Composição</option>
                    <option value="artist">Artista</option>
                    <option value="updatedAt">Modificação</option>
                  </select>
                </div>

                <button 
                  onClick={() => setIsFilterActive(!isFilterActive)}
                  className={`px-4 rounded-xl border transition-all flex items-center gap-2 uppercase text-[10px] font-bold tracking-widest ${isFilterActive ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-surface border-border text-text-dim hover:border-primary/50'}`}
                >
                  <Filter size={14} />
                  <span className="hidden lg:inline">Filtros</span>
                </button>
              </div>
            </div>

            <AnimatePresence>
              {isFilterActive && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface/50 p-4 rounded-xl border border-border overflow-hidden"
                >
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-text-dim px-1">Tonalidade</label>
                    <select 
                      value={filterKey}
                      onChange={(e) => setFilterKey(e.target.value)}
                      className="w-full bg-bg border border-border rounded-lg p-2.5 text-xs font-bold outline-none"
                    >
                      <option value="">Todas</option>
                      {allKeys.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-text-dim px-1">Andamento</label>
                    <select 
                      value={filterTempo}
                      onChange={(e) => setFilterTempo(e.target.value)}
                      className="w-full bg-bg border border-border rounded-lg p-2.5 text-xs font-bold outline-none"
                    >
                      <option value="">Todos</option>
                      <option value="Lento">Lento</option>
                      <option value="Moderado">Moderado</option>
                      <option value="Rápido">Rápido</option>
                    </select>
                  </div>
                  <div className="space-y-1 flex flex-col">
                    <label className="text-[9px] font-bold uppercase tracking-widest text-text-dim px-1">Categoria</label>
                    <div className="flex gap-2">
                      <select 
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="flex-1 bg-bg border border-border rounded-lg p-2.5 text-xs font-bold outline-none"
                      >
                        <option value="">Todas</option>
                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                      {(filterKey || filterTempo || filterCategory) && (
                        <button 
                          onClick={() => {
                            setFilterKey('');
                            setFilterTempo('');
                            setFilterCategory('');
                          }}
                          className="p-2.5 text-red-500 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors"
                          title="Limpar Filtros"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Atalhos de cadastro ficam fora do cabeçalho, imediatamente abaixo dele. */}
      {currentView === 'list' && sidebarTab === 'songs' && (
        <div className="px-5 pt-3 pb-2 flex gap-2 bg-bg">
          <button type="button" disabled={!isMaestro} onClick={() => { setEditingSong(null); setSelectedRepertorio(null); setCurrentView('form'); }} className="flex-1 h-12 rounded-xl bg-[#174EA6] text-white flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wide disabled:opacity-40">
            <Plus size={16} /> Música
          </button>
          <button type="button" disabled={!isMaestro} onClick={() => setManagingFolderType('song')} className="flex-1 h-12 rounded-xl bg-[#174EA6] text-white flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wide disabled:opacity-40">
            <FolderPlus size={16} /> Pasta
          </button>
        </div>
      )}

      <main className={`flex-1 p-5 ${currentView === 'details' ? 'pb-0 overflow-hidden' : 'pb-32 overflow-y-auto'}`}>
        <AnimatePresence mode="wait">
          {currentView === 'list' && (
            <motion.div 
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {isMaestro ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedFolders(['all']);
                        setIsSidebarOpen(true);
                      }}
                      className="flex items-center gap-3 rounded-2xl border border-[#DCE3EC] bg-[#EEF1F5] p-4 text-left transition-colors hover:bg-[#E6ECF5]"
                    >
                      <FolderOpen size={20} className="shrink-0 text-[#174EA6]" />
                      <span className="min-w-0 flex-1 text-sm font-bold uppercase text-black">TODOS</span>
                      <span className="rounded-md bg-[#174EA6] px-2 py-1 text-[10px] font-bold text-white">{songs.length}</span>
                      <ChevronRight size={16} className="text-[#174EA6]" />
                    </button>
                    {folders.filter(f => !f.type || f.type === 'song').length === 0 && (
                      <div className="rounded-2xl border border-dashed border-[#C9D5E6] bg-white p-6 text-center text-sm text-text-dim">
                        Nenhuma pasta cadastrada.
                      </div>
                    )}
                    {folders.filter(f => !f.type || f.type === 'song').map(folder => {
                        const folderCount = songs.filter(song => song.folderId === folder.id).length;
                        return (
                          <button
                            key={folder.id}
                            type="button"
                            onClick={() => {
                              setExpandedFolders([folder.id!]);
                              setIsSidebarOpen(true);
                            }}
                            className="flex items-center gap-3 rounded-2xl border border-[#DCE3EC] bg-[#EEF1F5] p-4 text-left transition-colors hover:bg-[#E6ECF5]"
                          >
                            <FolderIcon size={20} className="shrink-0 text-[#174EA6]" />
                            <span className="min-w-0 flex-1 truncate text-sm font-bold uppercase text-black">{folder.name}</span>
                            <span className="rounded-md bg-[#174EA6] px-2 py-1 text-[10px] font-bold text-white">{folderCount}</span>
                            <ChevronRight size={16} className="text-[#174EA6]" />
                          </button>
                        );
                    })}
                  </div>
                </div>
              ) : (
                // Sem tela intermediária de espera: o usuário permanece na área normal do aplicativo.
                <div className="min-h-[12vh]" />
              )}
            </motion.div>
          )}

          {currentView === 'details' && selectedSong && (
            <motion.div 
              key="details"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.x > 100) navigateRepertorio('prev');
                else if (info.offset.x < -100) navigateRepertorio('next');
              }}
              onTouchStart={handlePinchStart}
              onTouchMove={handlePinchMove}
              onTouchEnd={() => setInitialDist(null)}
              className={`space-y-0 relative h-[calc(100vh-120px)] flex flex-col overflow-hidden ${(!isDesktop && isMaestro) ? 'touch-none' : ''}`}
            >
              {/* Touch Navigation Overlay */}
              {selectedRepertorio && (
                <div className="absolute inset-x-0 top-0 bottom-0 pointer-events-none z-50 flex">
                  <div 
                    className="flex-1 pointer-events-auto cursor-w-resize active:bg-primary/5 transition-colors"
                    onClick={() => navigateRepertorio('prev')}
                    title="Música Anterior"
                  />
                  <div 
                    className="flex-1 pointer-events-auto cursor-e-resize active:bg-primary/5 transition-colors"
                    onClick={() => navigateRepertorio('next')}
                    title="Próxima Música"
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 relative z-[60] px-6 pb-4 md:px-[4.5rem] lg:px-[6.5rem]">
                <div className="space-y-1 flex-1 min-w-0">
                  {!selectedSong.isGroup ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="inline-flex items-center gap-2 text-[18px] font-extrabold tracking-tight leading-tight mr-2 uppercase"><Music2 size={18} className="shrink-0" />{selectedSong.title}</h2>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-dim font-light mt-1">
                        <span className="inline-flex items-center gap-1.5"><Mic2 size={14} className="shrink-0" />{selectedSong.artist}</span>
                        {selectedSong.composition && <span className="inline-flex items-center gap-1.5"><Users size={14} className="shrink-0" />{selectedSong.composition}</span>}
                      </div>
                    </>
                  ) : null}
                </div>

                {sidebarTab === 'songs' && !selectedRepertorio && !selectedSong.isGroup && (
                  <div className="hidden lg:flex flex-wrap items-center gap-1.5 justify-end self-end sm:self-start w-full sm:w-auto">
                  <div className="relative" data-key-picker-root>
                    <button type="button" onClick={() => setIsKeyPickerOpen(!isKeyPickerOpen)} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-black bg-[#174EA6] text-white border border-[#174EA6]"><Music size={14} /> Tom: {currentKey}</button>
                    <AnimatePresence>
                      {isKeyPickerOpen && (
                        <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:6}} className="absolute top-full right-0 mt-2 w-56 bg-white border border-border rounded-xl shadow-2xl z-[200] grid grid-cols-4 p-2 gap-1">
                          {songKeyOptions.map(k => <button key={k} type="button" onClick={e => { e.stopPropagation(); handleKeySelect(k); }} className={`p-2 text-[10px] font-bold rounded-lg border ${k === currentKey ? 'bg-primary border-primary text-white' : 'bg-bg border-border text-text-dim'}`}>{k}</button>)}
                          {vocalistKeyOptions.length > 0 && (
                            <div className="col-span-4 mt-1 pt-2 border-t border-border/70">
                              <div className="flex items-center gap-1.5 px-1 pb-1.5 text-[9px] font-black uppercase tracking-wider text-text-dim">
                                <Mic2 size={11} /> Tons dos vocalistas
                              </div>
                              <div className="max-h-40 overflow-y-auto space-y-1">
                                {vocalistKeyOptions.map(vocalist => (
                                  <button
                                    key={vocalist.id}
                                    type="button"
                                    onClick={e => { e.stopPropagation(); handleVocalistKeySelect(vocalist.key); }}
                                    className={`w-full flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${currentKey === vocalist.key ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-bg border-border text-text-dim hover:border-primary/40'}`}
                                  >
                                    <span className="min-w-0 truncate text-[10px] font-bold">{vocalist.name}</span>
                                    <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">{vocalist.key}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {selectedSong.tempo && <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold bg-[#4F78E8] text-white"><Hourglass size={14} />{selectedSong.tempo}</span>}
                  {selectedSong.category && <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold bg-[#EEF1F5] text-[#174EA6] border border-[#DCE3EC]"><Tag size={14} />{selectedSong.category}</span>}
                  </div>
                )}
              </div>

              <div 
                ref={songViewRef}
                className={`pt-0 relative flex-1 select-none ${isDesktop ? 'overflow-y-auto' : 'overflow-hidden'}`}
                onClick={(e) => {
                  if (isDesktop) return;
                  const width = e.currentTarget.clientWidth;
                  const x = e.nativeEvent.offsetX;
                  if (x > width * 0.7) {
                    if (totalPages > 1 && currentPage < totalPages - 1) handlePageChange('next');
                    else navigateRepertorio('next');
                  }
                  else if (x < width * 0.3) {
                    if (totalPages > 1 && currentPage > 0) handlePageChange('prev');
                    else navigateRepertorio('prev');
                  }
                }}
              >
                <div 
                  className={isDesktop ? '' : 'overflow-hidden h-full'}
                  style={{ 
                    height: (selectedSong.isGroup || (selectedSong.pdfPages && selectedSong.pdfPages.length > 0) || isDesktop)
                      ? 'auto' 
                      : `calc(100% - 60px)` 
                  }}
                >
                  {selectedSong.isGroup ? (
                    <GroupPageView 
                      group={(selectedSong as any).groupData} 
                      songs={songs} 
                      allIds={selectedRepertorio.songIds} 
                      repertorio={selectedRepertorio}
                    />
                  ) : selectedSong.pdfPages && selectedSong.pdfPages.length > 0 ? (
                    <div 
                      className={`flex transition-transform duration-500 ease-in-out ${isDesktop ? 'flex-col w-full' : 'h-full flex-row w-full'}`}
                      style={{ 
                        transform: isDesktop ? 'none' : `translateX(-${currentPage * 100}%)` 
                      }}
                    >
                        {selectedSong.pdfPages.map((url, idx) => (
                          <div key={idx} className="flex-shrink-0 w-full h-full flex items-center justify-center p-4">
                            <div 
                              className="bg-surface rounded-xl overflow-hidden border border-border shadow-lg transition-all duration-300"
                              style={{ 
                                width: '100%', 
                                maxWidth: `${Math.min(100, (64 * chordProScale))}rem`
                              }}
                            >
                               <img 
                                 src={url} 
                                 alt={`Página ${idx + 1}`} 
                                 className="w-full h-auto block object-contain"
                                 referrerPolicy="no-referrer"
                               />
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="relative h-full overflow-hidden">
                      {!isDesktop && (
                        <div 
                          ref={contentRef}
                          className="absolute top-0 left-0 opacity-0 pointer-events-none"
                          style={{ 
                            width: songViewRef.current?.clientWidth || '100%',
                            paddingLeft: '1.5rem',
                            paddingRight: '1.5rem',
                            paddingTop: '8px'
                          }}
                        >
                          <div className="md:px-12 lg:px-20">
                            <ChordProRenderer 
                              text={transposeChordPro(selectedSong.chordPro, transposition)} 
                              chordSize={Number(localStorage.getItem('recifra_chord_size') || 13) * chordProScale}
                              lyricSize={Number(localStorage.getItem('recifra_lyric_size') || 14) * chordProScale}
                            />
                          </div>
                        </div>
                      )}

                      <div 
                        className={`flex h-full w-full ${isDesktop ? 'flex-col' : 'transition-transform duration-500 ease-in-out'}`}
                        style={{ 
                          transform: isDesktop ? 'none' : `translateX(-${currentPage * 100}%)`
                        }}
                      >
                        {Array.from({ length: totalPages }).map((_, idx) => (
                          <div key={idx} className="flex-shrink-0 w-full h-full overflow-hidden">
                            <div 
                              style={{ 
                                paddingLeft: '1.5rem',
                                paddingRight: '1.5rem',
                                paddingBottom: isDesktop ? '32px' : '50px',
                                paddingTop: isDesktop ? '0px' : '8px'
                              }}
                            >
                              <div className="md:px-12 lg:px-20">
                                <ChordProRenderer 
                                  text={transposeChordPro(selectedSong.chordPro, transposition)} 
                                  chordSize={Number(localStorage.getItem('recifra_chord_size') || 13) * chordProScale}
                                  lyricSize={Number(localStorage.getItem('recifra_lyric_size') || 14) * chordProScale}
                                  lineRange={pageBreakIndices[idx]}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {totalPages > 1 && currentPage < totalPages - 1 && (
                  <div className="absolute bottom-[25px] right-4 z-[100] pointer-events-none">
                    <motion.div 
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-8 h-8 rounded-full bg-primary backdrop-blur-sm flex items-center justify-center text-white shadow-lg pointer-events-auto cursor-pointer hover:bg-primary/90 transition-all active:scale-95"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePageChange('next');
                      }}
                    >
                      <ChevronRight size={18} strokeWidth={3} />
                    </motion.div>
                  </div>
                )}
                
                {totalPages > 1 && currentPage > 0 && (
                  <div className="absolute bottom-[25px] left-4 z-[100] pointer-events-none">
                    <motion.div 
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-8 h-8 rounded-full bg-surface/90 backdrop-blur-sm flex items-center justify-center border border-border text-primary shadow-lg pointer-events-auto cursor-pointer hover:bg-bg transition-all active:scale-95"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePageChange('prev');
                      }}
                    >
                      <ChevronLeft size={18} strokeWidth={3} />
                    </motion.div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {currentView === 'repertorios' && !selectedRepertorio && (
            <motion.div
              key="repertorios-overview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-text-dim">Selecione um repertório para visualizar e editar suas músicas.</p>
                {isMaestro && (
                  <button
                    onClick={() => { setEditingRepertorio(null); setCurrentView('repertorio-form'); }}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#174EA6] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white"
                  >
                    <Plus size={15} /> Novo
                  </button>
                )}
              </div>
              {filteredRepertorios.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#C9D5E6] bg-white p-10 text-center text-sm text-text-dim">
                  Nenhum repertório cadastrado.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredRepertorios.map(repertorio => (
                    <button
                      key={repertorio.id}
                      onClick={() => { setSelectedRepertorio(repertorio); setSidebarView('repertorio-songs'); setIsSidebarOpen(true); }}
                      className="flex items-center gap-3 rounded-2xl border border-[#DCE3EC] bg-[#EEF1F5] p-4 text-left transition-colors hover:bg-[#E6ECF5]"
                    >
                      <ListMusic size={20} className="shrink-0 text-[#174EA6]" />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold uppercase text-black">{repertorio.title}</span>
                      <span className="rounded-md bg-[#174EA6] px-2 py-1 text-[10px] font-bold text-white">{repertorio.songIds?.length || 0}</span>
                      <ChevronRight size={16} className="text-[#174EA6]" />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {currentView === 'repertorios' && selectedRepertorio && (
            <motion.div 
              key="repertorio-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tighter uppercase">{selectedRepertorio.title}</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setEditingRepertorio(selectedRepertorio);
                      setCurrentView('repertorio-form');
                    }}
                    className="p-2 bg-surface rounded-lg text-text-dim hover:text-text-main"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => deleteRepertorio(selectedRepertorio.id)}
                    className="p-2 bg-surface rounded-lg text-text-dim hover:text-red-500"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              <div className="p-12 bg-surface border border-border rounded-2xl text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
                  <ListMusic size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Repertório Selecionado</h3>
                  <p className="text-text-dim">A lista de músicas está disponível na barra lateral.</p>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="px-6 py-2 bg-primary text-white rounded-lg font-bold"
                >
                  Abrir Barra Lateral
                </button>
              </div>
            </motion.div>
          )}

          {currentView === 'settings' && (
            <motion.div 
              key="settings-page"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-surface rounded-full text-primary">
                  {activeSettingsTab === 'geral' ? <Settings size={24} /> : 
                   activeSettingsTab === 'ia' ? <Brain size={24} /> :
                   activeSettingsTab === 'users' ? <Users size={24} /> :
                   activeSettingsTab === 'pedais' ? <Gamepad size={24} /> : 
                   activeSettingsTab === 'acordes' ? <Hash size={24} /> : 
                   <Info size={24} />}
                </button>
                <h2 className="text-xl font-bold uppercase tracking-tighter">{
                  activeSettingsTab === 'geral' ? 'Geral' : 
                  activeSettingsTab === 'ia' ? 'Chave API' :
                  activeSettingsTab === 'users' ? 'Controle de Usuários' :
                  activeSettingsTab === 'pedais' ? 'Controladores' : 
                  activeSettingsTab === 'acordes' ? 'Banco de Acordes' : 
                  'Sobre'
                }</h2>
              </div>

              {activeSettingsTab === 'geral' && (
                <div className="max-w-2xl space-y-4">
                  <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div><h3 className="text-sm font-bold text-primary">Aparência</h3><p className="text-[11px] text-text-dim">Personalize a leitura das músicas.</p></div>
                      <Settings size={20} className="text-primary" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setDarkMode(false)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${!darkMode ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-dim'}`}>Claro</button>
                      <button onClick={() => setDarkMode(true)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${darkMode ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-dim'}`}>Escuro</button>
                    </div>
                  </section>
                  <section className="rounded-2xl border border-border bg-surface p-4 space-y-3">
                    <div><h3 className="text-sm font-bold text-primary">Tipografia das músicas</h3><p className="text-[11px] text-text-dim">As preferências são aplicadas ao editor e ao visor.</p></div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="space-y-1"><span className="block text-[10px] font-bold uppercase text-text-dim">Tamanho da letra</span><input type="range" min="10" max="24" defaultValue={Number(localStorage.getItem('recifra_lyric_size') || 14)} onChange={e => { localStorage.setItem('recifra_lyric_size', e.target.value); window.dispatchEvent(new Event('recifra:display-settings')); }} className="w-full accent-[#174EA6]" /><span className="text-xs text-text-dim">{localStorage.getItem('recifra_lyric_size') || '14'} px</span></label>
                      <label className="space-y-1"><span className="block text-[10px] font-bold uppercase text-text-dim">Tamanho dos acordes</span><input type="range" min="9" max="24" defaultValue={Number(localStorage.getItem('recifra_chord_size') || 13)} onChange={e => { localStorage.setItem('recifra_chord_size', e.target.value); window.dispatchEvent(new Event('recifra:display-settings')); }} className="w-full accent-[#174EA6]" /><span className="text-xs text-text-dim">{localStorage.getItem('recifra_chord_size') || '13'} px</span></label>
                      <label className="space-y-1"><span className="block text-[10px] font-bold uppercase text-text-dim">Cor da letra</span><div className="flex items-center gap-2"><input type="color" defaultValue={localStorage.getItem('recifra_lyric_color') || '#333333'} onChange={e => { localStorage.setItem('recifra_lyric_color', e.target.value); window.dispatchEvent(new Event('recifra:display-settings')); }} className="h-8 w-12 rounded border border-border" /><span className="text-xs text-text-dim">{localStorage.getItem('recifra_lyric_color') || '#333333'}</span></div></label>
                      <label className="space-y-1"><span className="block text-[10px] font-bold uppercase text-text-dim">Cor dos acordes</span><div className="flex items-center gap-2"><input type="color" defaultValue={localStorage.getItem('recifra_chord_color') || '#ff6900'} onChange={e => { localStorage.setItem('recifra_chord_color', e.target.value); window.dispatchEvent(new Event('recifra:display-settings')); }} className="h-8 w-12 rounded border border-border" /><span className="text-xs text-text-dim">{localStorage.getItem('recifra_chord_color') || '#ff6900'}</span></div></label>
                    </div>
                  </section>
                  <section className="rounded-2xl border border-border bg-surface p-4 space-y-2">
                    <h3 className="text-sm font-bold text-primary">Conta</h3>
                    <div className="flex items-center justify-between text-xs"><span className="text-text-dim">Perfil</span><strong>{isMaestro ? 'Maestro' : 'Músico'}</strong></div>
                    <div className="flex items-center justify-between text-xs"><span className="text-text-dim">Status</span><strong>{appUser?.status === 'active' ? 'Ativo' : 'Pendente'}</strong></div>
                    <div className="text-[11px] text-text-dim truncate">{appUser?.displayName} · {appUser?.email}</div>
                  </section>
                  <section className="rounded-2xl border border-border bg-surface p-4 space-y-2">
                    <h3 className="text-sm font-bold text-primary">Qualidade de importação PDF</h3>
                    <div className="flex gap-2">{(['low', 'medium', 'high'] as PDFQuality[]).map(q => <button key={q} onClick={() => { setPdfQuality(q); localStorage.setItem('pdfQuality', q); }} className={`flex-1 rounded-lg border py-2 text-[10px] font-bold uppercase ${pdfQuality === q ? 'bg-primary border-primary text-white' : 'border-border text-text-dim'}`}>{q === 'low' ? 'Baixa' : q === 'medium' ? 'Média' : 'Alta'}</button>)}</div>
                  </section>
                </div>
              )}

              {activeSettingsTab === 'users' && isMaestro && (
                <div className="space-y-6 max-w-4xl">
                  <div className="p-6 bg-surface border border-border rounded-2xl">
                    <h3 className="font-bold uppercase tracking-widest text-sm mb-6 flex items-center gap-2">
                       <Users size={20} className="text-primary" />
                       Controle de Usuários ({allUsers.length})
                    </h3>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-widest text-text-dim border-b border-border">
                            <th className="pb-4 font-bold">Usuário</th>
                            <th className="pb-4 font-bold text-center">Status</th>
                            <th className="pb-4 font-bold text-center">Perfil</th>
                            <th className="pb-4 font-bold text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {allUsers.map((u) => (
                            <tr key={u.uid} className="text-sm">
                              <td className="py-4">
                                <div className="font-bold">{u.displayName}</div>
                                <div className="text-xs text-text-dim">{u.email}</div>
                              </td>
                              <td className="py-4 text-center">
                                <button 
                                  onClick={() => handleUpdateUser(u.uid, { status: u.status === 'active' ? 'pending' : 'active' })}
                                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter border ${
                                    u.status === 'active' 
                                    ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                                    : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                  }`}
                                >
                                  {u.status === 'active' ? 'Ativo' : 'Pendente'}
                                </button>
                              </td>
                              <td className="py-4 text-center">
                                <button 
                                  onClick={() => handleUpdateUser(u.uid, { role: u.role === 'maestro' ? 'musician' : 'maestro' })}
                                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors ${
                                    u.role === 'maestro' 
                                    ? 'bg-primary text-white border-primary' 
                                    : 'bg-surface text-text-dim border-border'
                                  }`}
                                >
                                  {u.role === 'maestro' ? 'Maestro' : 'Músico'}
                                </button>
                              </td>
                              <td className="py-4 text-right">
                                {u.uid !== user?.uid && (
                                  <button 
                                    onClick={() => handleDeleteUser(u.uid)}
                                    className="p-2 text-text-dim hover:text-red-500 transition-colors"
                                    title="Remover Usuário"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

               {activeSettingsTab === 'ia' && (
                <div className="space-y-8 max-w-2xl">
                  <section className="bg-surface border border-border rounded-2xl p-8 space-y-6">
                    <div className="flex items-center gap-4 text-primary">
                      <div className="p-3 bg-primary/10 rounded-xl">
                        <Brain size={32} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">Configuração da IA</h3>
                        <p className="text-text-dim text-sm">O #semba usa o Google Gemini para gerar blocos de sugestões.</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-text-dim uppercase mb-2 block">Minha Chave da API Gemini</label>
                        <div className="flex gap-2">
                          <input 
                            type="password"
                            value={customApiKey}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomApiKey(val);
                              localStorage.setItem('GEMINI_API_KEY', val);
                            }}
                            placeholder="Cole sua chave aqui..."
                            className="flex-1 bg-bg border border-border rounded-xl px-4 py-3 focus:ring-1 focus:ring-primary outline-none"
                          />
                          <button 
                            onClick={() => {
                              setCustomApiKey('');
                              localStorage.removeItem('GEMINI_API_KEY');
                              alert('Chave removida.');
                            }}
                            className="px-4 bg-surface border border-border rounded-xl text-text-dim hover:text-red-500"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>

                      <div className="p-4 bg-bg/50 border border-border border-dashed rounded-xl">
                        <p className="text-[11px] text-text-dim leading-normal">
                          A chave é salva localmente no seu navegador para uso em suas sessões. 
                        </p>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-border">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-text-dim mb-3">Modelos Suportados:</h4>
                        <ul className="text-sm text-text-dim space-y-2 list-disc list-inside">
                            <li>Gemini 3 Flash (Recomendado)</li>
                            <li>Gemini 3.1 Pro (Para analises avançadas)</li>
                        </ul>
                    </div>
                  </section>
                </div>
              )}

              {activeSettingsTab === 'pedais' && (
                <div className="space-y-8 max-w-2xl">
                  <section>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-text-dim mb-4">Ação / Acionador:</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-6 bg-surface border border-border rounded-2xl flex flex-col items-center justify-center gap-4 text-center">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Próxima Página</div>
                        <button 
                          onClick={() => setIsCapturingKey('next')}
                          className={`w-full py-6 rounded-xl text-2xl font-bold uppercase transition-all shadow-sm ${isCapturingKey === 'next' ? 'bg-primary text-white animate-pulse shadow-primary/20' : 'bg-bg border-2 border-border text-text-main'}`}
                        >
                          {isCapturingKey === 'next' ? 'Aguardando...' : pedalConfig.next}
                        </button>
                        <div className="text-[10px] text-text-dim font-bold uppercase">Clique para alterar</div>
                      </div>
                      <div className="p-6 bg-surface border border-border rounded-2xl flex flex-col items-center justify-center gap-4 text-center">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Página Anterior</div>
                        <button 
                          onClick={() => setIsCapturingKey('prev')}
                          className={`w-full py-6 rounded-xl text-2xl font-bold uppercase transition-all shadow-sm ${isCapturingKey === 'prev' ? 'bg-primary text-white animate-pulse shadow-primary/20' : 'bg-bg border-2 border-border text-text-main'}`}
                        >
                          {isCapturingKey === 'prev' ? 'Aguardando...' : pedalConfig.prev}
                        </button>
                        <div className="text-[10px] text-text-dim font-bold uppercase">Clique para alterar</div>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {activeSettingsTab === 'acordes' && (
                <ChordBankManager 
                  chordBanks={chordBanks} 
                  onSave={async (note, chords) => {
                    if (!user) return;
                    try {
                      const bank = chordBanks.find(b => b.note === note);
                      if (bank?.id) {
                        await updateDoc(doc(db, 'chord_banks', bank.id), { chords });
                      } else {
                        await addDoc(collection(db, 'chord_banks'), { note, chords, createdBy: user.uid });
                      }
                      alert(`Banco de ${note} salvo com sucesso!`);
                    } catch (error) {
                      console.error('Error saving bank:', error);
                    }
                  }}
                  onClose={() => {
                    setCurrentView('settings');
                    setIsSidebarOpen(true);
                  }}
                />
              )}

              {activeSettingsTab === 'sobre' && (
                <div className="space-y-6">
                  <div className="p-12 bg-surface border border-border rounded-2xl text-center space-y-6">
                    <div className="flex justify-center"><img src={SEMBA_LOGO_SRC} alt="#semba — O palco aos seus pés" className="h-12 w-auto max-w-full object-contain" /></div>
                    <div className="space-y-2">
                      <p className="font-bold uppercase text-text-dim tracking-widest text-sm">Versão 2.3.0</p>
                      <p className="text-text-dim italic">Desenvolvido para músicos, por músicos.</p>
                    </div>
                  </div>

                  <div className="p-12 bg-surface border border-border rounded-2xl text-center space-y-4">
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
                      <Radio size={32} />
                    </div>
                    <h3 className="text-xl font-bold uppercase tracking-tighter">Sincronização em Nuvem</h3>
                    <p className="text-text-dim max-w-md mx-auto uppercase text-[10px] font-bold tracking-widest leading-loose">Seus dados são sincronizados automaticamente com o Firebase em tempo real.</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {currentView === 'blocks' && (
            <motion.div 
              key="blocks-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >

              <SongBlockList 
                blocks={songBlocks} 
                songs={songs}
                isMaestro={isMaestro}
                onSelect={(block) => {
                    setSelectedBlockSet(block);
                    setCurrentView('block-details');
                }}
                onDelete={deleteSongBlock}
              />
            </motion.div>
          )}

          {currentView === 'block-form' && (
            <SongBlockForm 
                songs={songs} 
                user={user} 
                folderId={selectedBlockFolderId || undefined}
                onSave={saveSongBlock}
                onCancel={() => { setSelectedBlockFolderId(null); setCurrentView('blocks'); }}
            />
          )}

          {currentView === 'block-details' && selectedBlockSet && (
            (selectedBlockSet.suggestions || []).length === 0 ? (
              <div className="flex min-h-[60vh] w-full items-center justify-center px-4">
                <div className="flex max-w-md flex-col items-center gap-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF1F5] text-[#174EA6]">
                    <FolderIcon size={30} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-base font-black uppercase tracking-wide text-[#174EA6]">Este conjunto ainda está vazio</h2>
                    <p className="text-sm text-text-dim">Crie um novo bloco para começar a organizar as músicas deste conjunto.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addBlockToSelectedSet}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#174EA6] px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-[#123D87]"
                  >
                    <Plus size={16} /> Bloco
                  </button>
                </div>
              </div>
            ) : (
              <SongBlockDetails 
                  blockSet={selectedBlockSet}
                  songs={songs}
                  repertorios={repertorios}
                  onAddToRepertorio={addBlockSuggestionToRepertorio}
                  onUpdate={updateSongBlock}
                  onBack={() => setCurrentView('blocks')}
              />
            )
          )}

          {currentView === 'repertorio-form' && (
            <motion.div 
              key="repertorio-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <RepertorioForm 
                initialData={editingRepertorio || undefined} 
                songs={songs}
                folders={folders}
                repertorios={repertorios}
                categories={categories}
                onSave={saveRepertorio} 
                onCancel={() => {
                  setCurrentView('repertorios');
                  setEditingRepertorio(null);
                  setSidebarView('repertorio-songs');
                  setIsSidebarOpen(true);
                }} 
              />
            </motion.div>
          )}

          {currentView === 'form' && (
            <motion.div 
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <SongForm 
                initialData={editingSong || undefined} 
                categories={categories}
                folders={folders}
                labels={labels}
                chordBanks={chordBanks}
                isMaestro={isMaestro}
                onSave={saveSong}
                onAutoSave={autoSaveSong}
                onDiscard={discardAutoSavedSong}
                onCancel={() => {
                  setCurrentView(selectedSong ? 'details' : 'list');
                  setEditingSong(null);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {managingFolderType && (
          <FolderManager 
            folders={folders}
            type={managingFolderType}
            onClose={() => {
              setManagingFolderType(null);
              setIsSidebarOpen(true);
            }}
          />
        )}

        <AnimatePresence>
          {isMovingSingleSong && (
            <FolderSelectionModal
              folders={folders}
              type="song"
              onSelect={handleMoveSingleSong}
              onClose={() => { setIsMovingSingleSong(false); setSelectedSongIdForAction(null); }}
            />
          )}
          {isPickingFolderForNewBlock && (
            <FolderSelectionModal
              folders={folders}
              type="block"
              onSelect={(folderId) => {
                setIsPickingFolderForNewBlock(false);
                void openBlockFolder(folderId, true);
              }}
              onClose={() => { setIsPickingFolderForNewBlock(false); setIsSidebarOpen(true); }}
            />
          )}
          {isPickingFolderForNewRep && (
            <FolderSelectionModal 
              folders={folders}
              type="repertorio"
              onSelect={(folderId) => {
                setEditingRepertorio({ folderId } as any);
                setCurrentView('repertorio-form');
                setIsPickingFolderForNewRep(false);
              }}
              onClose={() => {
                setIsPickingFolderForNewRep(false);
                setIsSidebarOpen(true);
              }}
            />
          )}

          {importProgress && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[300] flex items-center justify-center p-6 text-center"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="max-w-sm w-full space-y-6"
              >
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
                  <motion.div 
                    className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center font-bold text-primary">
                    {importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0}%
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-bold uppercase tracking-tighter text-white">Importando Acervo</h3>
                  <p className="text-primary/80 font-bold text-xs uppercase tracking-widest animate-pulse">
                    {importProgress.message}
                  </p>
                  <div className="text-[10px] text-white/40 uppercase tracking-widest">
                    Arquivo {importProgress.current} de {importProgress.total}
                  </div>
                </div>

                <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  />
                </div>
                
                <p className="text-[10px] text-white/30 uppercase leading-relaxed">
                  Por favor, não feche esta janela. O processamento de PDFs pode levar alguns segundos por arquivo devido à conversão de imagens.
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isRepertorioJsonExportModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-[650] flex items-center justify-center p-4 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                className="bg-surface w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-border"
              >
                <div className="p-4 border-b border-border flex items-center justify-between bg-primary">
                  <div>
                    <h3 className="font-bold text-white uppercase tracking-widest text-xs">Exportar Repertório/Setlist</h3>
                    <p className="text-[10px] text-white/70 mt-1">Selecione uma pasta completa ou um setlist.</p>
                  </div>
                  <button onClick={() => setIsRepertorioJsonExportModalOpen(false)} className="text-white/80 hover:text-white"><X size={20} /></button>
                </div>
                <div className="p-3 max-h-[65vh] overflow-y-auto space-y-3">
                  {folders.filter(folder => folder.type === 'repertorio').map(folder => {
                    const folderSetlists = repertorios.filter(item => item.folderId === folder.id);
                    return (
                      <div key={folder.id} className="rounded-xl border border-border overflow-hidden">
                        <button
                          onClick={() => handleRepertorioJsonExport({ type: 'folder', id: folder.id! })}
                          className="w-full flex items-center gap-3 p-3 text-left hover:bg-primary/10 transition-colors"
                        >
                          <FolderIcon size={19} className="text-primary shrink-0" />
                          <span className="font-bold text-sm flex-1">{folder.name}</span>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-text-dim">Pasta completa</span>
                        </button>
                        {folderSetlists.length > 0 && (
                          <div className="border-t border-border/70 bg-bg/40">
                            {folderSetlists.map((item: any) => (
                              <button
                                key={item.id}
                                onClick={() => handleRepertorioJsonExport({ type: 'setlist', id: item.id })}
                                className="w-full flex items-center gap-3 py-2.5 pl-10 pr-3 text-left hover:bg-primary/10 transition-colors border-b last:border-b-0 border-border/40"
                              >
                                <ListMusic size={16} className="text-primary/80 shrink-0" />
                                <span className="text-xs font-semibold flex-1">{item.title}</span>
                                <span className="text-[9px] uppercase font-bold tracking-wider text-text-dim">Setlist</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {repertorios.filter(item => !item.folderId).map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => handleRepertorioJsonExport({ type: 'setlist', id: item.id })}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border text-left hover:bg-primary/10 transition-colors"
                    >
                      <ListMusic size={18} className="text-primary shrink-0" />
                      <span className="text-sm font-semibold flex-1">{item.title}</span>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-text-dim">Setlist</span>
                    </button>
                  ))}
                  {folders.filter(folder => folder.type === 'repertorio').length === 0 && repertorios.length === 0 && (
                    <p className="text-center text-xs text-text-dim py-8">Nenhuma pasta ou setlist disponível para exportação.</p>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isExportFolderModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-[600] flex items-center justify-center p-4 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-surface w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-border"
              >
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-primary">
                  <h3 className="font-bold text-white uppercase tracking-widest text-xs">Exportar Acervo</h3>
                  <button 
                    onClick={() => {
                      setIsExportFolderModalOpen(false);
                      setIsSidebarOpen(true);
                    }} 
                    className="text-white/80 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="p-2 max-h-[60vh] overflow-y-auto">
                  <button 
                    onClick={() => {
                      processFolderExport(null);
                      setIsExportFolderModalOpen(false);
                      setIsSidebarOpen(true);
                    }}
                    className="w-full flex items-center gap-3 p-4 hover:bg-primary/10 rounded-xl transition-colors group border-b border-border/50"
                  >
                    <div className="p-2 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <LayoutList size={20} />
                    </div>
                    <span className="font-bold text-sm">Todas as Músicas</span>
                  </button>
                  {folders.filter(folder => !folder.type || folder.type === 'song').map(folder => (
                    <button 
                      key={folder.id}
                      onClick={() => {
                        processFolderExport(folder.id!);
                        setIsExportFolderModalOpen(false);
                        setIsSidebarOpen(true);
                      }}
                      className="w-full flex items-center gap-3 p-4 hover:bg-primary/10 rounded-xl transition-colors group"
                    >
                      <div className="p-2 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                        <FolderIcon size={20} />
                      </div>
                      <span className="font-bold text-sm">{folder.name}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isExportFormatModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-[600] flex items-center justify-center p-4 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-surface w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-border"
              >
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-primary">
                  <h3 className="font-bold text-white uppercase tracking-widest text-xs">Exportar Música</h3>
                  <button 
                    onClick={() => {
                      setIsExportFormatModalOpen(false);
                      setIsSidebarOpen(true);
                    }} 
                    className="text-white/80 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => {
                        handleBatchExportFormat('cho');
                        setIsExportFormatModalOpen(false);
                        setIsSidebarOpen(true);
                      }}
                      className="flex flex-col items-center gap-2 p-6 bg-surface border border-border rounded-2xl hover:border-primary hover:text-primary transition-all group"
                    >
                      <FileText size={32} className="text-text-dim group-hover:text-primary" />
                      <span className="font-bold uppercase tracking-widest text-xs">.CHO</span>
                    </button>
                    <button 
                      onClick={() => {
                        handleBatchExportFormat('pdf');
                        setIsExportFormatModalOpen(false);
                        setIsSidebarOpen(true);
                      }}
                      className="flex flex-col items-center gap-2 p-6 bg-surface border border-border rounded-2xl hover:border-primary hover:text-primary transition-all group"
                    >
                      <FilePlus size={32} className="text-text-dim group-hover:text-primary" />
                      <span className="font-bold uppercase tracking-widest text-xs">.PDF</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {isLogoutDialogOpen && (
            <div className="fixed inset-0 bg-black/60 z-[700] flex items-center justify-center p-4 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-surface w-full max-w-sm rounded-2xl border border-border p-8 text-center space-y-6"
              >
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto">
                  <LogOut size={32} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold uppercase tracking-tighter">Deseja Sair?</h3>
                  <p className="text-text-dim text-[10px] font-bold uppercase tracking-widest">Confirma o encerramento da sessão?</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setIsLogoutDialogOpen(false)}
                    className="py-3 bg-surface border border-border rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-border"
                  >
                    Não
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="py-3 bg-red-500 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all"
                  >
                    Sim
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {isImportModalOpen && !importProgress && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-bg border border-border rounded-2xl w-full max-w-sm overflow-hidden"
              >
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                    <Download size={18} className="text-primary" />
                    Destino da Importação
                  </h3>
                  <button 
                    onClick={() => {
                        setIsImportModalOpen(false);
                        setPendingImportFile(null);
                    }} 
                    className="p-2 hover:bg-surface rounded-lg"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <p className="text-xs text-text-dim uppercase tracking-wider font-bold">Escolha a pasta de destino:</p>
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                    <button 
                      onClick={() => processBulkImport(null)}
                      className="w-full flex items-center gap-3 text-left p-4 bg-surface border border-border rounded-xl hover:border-primary transition-all font-bold text-sm uppercase tracking-tighter"
                    >
                      <FolderIcon size={18} className="shrink-0 text-primary" />
                      <span className="text-primary">Sem Pasta (Raiz)</span>
                    </button>
                    {folders.filter(folder => !folder.type || folder.type === 'song').map(folder => (
                      <button 
                        key={folder.id}
                        onClick={() => processBulkImport(folder.id!)}
                        className="w-full flex items-center gap-3 text-left p-4 bg-surface border border-border rounded-xl hover:border-primary transition-all font-bold text-sm uppercase tracking-tighter"
                      >
                        <FolderIcon size={18} className="shrink-0 text-primary" />
                        <span className="text-primary">{folder.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      {followLeader && (
        <div
          className="fixed inset-0 z-[120] pointer-events-auto bg-transparent"
          role="dialog"
          aria-modal="true"
          aria-label="Acompanhamento do Palco"
        >
        </div>
      )}
    </div>
  </div>
);
}

function SongSidebarItem({ song, isSelectionMode, isSelected, onToggleSelect, onClick, onLongPress, isMobile, onDownload, onListPDF, onShare, onMove, isMaestro, onDelete }: any) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (menuRootRef.current && !menuRootRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, [menuOpen]);
  const clearPressTimer = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };
  const handlePressStart = () => {
    if (!isMobile || isSelectionMode || !onLongPress) return;
    longPressTriggered.current = false;
    clearPressTimer();
    pressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      onLongPress();
    }, 550);
  };
  const handlePressEnd = () => clearPressTimer();

  return (
    <div className={`relative flex items-center border-b border-[#DCE3EC] last:border-0 overflow-visible ${menuOpen ? 'z-[999]' : 'z-0'} bg-white transition-colors hover:bg-[#F4F8FE] ${isSelected ? 'bg-primary/5' : ''}`}>
      <motion.button
        type="button"
        onPointerDown={handlePressStart}
        onPointerUp={handlePressEnd}
        onPointerLeave={handlePressEnd}
        onPointerCancel={handlePressEnd}
        onContextMenu={(event) => { if (isMobile) event.preventDefault(); }}
        onClick={() => {
          if (longPressTriggered.current) { longPressTriggered.current = false; return; }
          onClick?.();
        }}
        whileTap={{ scale: 0.98 }}
        className={`min-w-0 flex-1 text-left px-3 py-3 bg-transparent transition-colors group flex items-center gap-5 ${isMobile ? 'select-none touch-pan-y' : ''}`}
      >
        {isSelectionMode && <div className="text-primary">{isSelected ? <CheckSquare size={22} /> : <Square size={22} className="text-border" />}</div>}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate tracking-normal uppercase leading-none mb-1 text-black">{song.title?.length > 22 ? song.title.substring(0, 22) + '...' : song.title}</div>
          <div className="text-[10px] text-[#666666] uppercase font-bold tracking-widest truncate leading-tight">{song.artist?.length > 22 ? song.artist.substring(0, 22) + '...' : song.artist}</div>
        </div>
        <div className="self-center min-w-[30px] h-[22px] px-1.5 rounded-md bg-[#174EA6] text-white text-[11px] font-bold shrink-0 flex items-center justify-center text-center tabular-nums">{song.key}</div>
      </motion.button>
      {!isSelectionMode && <div ref={menuRootRef} data-archive-menu-root className="relative z-[70] shrink-0 mr-2" onClick={e => e.stopPropagation()}>
        <button type="button" aria-label={`Ações da música ${song.title}`} onClick={() => setMenuOpen(v => !v)} className="p-1.5 text-[#666666] rounded-md transition-colors"><MoreVertical size={18}/></button>
        {menuOpen && <div className="absolute right-0 top-8 z-[10000] w-max min-w-0 max-w-[240px] bg-white border border-[#D1D5DB] rounded-xl shadow-2xl p-1.5 text-left text-black">
          <div className="flex items-center justify-between gap-3 px-2 py-1.5 mb-1 border-b border-[#D1D5DB]"><div className="flex items-center gap-2 text-xs font-bold text-black"><Music size={15}/>MÚSICAS</div><button type="button" aria-label="Fechar menu" title="Fechar" onClick={() => setMenuOpen(false)} className="p-1 rounded-md text-[#666666] hover:bg-[#EEF1F5]"><X size={15}/></button></div>
          <button className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold whitespace-nowrap hover:bg-[#EEF5FF] rounded" onClick={() => { setMenuOpen(false); onMove?.(); }}><FolderIcon size={14}/>Mover</button>
          <div className="border-t border-[#D1D5DB]"/>
          <button className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold whitespace-nowrap hover:bg-[#EEF5FF] rounded" onClick={() => { setMenuOpen(false); onDownload?.(); }}><FileText size={14}/>ChordPro (cho)</button>
          <div className="border-t border-[#D1D5DB]"/>
          <button className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold whitespace-nowrap hover:bg-[#EEF5FF] rounded" onClick={() => { setMenuOpen(false); onListPDF?.(); }}><Music size={14}/>Chord Over (pdf)</button>
          <div className="border-t border-[#D1D5DB]"/>
          <button className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold whitespace-nowrap hover:bg-[#EEF5FF] rounded" onClick={() => { setMenuOpen(false); onShare?.(); }}><Share2 size={14}/>Compartilhar</button>
          {isMaestro && <>
            <div className="border-t border-[#D1D5DB]"/>
            <button className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded" onClick={() => { setMenuOpen(false); onDelete?.(); }}><Trash2 size={14}/>Excluir</button>
          </>}
        </div>}
      </div>}
    </div>
  );
}

function RepertorioSidebarItem({ 
  repertorio, onClick, onDelete, onEdit, onShare, onDownload, onSetlist, onSonglist, isMaestro, 
  isSelectionMode, isSelected, onToggleSelect 
}: any) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (menuRootRef.current && !menuRootRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, [menuOpen]);

  const songCount = (repertorio.songIds || []).filter((id: string) => !String(id).startsWith('group:')).length;
  const dateLabel = repertorio.date
    ? new Date(repertorio.date + 'T12:00:00').toLocaleDateString('pt-BR')
    : 'Sem data';

  return (
    <div className={`relative flex items-center gap-3 border-b border-[#174EA6]/25 last:border-0 bg-white px-3 py-3 transition-colors hover:bg-[#F4F8FE] ${menuOpen ? 'z-[999]' : 'z-0'} ${isSelected ? 'bg-primary/5' : ''}`}>
      {isSelectionMode && (
        <button type="button" onClick={onToggleSelect} className="shrink-0 text-primary" aria-label="Selecionar repertório">
          {isSelected ? <CheckSquare size={20} /> : <Square size={20} className="text-border" />}
        </button>
      )}
      <button
        type="button"
        onClick={isSelectionMode ? onToggleSelect : onClick}
        className="min-w-0 flex-1 text-left flex items-center gap-3"
      >
        <div className="w-9 h-9 rounded-xl bg-[#EAF1FC] text-[#174EA6] flex items-center justify-center shrink-0">
          <ListMusic size={19} strokeWidth={1.9} />
        </div>
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <span className="font-bold text-sm truncate tracking-normal uppercase leading-tight text-black">{repertorio.title}</span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#666666]">{dateLabel}</span>
        </div>
      </button>
      <span className="shrink-0 min-w-[25px] h-[22px] px-1.5 rounded-md bg-[#174EA6] text-white text-[10px] font-bold flex items-center justify-center tabular-nums" title={`${songCount} músicas`}>
        {songCount}
      </span>
      {!isSelectionMode && isMaestro && (
        <div ref={menuRootRef} data-archive-menu-root className="relative z-[70] shrink-0" onClick={event => event.stopPropagation()}>
          <button type="button" aria-label={`Ações do repertório ${repertorio.title}`} onClick={() => setMenuOpen(value => !value)} className="p-1.5 text-[#666666] rounded-md transition-colors hover:bg-[#EAF1FC]">
            <MoreVertical size={19} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-[10000] w-max min-w-0 max-w-[240px] bg-white border border-[#D1D5DB] rounded-xl shadow-2xl p-1.5 text-left text-black">
              <div className="flex items-center justify-between gap-3 px-2 py-1.5 mb-1 border-b border-[#D1D5DB]"><div className="flex items-center gap-2 text-xs font-bold text-black"><ListMusic size={15}/>REPERTÓRIOS</div><button type="button" aria-label="Fechar menu" title="Fechar" onClick={() => setMenuOpen(false)} className="p-1 rounded-md text-[#666666] hover:bg-[#EEF1F5]"><X size={15}/></button></div>
              <button className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold whitespace-nowrap hover:bg-[#EEF5FF] rounded" onClick={() => { setMenuOpen(false); onEdit?.(); }}><Edit2 size={14}/>Editar</button>
              <div className="border-t border-[#D1D5DB]" />
              <button disabled={songCount === 0} className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold whitespace-nowrap rounded ${songCount === 0 ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-[#EEF5FF]'}`} onClick={() => { setMenuOpen(false); onDownload?.(); }}><Download size={14}/>Download</button>
              <div className="border-t border-[#D1D5DB]" />
              <button disabled={songCount === 0} className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold whitespace-nowrap rounded ${songCount === 0 ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-[#EEF5FF]'}`} onClick={() => { setMenuOpen(false); onSetlist?.(); }}><FileText size={14}/>Setlist (pdf)</button>
              <div className="border-t border-[#D1D5DB]" />
              <button disabled={songCount === 0} className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold whitespace-nowrap rounded ${songCount === 0 ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-[#EEF5FF]'}`} onClick={() => { setMenuOpen(false); onSonglist?.(); }}><Music size={14}/>Songlist (pdf)</button>
              <div className="border-t border-[#D1D5DB]" />
              <button className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded" onClick={() => { setMenuOpen(false); onDelete?.(); }}><Trash2 size={14}/>Excluir</button>
            </div>
          )}
        </div>
      )}
      {!isSelectionMode && !isMaestro && <ChevronRight size={18} className="shrink-0 text-[#6D91C7]" />}
    </div>
  );
}

function SongItem({ 
  song, 
  index, 
  onClick, 
  onDelete, 
  onShare, 
  isMaestro, 
  isSelected, 
  onToggleSelect, 
  groupInfo, 
  isDragging,
  dragHandleProps,
  isInsideGroup = false,
  onUngroup,
  displayKey
}: any) {
  const x = useMotionValue(0);
  const actionOpacity = useTransform(x, [0, 100], [0, 1]);
  const dragLimit = isMaestro ? 120 : 60;

  return (
    <div className={`relative overflow-hidden ${!isInsideGroup ? 'border-b border-border last:border-0' : 'border-b border-border/30 last:border-0'} transition-all`}>
      {/* Background actions - only show if NOT dragging */}
      {!isDragging && (
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 gap-4 bg-primary/10 w-full">
          {isMaestro && (
            <motion.button 
              style={{ opacity: actionOpacity }}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-2 bg-red-500 text-white rounded-lg"
            >
              <Trash2 size={16} />
            </motion.button>
          )}
          <motion.button 
            style={{ opacity: isMaestro ? actionOpacity : 1 }}
            onClick={(e) => { e.stopPropagation(); onShare(); }}
            className="p-2 bg-primary text-white rounded-lg"
          >
            <Share2 size={16} />
          </motion.button>
          
          {isInsideGroup && onUngroup && (
            <motion.button 
              style={{ opacity: isMaestro ? actionOpacity : 1 }}
              onClick={(e) => { e.stopPropagation(); onUngroup(); }}
              className="p-2 bg-amber-500 text-white rounded-lg"
              title="Remover do Bloco"
            >
              <LogOut size={16} />
            </motion.button>
          )}
        </div>
      )}

      <motion.div 
        drag={false}
        style={{ x: 0 }}
        className={`relative flex items-center transition-all bg-white`}
      >
        <div 
          {...(isMaestro ? dragHandleProps : {})}
          className="flex-1 text-left p-3.5 hover:bg-surface/50 transition-colors group flex items-center gap-4 cursor-default relative"
        >
          <div 
            onClick={(e) => {
              e.stopPropagation();
              if (isMaestro && onToggleSelect) {
                onToggleSelect();
              }
            }}
            className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 shrink-0 transition-all cursor-pointer ${
              isSelected 
                ? "bg-primary/10 border-primary text-primary shadow-md scale-105" 
                : "bg-surface border-gray-200 text-text-dim hover:border-primary/50"
            }`}
          >
            {index}
          </div>
          <div 
            className="flex-1 min-w-0" 
            onClick={(e) => {
              e.stopPropagation();
              onClick && onClick();
            }}
          >
            <div className="font-bold text-sm truncate tracking-normal uppercase leading-none mb-1 text-black">
              {song.title?.length > 22 ? song.title.substring(0, 22) + '...' : song.title}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] text-[#666666] font-medium uppercase tracking-widest truncate leading-tight flex-1">
                {song.artist?.length > 22 ? song.artist.substring(0, 22) + '...' : song.artist}
              </div>
              <div className="text-[13px] text-[#666666] font-bold tracking-tight shrink-0 text-right">
                {isSelected ? (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete && onDelete();
                    }}
                    className="text-red-500 hover:text-red-700 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                ) : (
                  displayKey || song.key
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function SortableGroupItem({ 
  id,
  group, 
  displayIndex,
  onUpdateGroupTitle,
  onClick,
  onDelete
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(group.title || "");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
  };

  const handleTitleSubmit = () => {
    onUpdateGroupTitle(group.id, editedTitle);
    setIsEditingTitle(false);
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`border-b border-border/40 bg-[#F5F8FC] dark:bg-primary/5 transition-all ${isDragging ? 'opacity-20 scale-[1.02]' : ''}`}
      onClick={onClick}
    >
      <div 
        {...attributes} 
        {...listeners} 
        className="px-4 py-3 flex items-center justify-between cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div 
            className="flex items-center justify-center w-7 h-7 bg-primary text-white rounded-full text-[11px] font-bold shrink-0"
          >
            {displayIndex}
          </div>
          {isEditingTitle ? (
            <input 
              autoFocus
              className="bg-white border-2 border-primary/20 text-[11px] font-black uppercase tracking-widest text-[#0D47A1] px-3 py-1 rounded-lg outline-none w-full max-w-[200px]"
              value={editedTitle}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
            />
          ) : (
            <div className="flex-1 min-w-0 flex items-center gap-2 group">
              <h4 
                className="text-xs font-black uppercase tracking-widest text-black truncate"
              >
                {group.title || `Marcador de Bloco`}
              </h4>

            </div>
          )}
        </div>
        <div 
          className="flex items-center gap-1 shrink-0"
        >
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setIsEditingTitle(true); }}
            className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors"
            title="Editar nome do bloco"
          >
            <Edit2 size={16} />
          </button>
          <button 
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { 
                e.stopPropagation(); 
                onDelete && onDelete();
            }}
            className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
            title="Excluir Marcador"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableSongItem({ id, song, index, onClick, onDelete, onShare, isMaestro, isSelected, onToggleSelect, isInsideGroup, isLastInGroup, onUngroup, displayKey }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id, disabled: !isMaestro });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 200 : 1,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`transition-all bg-white overflow-hidden ${isDragging ? 'opacity-40 translate-y-1 shadow-lg scale-[1.01] z-[200]' : ''}`}
    >
      <SongItem
        song={song}
        displayKey={displayKey}
        index={index}
        onClick={onClick}
        onDelete={onDelete}
        onShare={onShare}
        isMaestro={isMaestro}
        isSelected={isSelected}
        isDragging={isDragging}
        onToggleSelect={onToggleSelect}
        isInsideGroup={isInsideGroup}
        onUngroup={onUngroup}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}


function SidebarNavItem({ icon, label, active, onClick, variant = 'dark', disabled = false, tooltip, activeColorOverride, showActiveIndicator = true }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, variant?: 'dark' | 'light', disabled?: boolean, tooltip?: string, activeColorOverride?: string, showActiveIndicator?: boolean }) {
  const activeColor = activeColorOverride || (variant === 'dark' ? 'text-[#E6ECF5]' : 'text-[#0D47A1]');
  const inactiveColor = variant === 'dark' ? 'text-white hover:text-white/80' : 'text-[#0D47A1]/60 hover:text-[#0D47A1]';

  return (
    <button
     title={tooltip || label}
      aria-label={tooltip || label}
      onClick={disabled ? undefined : onClick}
      className={`relative flex flex-col items-center gap-1 p-2 transition-all ${active ? activeColor : inactiveColor} ${disabled ? 'cursor-not-allowed opacity-35 pointer-events-none' : ''}`}
    >
      {icon}
      <span className="text-[9px] uppercase font-bold tracking-widest">{label}</span>
      {variant === 'dark' && active && showActiveIndicator && (
        <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-full bg-[#E6ECF5]" aria-hidden="true" />
      )}
    </button>
  );
}

function RepertorioForm({ initialData, songs, folders, repertorios, categories, onSave, onCancel }: { 
  initialData?: any, 
  songs: Song[],
  folders: Folder[],
  repertorios: any[],
  categories: Category[],
  onSave: (data: any) => void,
  onCancel: () => void 
}) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [date, setDate] = useState(initialData?.date || '');
  const [folderId, setFolderId] = useState(initialData?.folderId || '');
  const [selectedIds, setSelectedIds] = useState<string[]>(initialData?.songIds || []);
  
  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'composition' | 'updatedAt'>('title');
  const [filterFolder, setFilterFolder] = useState<string>('');
  const [filterRepertorio, setFilterRepertorio] = useState<string>('');
  const [filterArtist, setFilterArtist] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterKey, setFilterKey] = useState<string>('');
  const [filterTempo, setFilterTempo] = useState<string>('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const artists = useMemo(() => Array.from(new Set(songs.map(s => s.artist).filter(Boolean))).sort(), [songs]);
  const keys = useMemo(() => Array.from(new Set(songs.map(s => s.key).filter(Boolean))).sort(), [songs]);
  const tempos = useMemo(() => Array.from(new Set(songs.map(s => s.tempo).filter(Boolean))).sort(), [songs]);

  const filteredSongs = useMemo(() => {
    let result = [...songs];

    // Search por título, artista, compositor e trecho da letra/cifra.
    if (searchTerm.trim()) {
      const normalizedTerm = normalizeSearchText(searchTerm.trim());
      result = result.filter(s =>
        normalizeSearchText(s.title).includes(normalizedTerm) ||
        normalizeSearchText(s.artist).includes(normalizedTerm) ||
        normalizeSearchText(s.composition).includes(normalizedTerm) ||
        normalizeSearchText(
          (s.chordPro || '')
            .replace(/\[[^\]]*\]/g, '')
            .replace(/\{[^}]*\}/g, ' ')
            .replace(/\s+/g, ' ')
        ).includes(normalizedTerm)
      );
    }

    // Advanced Filters
    if (filterFolder) {
      result = result.filter(s => s.folderId === filterFolder);
    }
    if (filterRepertorio) {
      const rep = repertorios.find(r => r.id === filterRepertorio);
      if (rep) {
        result = result.filter(s => rep.songIds.includes(s.id));
      }
    }
    if (filterArtist) {
      result = result.filter(s => s.artist === filterArtist);
    }
    if (filterCategory) {
      result = result.filter(s => s.category === filterCategory);
    }
    if (filterKey) {
      result = result.filter(s => s.key === filterKey);
    }
    if (filterTempo) {
      result = result.filter(s => s.tempo === filterTempo);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'composition') return (a.composition || '').localeCompare(b.composition || '');
      if (sortBy === 'updatedAt') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      return 0;
    });

    return result;
  }, [songs, searchTerm, sortBy, filterFolder, filterRepertorio, filterArtist, filterCategory, filterKey, filterTempo, repertorios]);

  const toggleSong = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const removeSong = (id: string) => {
    setSelectedIds(prev => prev.filter(i => i !== id));
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSave({ title, date, folderId, songIds: selectedIds });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[85vh] -m-6 bg-bg">
      {/* Header */}
      <div className="p-6 border-b border-border bg-surface shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold uppercase tracking-tighter">
            {initialData ? 'Editar Repertório' : 'Novo Repertório'}
          </h2>
          <div className="flex gap-2">
            <button 
              onClick={onCancel}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-text-dim hover:text-text-main transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-primary text-white rounded-lg font-bold text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100"
            >
              {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-[2]">
            <label className="text-[10px] font-bold text-text-dim uppercase mb-1 block">Nome do Repertório</label>
            <input 
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl py-2.5 px-4 text-sm focus:ring-1 focus:ring-primary outline-none"
              placeholder="Ex: Show de Sábado"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-bold text-text-dim uppercase mb-1 block">Data</label>
            <input 
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl py-2.5 px-4 text-sm focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-bold text-text-dim uppercase mb-1 block">Classificador (Marcador)</label>
            <select 
              value={folderId}
              onChange={e => setFolderId(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl py-2.5 px-4 text-sm focus:ring-1 focus:ring-primary outline-none"
            >
              <option value="">Nenhum...</option>
              {folders.filter(f => f.type === 'repertorio').map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Multi-Pane Content */}
      <div className="flex flex-1 min-h-0">
        {/* Left Pane: Selection */}
        <div className="flex-1 border-r border-border flex flex-col min-w-0">
          <div className="p-4 border-b border-border bg-surface/50 space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={14} />
                <input 
                  type="text"
                  placeholder="Pesquisar..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-[#D1D5DB] rounded-lg py-2 pl-9 pr-4 text-xs outline-none focus:ring-1 focus:ring-[#D1D5DB] text-[#666666] placeholder:text-[#B8BEC8]"
                />
              </div>
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`p-2 rounded-lg border transition-colors ${isFilterOpen ? 'bg-primary border-primary text-white' : 'bg-bg border-border text-text-dim'}`}
              >
                <Filter size={14} />
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-text-dim">
              <div className="flex items-center gap-2">
                <span>Ordenar por:</span>
                <select 
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="bg-transparent border-none text-primary focus:ring-0 cursor-pointer p-0"
                >
                  <option value="title">Título</option>
                  <option value="composition">Composição</option>
                  <option value="updatedAt">Modificação</option>
                </select>
              </div>
              <span>{filteredSongs.length} Músicas</span>
            </div>

            <AnimatePresence>
              {isFilterOpen && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="pt-2 border-t border-border/50 grid grid-cols-2 gap-2 overflow-hidden"
                >
                  <select 
                    value={filterFolder}
                    onChange={e => setFilterFolder(e.target.value)}
                    className="bg-bg border border-border rounded-lg p-2 text-[10px] uppercase font-bold outline-none"
                  >
                    <option value="">Todas Pastas</option>
                    {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <select 
                    value={filterRepertorio}
                    onChange={e => setFilterRepertorio(e.target.value)}
                    className="bg-bg border border-border rounded-lg p-2 text-[10px] uppercase font-bold outline-none"
                  >
                    <option value="">Filtrar p/ Repertório</option>
                    {repertorios.filter(r => r.id !== initialData?.id).map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                  </select>
                  <select 
                    value={filterArtist}
                    onChange={e => setFilterArtist(e.target.value)}
                    className="bg-bg border border-border rounded-lg p-2 text-[10px] uppercase font-bold outline-none"
                  >
                    <option value="">Artistas</option>
                    {artists.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <select 
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                    className="bg-bg border border-border rounded-lg p-2 text-[10px] uppercase font-bold outline-none"
                  >
                    <option value="">Categorias</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  <select 
                    value={filterKey}
                    onChange={e => setFilterKey(e.target.value)}
                    className="bg-bg border border-border rounded-lg p-2 text-[10px] font-bold outline-none"
                  >
                    <option value="">Tonalidades</option>
                    {keys.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <select 
                    value={filterTempo}
                    onChange={e => setFilterTempo(e.target.value)}
                    className="bg-bg border border-border rounded-lg p-2 text-[10px] uppercase font-bold outline-none"
                  >
                    <option value="">Andamentos</option>
                    {tempos.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button 
                    onClick={() => {
                      setFilterFolder('');
                      setFilterRepertorio('');
                      setFilterArtist('');
                      setFilterCategory('');
                      setFilterKey('');
                      setFilterTempo('');
                    }}
                    className="col-span-2 text-[9px] uppercase font-bold text-red-500 py-1"
                  >
                    Limpar Filtros
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredSongs.map(song => (
              <button 
                key={song.id}
                onClick={() => toggleSong(song.id!)}
                className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group ${selectedIds.includes(song.id!) ? 'bg-surface border-primary shadow-sm' : 'bg-surface border-border hover:border-primary/50'}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="font-bold text-xs truncate text-text-main">{song.title}</span>
                    {song.key && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-primary/10 text-primary">
                        {song.key}
                      </span>
                    )}
                    {song.tempo && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-bg text-text-dim border border-border">
                        {song.tempo}
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-bg text-text-dim border border-border">
                      {song.category}
                    </span>
                  </div>
                  <div className="text-[9px] tracking-wider truncate text-text-dim">
                    {song.artist} {song.composition && `(${song.composition})`}
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ml-3 ${selectedIds.includes(song.id!) ? 'bg-primary border-primary' : 'border-border group-hover:border-primary'}`}>
                  {selectedIds.includes(song.id!) && <Check size={12} className="text-white font-bold" />}
                </div>
              </button>
            ))}
            {filteredSongs.length === 0 && (
              <div className="p-8 text-center text-text-dim italic text-xs">Nenhuma música encontrada com estes filtros</div>
            )}
          </div>
        </div>

        {/* Right Pane: Current Setlist */}
        <div className="w-[320px] bg-surface flex flex-col">
          <div className="p-4 border-b border-border bg-bg/30 shrink-0">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-dim flex items-center justify-between">
              Músicas no Repertório
              <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full">{selectedIds.length}</span>
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            <AnimatePresence initial={false}>
              {selectedIds.map((id, index) => {
                const song = songs.find(s => s.id === id);
                if (!song) return null;
                return (
                  <motion.div 
                    layout
                    key={id} 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="flex items-center gap-3 p-3 bg-bg border border-border rounded-xl group relative shadow-sm"
                  >
                    <div className="w-6 h-6 flex items-center justify-center bg-surface border border-border rounded-full text-[10px] font-bold text-text-dim group-hover:text-primary group-hover:border-primary transition-colors shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs truncate uppercase tracking-tighter">
                        {song.title} {song.key && <span className="text-primary ml-1 normal-case">({song.key})</span>}
                      </div>
                      <div className="text-[9px] text-text-dim truncate">{song.artist}</div>
                    </div>
                    <button 
                      onClick={() => removeSong(id)}
                      className="p-1.5 text-text-dim hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {selectedIds.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full opacity-30 p-8 text-center space-y-2">
                <ListMusic size={32} />
                <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">Arraste ou selecione músicas à esquerda para preencher o repertório</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryManager({ categories, onClose }: { categories: Category[], onClose: () => void }) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const addCategory = async () => {
    if (!newName.trim()) return;
    try {
      await addDoc(collection(db, 'categories'), { 
        name: newName.trim(),
        createdBy: auth.currentUser?.uid 
      });
      setNewName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'categories');
    }
  };

  const updateCategory = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await updateDoc(doc(db, 'categories', id), { name: editName.trim() });
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'categories');
    }
  };

  const deleteCategory = async (id: string) => {
    if (!window.confirm('Excluir esta categoria?')) return;
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'categories');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-bg border border-border rounded-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-bold uppercase tracking-widest text-sm">Gerenciar Categorias</h3>
          <button onClick={onClose} className="p-2 hover:bg-surface rounded-lg"><X size={20} /></button>
        </div>
        
        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <input 
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Nova categoria..."
              className="flex-1 bg-surface border border-border rounded-xl px-4 py-2 outline-none focus:ring-1 focus:ring-primary"
            />
            <button 
              onClick={addCategory}
              className="bg-primary text-white p-2 rounded-xl"
            >
              <Plus size={24} />
            </button>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-2 p-2 bg-surface rounded-xl border border-border">
                {editingId === cat.id ? (
                  <>
                    <input 
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="flex-1 bg-bg border border-border rounded-lg px-2 py-1 outline-none"
                    />
                    <button onClick={() => updateCategory(cat.id!)} className="text-primary"><Save size={18} /></button>
                    <button onClick={() => setEditingId(null)}><X size={18} /></button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-bold">{cat.name}</span>
                    <button 
                      onClick={() => { setEditingId(cat.id!); setEditName(cat.name); }}
                      className="text-text-dim hover:text-text-main"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => deleteCategory(cat.id!)}
                      className="text-text-dim hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function LabelManager({ labels, onClose, isMaestro, coroColor, onCoroColorChange }: { labels: LabelShortcut[], onClose: () => void, isMaestro: boolean, coroColor: string, onCoroColorChange: (color: string) => void }) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#00e5ff');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const addLabel = async () => {
    if (newName.trim()) {
      try {
        await addDoc(collection(db, 'labels'), {
          name: newName.trim().toUpperCase(),
          color: newColor,
          createdBy: auth.currentUser?.uid
        });
        setNewName('');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'labels');
      }
    }
  };

  const updateLabel = async (id: string) => {
    if (editName.trim()) {
      try {
        await updateDoc(doc(db, 'labels', id), {
          name: editName.trim().toUpperCase(),
          color: editColor
        });
        setEditingId(null);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'labels');
      }
    }
  };

  const deleteLabel = async (id: string) => {
    if (!window.confirm('Excluir este marcador?')) return;
    try {
      await deleteDoc(doc(db, 'labels', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'labels');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-bg border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-bold uppercase tracking-widest text-sm">Gerenciar Marcadores (#)</h3>
          <button onClick={onClose} className="p-2 hover:bg-surface rounded-lg"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3 p-3 bg-surface rounded-xl border border-border">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide">Cor do Côro</p>
              <p className="text-[10px] text-text-dim">Cor aplicada ao trecho selecionado no Visor</p>
            </div>
            <input
              type="color"
              aria-label="Escolher cor do Côro"
              title="Escolher cor do Côro"
              value={coroColor}
              onChange={e => onCoroColorChange(e.target.value)}
              className="w-12 h-10 p-1 bg-bg border border-border rounded-lg cursor-pointer"
            />
          </div>
          <div className="space-y-2">
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Novo marcador (ex: PONTE)" className="w-full bg-surface border border-border rounded-xl px-4 py-2 outline-none focus:ring-1 focus:ring-primary uppercase h-[46px]" />
            <div className="flex gap-2">
               <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-12 h-[46px] p-1 bg-surface border border-border rounded-xl cursor-pointer" />
               <button onClick={addLabel} className="flex-1 bg-primary text-white rounded-xl font-bold uppercase tracking-widest text-xs">Adicionar</button>
            </div>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
            {labels.map(label => (
              <div key={label.id} className="flex items-center gap-2 p-2 bg-surface rounded-xl border border-border">
                {editingId === label.id ? (
                  <>
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value.toUpperCase())} className="flex-1 bg-bg border border-border rounded-lg px-2 py-1 outline-none uppercase" />
                    <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} className="w-8 h-8 p-1 bg-bg border border-border rounded-lg" />
                    <button onClick={() => updateLabel(label.id!)} className="text-primary"><Save size={18} /></button>
                    <button onClick={() => setEditingId(null)}><X size={18} /></button>
                  </>
                ) : (
                  <>
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: label.color }} />
                    <span className="flex-1 font-bold text-sm uppercase">{label.name}</span>
                    {isMaestro && (
                      <div className="flex gap-1 pr-2">
                        <button 
                          onClick={() => {
                            setEditingId(label.id!);
                            setEditName(label.name);
                            setEditColor(label.color);
                          }}
                          className="text-text-dim hover:text-primary"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => deleteLabel(label.id!)} className="text-text-dim hover:text-red-500"><Trash2 size={16} /></button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function FolderSelectionModal({ folders, type, onSelect, onClose }: { folders: Folder[], type: 'song' | 'repertorio' | 'block', onSelect: (folderId: string) => void, onClose: () => void }) {
  const relevantFolders = folders.filter(f => type === 'song' ? (!f.type || f.type === 'song') : type === 'repertorio' ? f.type === 'repertorio' : (f.type as string) === 'block');
  const title = type === 'song' ? 'Selecionar Pasta' : type === 'repertorio' ? 'Selecionar Pasta' : 'Selecionar Conjunto';
  const subtitle = type === 'song' ? 'Mover música para arquivo' : type === 'repertorio' ? 'Escolha a pasta deste repertório' : 'Escolha onde criar o novo bloco';

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[500] flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} 
        animate={{ scale: 1, y: 0 }} 
        className="bg-bg border border-border rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-bold uppercase tracking-widest text-sm text-[#0D47A1]">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-surface rounded-lg"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-2 max-h-[300px] overflow-y-auto">
          {type === 'song' && (
            <button
              onClick={() => onSelect('')}
              className="w-full flex items-center gap-3 p-3 bg-surface hover:bg-[#E6ECF5] rounded-xl border border-border text-left transition-colors group"
            >
              <FolderIcon size={18} className="text-primary group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold uppercase tracking-widest text-text-main">Sem Pasta (Raiz)</span>
            </button>
          )}
          {relevantFolders.map(folder => (
            <button 
              key={folder.id}
              onClick={() => onSelect(folder.id!)}
              className="w-full flex items-center gap-3 p-3 bg-surface hover:bg-[#E6ECF5] rounded-xl border border-border text-left transition-colors group"
            >
              <FolderIcon size={18} className="text-primary group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold uppercase tracking-widest text-text-main">{folder.name}</span>
            </button>
          ))}
          {relevantFolders.length === 0 && type !== 'song' && (
            <div className="text-center py-8 text-text-dim italic text-xs uppercase tracking-widest">Nenhum disponível</div>
          )}
        </div>
        <div className="p-4 bg-surface/30 border-t border-border">
          <p className="text-[10px] text-text-dim text-center uppercase font-bold tracking-widest">{subtitle}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SortableFolderItem({ folder, editingId, setEditingId, editName, setEditName, updateFolder, deleteFolder }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: folder.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="flex items-center gap-2 p-2 bg-surface rounded-xl border border-border group"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-text-dim hover:text-primary transition-colors">
        <GripVertical size={16} />
      </div>
      {editingId === folder.id ? (
        <>
          <input 
            type="text" 
            value={editName} 
            onChange={e => setEditName(e.target.value)} 
            className="flex-1 bg-bg border border-border rounded-lg px-2 py-1 outline-none text-sm" 
            autoFocus
          />
          <button onClick={() => updateFolder(folder.id!)} className="text-primary p-1"><Save size={18} /></button>
          <button onClick={() => setEditingId(null)} className="p-1"><X size={18} /></button>
        </>
      ) : (
        <>
          <FolderIcon size={16} className="text-primary" />
          <span className="flex-1 text-sm font-bold truncate">{folder.name}</span>
          <button 
            onClick={() => { setEditingId(folder.id!); setEditName(folder.name); }} 
            className="text-text-dim hover:text-text-main p-1"
          >
            <Edit2 size={16} />
          </button>
          <button 
            onClick={() => deleteFolder(folder.id!)} 
            className="text-text-dim hover:text-red-500 p-1"
          >
            <Trash2 size={16} />
          </button>
        </>
      )}
    </div>
  );
}

function FolderManager({ folders, type, onClose }: { folders: Folder[], type: 'song' | 'repertorio' | 'block', onClose: () => void }) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const title = type === 'song' ? 'Gerenciar Pastas de Músicas' : type === 'repertorio' ? 'Gerenciar Pastas de Repertórios' : 'Gerenciar Conjuntos de Blocos';
  const placeholder = type === 'song' ? 'Ex: Adoração, Celebração...' : type === 'repertorio' ? 'Ex: Casamentos, Eventos...' : 'Ex: Aberturas, Medleys...';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const addFolder = async () => {
    if (!newName.trim()) return;
    try {
      await addDoc(collection(db, 'folders'), { 
        name: newName.trim(),
        createdBy: auth.currentUser?.uid,
        type: type,
        order: folders.length // Default order at the end
      });
      setNewName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'folders');
    }
  };

  const updateFolder = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await updateDoc(doc(db, 'folders', id), { name: editName.trim() });
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'folders');
    }
  };

  const deleteFolder = async (id: string) => {
    const itemType = type === 'song' ? 'músicas' : type === 'repertorio' ? 'repertórios' : 'conjuntos';
    if (!window.confirm(`Excluir esta pasta? (Os ${itemType} dentro dela não serão apagados)`)) return;
    try {
      await deleteDoc(doc(db, 'folders', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'folders');
    }
  };

  const relevantFolders = folders.filter(f => 
    type === 'song' ? (!f.type || f.type === 'song') : type === 'repertorio' ? f.type === 'repertorio' : (f.type as string) === 'block'
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = relevantFolders.findIndex(f => f.id === active.id);
    const newIndex = relevantFolders.findIndex(f => f.id === over.id);

    const newSortedFolders = arrayMove([...relevantFolders], oldIndex, newIndex);
    
    // Update firestore for all folders in this type to have the new order
    try {
      const batchPromises = newSortedFolders.map((f, idx) => 
        updateDoc(doc(db, 'folders', f.id!), { order: idx })
      );
      await Promise.all(batchPromises);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'folders');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-bg border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-bold uppercase tracking-widest text-sm text-primary">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-surface rounded-lg text-text-dim"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && addFolder()}
              placeholder={placeholder} 
              className="flex-1 bg-surface border border-border rounded-xl px-4 py-2 outline-none focus:ring-1 focus:ring-primary h-[46px]" 
            />
            <button onClick={addFolder} className="bg-primary text-white p-2 rounded-xl hover:bg-primary/90 transition-colors">
              <Plus size={24} />
            </button>
          </div>
          <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            <DndContext 
              sensors={sensors} 
              collisionDetection={closestCenter} 
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={relevantFolders.map(f => f.id!)} 
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {relevantFolders.map(folder => (
                    <SortableFolderItem 
                      key={folder.id} 
                      folder={folder} 
                      editingId={editingId}
                      setEditingId={setEditingId}
                      editName={editName}
                      setEditName={setEditName}
                      updateFolder={updateFolder}
                      deleteFolder={deleteFolder}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {relevantFolders.length === 0 && (
              <div className="text-center py-8 text-text-dim italic text-sm">
                Nenhuma pasta criada ainda.
              </div>
            )}
          </div>
        </div>
        <div className="p-4 bg-surface/30 border-t border-border flex items-center gap-2 justify-center">
          <Info size={14} className="text-primary" />
          <p className="text-[10px] text-text-dim uppercase font-bold tracking-widest">Arraste para reordenar suas pastas</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SongForm({ initialData, categories, folders, labels, chordBanks, onSave, onAutoSave, onDiscard, onCancel, isMaestro }: { 
  initialData?: Partial<Song>, 
  categories: Category[],
  folders: Folder[],
  labels: LabelShortcut[],
  chordBanks: ChordBank[],
  onSave: (data: Partial<Song>, draftId?: string | null) => void,
  onAutoSave: (data: Partial<Song>, draftId?: string | null) => Promise<string | null>,
  onDiscard: (draftId?: string | null) => Promise<void>,
  onCancel: () => void,
  isMaestro: boolean
}) {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    artist: initialData?.artist || '',
    composition: initialData?.composition || '',
    category: initialData?.category || '',
    tempo: initialData?.tempo || '',
    key: initialData?.key || '',
    chordPro: initialData?.chordPro || '',
    folderId: initialData?.folderId || '',
  });

  // Folder Manager State
  const [isManagingFolders, setIsManagingFolders] = useState(false);

  // Chord Bank Modal State
  const [chordModal, setChordModal] = useState<{
    isOpen: boolean;
    note: string;
    chords: string[];
    position: { top: number; left: number };
  }>({
    isOpen: false,
    note: '',
    chords: [],
    position: { top: 0, left: 0 }
  });

  // Undo/Redo Stacks
  const [history, setHistory] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [isManagingLabels, setIsManagingLabels] = useState(false);
  const [isKeyPickerOpen, setIsKeyPickerOpen] = useState(false);
  const [chordSize, setChordSize] = useState(() => Number(localStorage.getItem('recifra_chord_size') || 13));
  const [lyricSize, setLyricSize] = useState(() => Number(localStorage.getItem('recifra_lyric_size') || 14));
  const [chordColor, setChordColor] = useState(() => {
    if (typeof window === 'undefined') return '#ff6900';
    const saved = localStorage.getItem('recifra_chord_color');
    return !saved || saved.toLowerCase() === '#dc2626' ? '#ff6900' : saved;
  });
  const [lyricColor, setLyricColor] = useState(() => localStorage.getItem('recifra_lyric_color') || '#333333');
  const [coroColor, setCoroColor] = useState(() => {
    if (typeof window === 'undefined') return '#ffff00';
    return localStorage.getItem('recifra_coro_color') || '#ffff00';
  });
  const [previewSelection, setPreviewSelection] = useState<{ start: number; end: number } | null>(null);
  const previewSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const [isEditorExpanded, setIsEditorExpanded] = useState(true);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(true);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const originalTransposeRef = useRef<{ chordPro: string; key: string } | null>(null);
  useEffect(() => {
    const syncDisplaySettings = () => {
      setChordSize(Number(localStorage.getItem('recifra_chord_size') || 13));
      setLyricSize(Number(localStorage.getItem('recifra_lyric_size') || 14));
      setChordColor(localStorage.getItem('recifra_chord_color') || '#ff6900');
      setLyricColor(localStorage.getItem('recifra_lyric_color') || '#333333');
    };
    window.addEventListener('recifra:display-settings', syncDisplaySettings);
    return () => window.removeEventListener('recifra:display-settings', syncDisplaySettings);
  }, []);

  const [previewColumns, setPreviewColumns] = useState<1 | 2>(1);
  const importFileRef = useRef<HTMLInputElement>(null);
  const autoSaveIdRef = useRef<string | null>(initialData?.id || null);
  const isDiscardingRef = useRef(false);
  const isFinalizingRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const handleImportChordPro = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      if (!content.trim()) {
        alert('O arquivo selecionado está vazio.');
        return;
      }
      setHistory(prev => [formData.chordPro, ...prev].slice(0, 50));
      setRedoStack([]);
      originalTransposeRef.current = null;
      const importedText = smartUppercase(content);
      setFormData(prev => ({
        ...prev,
        chordPro: importedText,
        key: prev.key || detectKey(importedText),
        title: prev.title.trim() ? prev.title : file.name.replace(/\.(cho|chordpro|txt)$/i, '')
      }));
    } catch (error) {
      console.error('Erro ao importar cifra:', error);
      alert('Não foi possível ler esse arquivo. Escolha um arquivo .cho, .chordpro ou .txt.');
    } finally {
      event.target.value = '';
    }
  };

  const handleExportChordPro = () => {
    if (!formData.chordPro.trim()) {
      alert('Não há cifra para exportar.');
      return;
    }
    const safeTitle = (formData.title.trim() || 'cifra').replace(/[<>:"/\\|?*\x00-\x1F]/g, '').replace(/[. ]+$/g, '').trim() || 'cifra';
    const blob = new Blob([formData.chordPro], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeTitle}.cho`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // Persiste a cor escolhida para cifras entre atualizações e reaberturas do formulário.
  useEffect(() => {
    localStorage.setItem('recifra_chord_color', chordColor);
  }, [chordColor]);

  // Invalida a seleção visual sempre que o texto-fonte for alterado por outra ação.
  useEffect(() => {
    previewSelectionRef.current = null;
    setPreviewSelection(null);
  }, [formData.chordPro]);

  // Auto-resize textarea
  useEffect(() => {
    if (editorRef.current && isEditorExpanded) {
      editorRef.current.style.height = 'auto';
      editorRef.current.style.height = `${editorRef.current.scrollHeight}px`;
    }
  }, [formData.chordPro, isEditorExpanded]);

  // Extract unique chords for shortcuts
  const usedChords = useMemo(() => {
    const regex = /\[([^\]]+)\]/g;
    const chords = new Set<string>();
    let match;
    while ((match = regex.exec(formData.chordPro)) !== null) {
      chords.add(match[1]);
    }
    return Array.from(chords);
  }, [formData.chordPro]);

  const updateChordPro = (newText: string) => {
    const processedText = smartUppercase(newText);
    if (processedText !== formData.chordPro) {
      originalTransposeRef.current = null;
      setHistory(prev => [formData.chordPro, ...prev].slice(0, 50));
      setRedoStack([]);
      
      let newKey = formData.key;
      if (!newKey) {
        newKey = detectKey(processedText);
      }
      
      setFormData({ ...formData, chordPro: processedText, key: newKey });
    }
  };


  // Transposição consistente: todas as mudanças partem da cifra e do tom originais.
  const transposeToKey = (targetKey: string) => {
    if (!targetKey) return;
    if (targetKey === formData.key) {
      setIsKeyPickerOpen(false);
      return;
    }
    if (!originalTransposeRef.current) {
      originalTransposeRef.current = { chordPro: formData.chordPro, key: formData.key || detectKey(formData.chordPro) };
    }
    const original = originalTransposeRef.current;
    const semitones = getSemitones(original.key, targetKey);
    const nextChordPro = original.chordPro.trim() && semitones !== 0
      ? transposeChordPro(original.chordPro, semitones)
      : original.chordPro;
    setHistory(prev => [formData.chordPro, ...prev].slice(0, 50));
    setRedoStack([]);
    setFormData(prev => ({ ...prev, key: targetKey, chordPro: nextChordPro }));
    setIsKeyPickerOpen(false);
  };

  const restoreOriginalKey = () => {
    const original = originalTransposeRef.current;
    if (!original) {
      alert('Ainda não houve transposição nesta edição.');
      return;
    }
    setHistory(prev => [formData.chordPro, ...prev].slice(0, 50));
    setRedoStack([]);
    setFormData(prev => ({ ...prev, key: original.key, chordPro: original.chordPro }));
    originalTransposeRef.current = null;
    setIsKeyPickerOpen(false);
  };

  const undo = () => {
    if (history.length > 0) {
      const [prev, ...rest] = history;
      setRedoStack(r => [formData.chordPro, ...r]);
      setHistory(rest);
      setFormData({ ...formData, chordPro: prev });
    }
  };

  const redo = () => {
    if (redoStack.length > 0) {
      const [next, ...rest] = redoStack;
      setHistory(h => [formData.chordPro, ...h]);
      setRedoStack(rest);
      setFormData({ ...formData, chordPro: next });
    }
  };

  // Converte qualquer ponto do DOM do VISOR em um offset do texto ChordPro.
  // Além dos nós de texto, trata pontos posicionados nos contêineres flex entre
  // acordes e letras. Nesses casos, usa o segmento imediatamente anterior ou
  // posterior, conforme a extremidade da seleção.
  const getPreviewSourceOffset = (
    container: Node,
    offset: number,
    affinity: 'forward' | 'backward',
    previewRoot: Element
  ): number | null => {
    const getOffsetInsideSegment = (segment: HTMLElement, pointContainer: Node, pointOffset: number): number | null => {
      try {
        const range = document.createRange();
        range.selectNodeContents(segment);
        range.setEnd(pointContainer, pointOffset);
        const visibleOffset = range.toString().length;
        const sourceStart = Number(segment.dataset.sourceStart);
        const sourceEnd = Number(segment.dataset.sourceEnd);
        if (!Number.isFinite(sourceStart) || !Number.isFinite(sourceEnd)) return null;

        if (segment.dataset.sourceKind === 'chord') {
          const chordTextLength = segment.textContent?.length ?? 0;
          // O acorde visível representa o token completo [ACORDE] no ChordPro.
          return visibleOffset <= 0
            ? sourceStart
            : visibleOffset >= chordTextLength
              ? sourceEnd
              : sourceStart + visibleOffset + 1;
        }
        return Math.max(sourceStart, Math.min(sourceEnd, sourceStart + visibleOffset));
      } catch {
        return null;
      }
    };

    const pointElement = container.nodeType === Node.ELEMENT_NODE
      ? container as Element
      : container.parentElement;
    const containingSegment = pointElement?.closest<HTMLElement>('[data-source-start][data-source-end]');
    if (containingSegment && previewRoot.contains(containingSegment)) {
      return getOffsetInsideSegment(containingSegment, container, offset);
    }

    // O navegador também pode colocar o cursor no próprio contêiner flex/linha.
    // Comparamos esse ponto com cada segmento-fonte para localizar a fronteira.
    const segments = Array.from(
      previewRoot.querySelectorAll<HTMLElement>('[data-source-start][data-source-end]')
    );
    if (segments.length === 0) return null;

    let previous: HTMLElement | null = null;
    let next: HTMLElement | null = null;
    for (const segment of segments) {
      try {
        const segmentRange = document.createRange();
        segmentRange.selectNodeContents(segment);
        const relation = segmentRange.comparePoint(container, offset);
        if (relation === 0) {
          return getOffsetInsideSegment(segment, container, offset);
        }
        if (relation < 0) {
          next = segment;
          break;
        }
        previous = segment;
      } catch {
        // Continua procurando outro segmento se o navegador rejeitar o ponto.
      }
    }

    const adjacent = affinity === 'forward'
      ? (next || previous)
      : (previous || next);
    if (!adjacent) return null;
    const sourceStart = Number(adjacent.dataset.sourceStart);
    const sourceEnd = Number(adjacent.dataset.sourceEnd);
    if (!Number.isFinite(sourceStart) || !Number.isFinite(sourceEnd)) return null;

    // Um cursor entre dois segmentos fica na fronteira correspondente. Para uma
    // seleção, início prefere o próximo segmento e fim prefere o anterior.
    if (adjacent === next) return sourceStart;
    return sourceEnd;
  };

  const capturePreviewSelection = () => {
    const selection = window.getSelection();
    const root = document.querySelector('[data-preview-editor="true"]');
    if (!selection || selection.rangeCount === 0 || !root) {
      previewSelectionRef.current = null;
      setPreviewSelection(null);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
      previewSelectionRef.current = null;
      setPreviewSelection(null);
      return;
    }

    const start = getPreviewSourceOffset(
      range.startContainer,
      range.startOffset,
      'forward',
      root
    );
    const end = selection.isCollapsed
      ? start
      : getPreviewSourceOffset(
          range.endContainer,
          range.endOffset,
          'backward',
          root
        );
    if (start === null || end === null) {
      previewSelectionRef.current = null;
      setPreviewSelection(null);
      return;
    }

    // Uma posição de cursor sem texto selecionado é válida: os marcadores
    // personalizados precisam usar exatamente esse offset no ChordPro.
    // Só descartamos intervalos invertidos/ inválidos; start === end representa
    // intencionalmente um cursor, não uma seleção vazia inválida.
    const mapped = {
      start: Math.max(0, Math.min(start, end)),
      end: Math.min(formData.chordPro.length, Math.max(start, end))
    };
    if (!range.collapsed && mapped.end <= mapped.start) {
      previewSelectionRef.current = null;
      setPreviewSelection(null);
      return;
    }
    previewSelectionRef.current = mapped;
    setPreviewSelection(mapped);
  };

  const handleToolbarAction = (label: string) => {
    const currentText = formData.chordPro;
    const activePreviewSelection = previewSelectionRef.current;
    const hasVisualSelection = Boolean(
      activePreviewSelection && activePreviewSelection.end > activePreviewSelection.start
    );

    // NEGRITO e CÔRO só podem ser aplicados a um trecho selecionado no VISOR.
    if ((label === '{NEGRITO}' || label === '{CÔRO}') && !hasVisualSelection) return;
    // Marcadores personalizados só podem ser inseridos com o cursor posicionado,
    // nunca quando há um trecho de texto selecionado. NEGRITO e CÔRO mantêm
    // seu comportamento próprio para seleção de texto.
    if (label !== '{NEGRITO}' && label !== '{CÔRO}' && (!activePreviewSelection || hasVisualSelection)) return;

    let selectionStart: number;
    let selectionEnd: number;

    if (activePreviewSelection) {
      // O VISOR é a referência tanto para cursor isolado quanto para seleção.
      selectionStart = activePreviewSelection.start;
      selectionEnd = activePreviewSelection.end;
    } else if (editorRef.current && label !== '{NEGRITO}' && label !== '{CÔRO}') {
      selectionStart = editorRef.current.selectionStart;
      selectionEnd = editorRef.current.selectionEnd;
    } else {
      return;
    }

    const selectedText = currentText.substring(selectionStart, selectionEnd);
    let textToInsert = '';
    let prefix = '';
    let suffix = '';

    if (label === '{NEGRITO}') {
      prefix = selectionStart > 0 && currentText[selectionStart - 1] !== '\n' ? '\n' : '';
      suffix = selectionEnd < currentText.length && currentText[selectionEnd] !== '\n' ? '\n' : '';
      textToInsert = `${prefix}{C:Chorus}\n${selectedText}\n{C:}${suffix}`;
    } else if (label === '{CÔRO}') {
      prefix = selectionStart > 0 && currentText[selectionStart - 1] !== '\n' ? '\n' : '';
      suffix = selectionEnd < currentText.length && currentText[selectionEnd] !== '\n' ? '\n' : '';
      textToInsert = `${prefix}{textfill: ${coroColor}}\n${selectedText}\n{textfill}${suffix}`;
    } else {
      const lb = labels.find(l => `#${l.name}` === label);
      const color = lb ? lb.color : '#808080';

      if (hasVisualSelection) {
        prefix = selectionStart > 0 && currentText[selectionStart - 1] !== '\n' ? '\n' : '';
        suffix = selectionEnd < currentText.length && currentText[selectionEnd] !== '\n' ? '\n' : '';
        textToInsert = `${prefix}{textfill: ${color}}\n${selectedText}\n{textfill}${suffix}`;
      } else {
        // Sem seleção visual, as marcações personalizadas continuam podendo ser inseridas
        // como uma linha identificadora no ponto atual do editor.
        const prefix = selectionStart > 0 && currentText[selectionStart - 1] !== '\n' ? '\n' : '';
        // No fim do documento, separa o marcador da última linha da letra.
        textToInsert = `${prefix}{textfill: ${color}}\n${label.substring(1)}\n{textfill}\n\n`;
      }
    }

    const newText =
      currentText.substring(0, selectionStart) +
      textToInsert +
      currentText.substring(selectionEnd);

    updateChordPro(newText);

    // O marcador foi inserido. Limpa tanto o intervalo lógico quanto o realce
    // nativo do navegador, para não deixar o trecho selecionado no VISOR.
    previewSelectionRef.current = null;
    setPreviewSelection(null);
    window.getSelection()?.removeAllRanges();
  };
  const insertChord = (chord: string) => {
    if (!editorRef.current) return;
    const { selectionStart, selectionEnd } = editorRef.current;
    const text = `[${chord}]`;
    const newText = formData.chordPro.substring(0, selectionStart) + text + formData.chordPro.substring(selectionEnd);
    updateChordPro(newText);
    
    setTimeout(() => {
      if (editorRef.current) {
        const editor = editorRef.current;
        const pageScrollY = window.scrollY;
        const editorScrollTop = editor.scrollTop;
        const nextPos = selectionStart + text.length;
        editor.focus({ preventScroll: true });
        editor.setSelectionRange(nextPos, nextPos);
        editor.scrollTop = editorScrollTop;
        window.scrollTo({ top: pageScrollY, behavior: 'auto' });
      }
    }, 0);
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
    // Atalhos: Ctrl+Z desfaz, Ctrl+Y/Ctrl+Shift+Z refaz; Shift + Nota abre acordes.
    // Shortcuts for Shift + A, B, C, D, E, F, G
    if (e.shiftKey && ['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(e.key.toUpperCase())) {
      e.preventDefault();
      const note = e.key.toUpperCase();
      const bank = chordBanks.find(b => b.note === note);
      
      if (bank && editorRef.current) {
        // Calcula a posição real do cursor no textarea para ancorar o modal.
        const editor = editorRef.current;
        const caretIndex = editor.selectionStart;
        const editorRect = editor.getBoundingClientRect();
        const computed = window.getComputedStyle(editor);
        const mirror = document.createElement('div');
        const marker = document.createElement('span');

        // O espelho reproduz tipografia, largura e recuos do campo de edição.
        const copiedStyles = [
          'boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom',
          'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth',
          'borderLeftWidth', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
          'letterSpacing', 'lineHeight', 'textAlign', 'textIndent'
        ];
        mirror.style.position = 'fixed';
        mirror.style.left = `${editorRect.left}px`;
        mirror.style.top = `${editorRect.top}px`;
        mirror.style.visibility = 'hidden';
        mirror.style.pointerEvents = 'none';
        mirror.style.whiteSpace = 'pre-wrap';
        mirror.style.overflowWrap = 'break-word';
        mirror.style.wordBreak = 'break-word';
        mirror.style.overflow = 'hidden';
        copiedStyles.forEach((property) => {
          (mirror.style as any)[property] = (computed as any)[property];
        });
        mirror.style.width = `${editor.clientWidth}px`;
        mirror.textContent = editor.value.substring(0, caretIndex);
        marker.textContent = '\\u200b';
        mirror.appendChild(marker);
        document.body.appendChild(mirror);

        const markerRect = marker.getBoundingClientRect();
        const caretPoint = {
          top: markerRect.top - editor.scrollTop,
          left: markerRect.left - editor.scrollLeft
        };
        mirror.remove();

        setChordModal({
          isOpen: true,
          note,
          chords: bank.chords,
          position: {
            top: Math.max(8, Math.min(window.innerHeight - 8, caretPoint.top)),
            left: Math.max(8, Math.min(window.innerWidth - 8, caretPoint.left))
          }
        });
      }
    }
  };

  const toolbarButtons = [
    { label: '{NEGRITO}', tooltip: 'Aplicar negrito ao trecho selecionado', requiresSelection: true, customColor: undefined },
    { label: '{CÔRO}', tooltip: 'Aplicar realce ao trecho selecionado', requiresSelection: true, customColor: undefined },
    ...labels.map(l => ({ label: `#${l.name}`, tooltip: 'Inserir marcador no trecho selecionado', customColor: l.color, requiresSelection: false })),
  ];

  const isFormValid = formData.title.trim() !== '' && 
                    formData.key !== '' && 
                    formData.tempo !== '' && 
                    formData.category !== '';

  // Salva automaticamente após uma breve pausa na digitação. O botão Salvar
  // continua encerrando o formulário; Descartar reverte a edição ou apaga o rascunho.
  const hasContentToSave = Boolean(
    formData.title.trim() || formData.artist.trim() || formData.composition.trim() || formData.chordPro.trim()
  );
  const autoSaveHandlerRef = useRef(onAutoSave);
  useEffect(() => { autoSaveHandlerRef.current = onAutoSave; }, [onAutoSave]);

  useEffect(() => {
    if (!hasContentToSave || isDiscardingRef.current || isFinalizingRef.current) return;
    const timeout = window.setTimeout(() => {
      autoSaveQueueRef.current = autoSaveQueueRef.current.then(async () => {
        if (isDiscardingRef.current) return;
        const savedId = await autoSaveHandlerRef.current(formData, autoSaveIdRef.current);
        if (savedId) autoSaveIdRef.current = savedId;
      }).catch(error => console.error('Erro na fila de salvamento automático:', error));
    }, 900);
    autoSaveTimerRef.current = timeout;
    return () => {
      window.clearTimeout(timeout);
      if (autoSaveTimerRef.current === timeout) autoSaveTimerRef.current = null;
    };
  }, [formData, hasContentToSave]);

  const handleDiscard = async () => {
    if (isDiscardingRef.current || isFinalizingRef.current) return;
    isDiscardingRef.current = true;
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    await autoSaveQueueRef.current;
    await onDiscard(autoSaveIdRef.current);
    onCancel();
  };

  const handleSave = async () => {
    if (!isFormValid || isDiscardingRef.current || isFinalizingRef.current) return;
    isFinalizingRef.current = true;
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    try {
      await autoSaveQueueRef.current;
      await onSave({
        ...formData
      } as any, autoSaveIdRef.current);
    } catch (error) {
      console.error('Erro ao salvar música:', error);
      isFinalizingRef.current = false;
      alert('Não foi possível salvar a música. Verifique sua conexão e tente novamente.');
    }
  };

  useEffect(() => {
    const handleExternalCancel = () => { void handleDiscard(); };
    const handleExternalSave = () => {
      if (isFormValid) handleSave();
    };
    window.addEventListener('recifra:cancel-song-form', handleExternalCancel);
    window.addEventListener('recifra:save-song-form', handleExternalSave);
    return () => {
      window.removeEventListener('recifra:cancel-song-form', handleExternalCancel);
      window.removeEventListener('recifra:save-song-form', handleExternalSave);
    };
  }, [formData, isFormValid, onCancel, onSave, onDiscard, onAutoSave]);

  return (
    <div className="flex flex-col h-full text-sm">
      <AnimatePresence>
        {isManagingCategories && (
          <CategoryManager 
            categories={categories} 
            onClose={() => setIsManagingCategories(false)} 
          />
        )}
        {isManagingLabels && (
          <LabelManager 
            labels={labels} 
            isMaestro={isMaestro}
            coroColor={coroColor}
            onCoroColorChange={(color) => {
              setCoroColor(color);
              localStorage.setItem('recifra_coro_color', color);
            }}
            onClose={() => setIsManagingLabels(false)} 
          />
        )}
        {isManagingFolders && (
          <FolderManager 
            folders={folders}
            type="song"
            onClose={() => setIsManagingFolders(false)}
          />
        )}
        {chordModal.isOpen && (
          <ChordSelectModal 
            note={chordModal.note}
            chords={chordModal.chords}
            position={chordModal.position}
            onSelect={(chord) => {
              insertChord(chord);
              setChordModal({ ...chordModal, isOpen: false });
            }}
            onClose={() => setChordModal({ ...chordModal, isOpen: false })}
          />
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto p-3 sm:p-1 space-y-4">
        <div className="space-y-4 lg:h-full lg:flex lg:flex-col lg:overflow-hidden pb-8">
          {/* Top Form Section: Metadados */}
          <div className="space-y-3 flex-shrink-0">
            {/* Linha 1: título, autoria e intérprete */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-3">
              {/* Row 1: Title */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-text-dim uppercase tracking-widest flex items-center gap-1.5 ml-1">
                  Título Principal <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-primary transition-colors">
                    <Music2 size={16} />
                  </div>
                  <input 
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full bg-white border border-border rounded-lg h-10 pl-10 pr-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-bold text-sm transition-all placeholder:text-text-dim/30"
                    placeholder="Ex: Hallelujah"
                    required
                  />
                </div>
              </div>

              {/* Row 1: Composition */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-text-dim uppercase tracking-widest flex items-center gap-1.5 ml-1">Composição / Autoria</label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-primary transition-colors">
                    <Users size={16} />
                  </div>
                  <input 
                    type="text"
                    value={formData.composition}
                    onChange={e => setFormData({...formData, composition: e.target.value})}
                    className="w-full bg-white border border-border rounded-lg h-10 pl-10 pr-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-text-dim/30"
                    placeholder="Nomes dos compositores"
                  />
                </div>
              </div>

              {/* Artista: disposição original no desktop */}
              <div className="hidden md:block space-y-1">
                <label className="text-[10px] font-black text-text-dim uppercase tracking-widest flex items-center gap-1.5 ml-1">Artista / Intérprete</label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-primary transition-colors">
                    <Mic2 size={16} />
                  </div>
                  <input 
                    type="text"
                    value={formData.artist}
                    onChange={e => setFormData({...formData, artist: e.target.value})}
                    className="w-full bg-white border border-border rounded-lg h-10 pl-10 pr-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-text-dim/30"
                    placeholder="Nome do artista principal"
                    required
                  />
                </div>
              </div>

            </div>

            {/* Linha 2: tom, pasta, andamento e categoria */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-[0.7fr_1.2fr_1.3fr_1.4fr] gap-3">
              {/* Artista: posição mobile */}
              <div className="md:hidden col-span-2 space-y-1">
                <label className="text-[10px] font-black text-text-dim uppercase tracking-widest flex items-center gap-1.5 ml-1">Artista / Intérprete</label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-primary transition-colors">
                    <Mic2 size={16} />
                  </div>
                  <input 
                    type="text"
                    value={formData.artist}
                    onChange={e => setFormData({...formData, artist: e.target.value})}
                    className="w-full bg-white border border-border rounded-lg h-10 pl-10 pr-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-text-dim/30"
                    placeholder="Nome do artista principal"
                    required
                  />
                </div>
              </div>
            {/* Tom */}
              <div className="space-y-1 relative">
                <label className="text-[10px] font-black text-text-dim uppercase tracking-widest flex items-center gap-1.5 ml-1">
                  Tom <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsKeyPickerOpen(!isKeyPickerOpen)}
                  className="w-full bg-white border border-border rounded-lg h-10 px-3 flex items-center justify-between focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded bg-primary/5 flex items-center justify-center">
                      <Music size={14} className="text-primary" />
                    </div>
                    <span className={`font-black text-base ${!formData.key ? 'text-text-dim/30' : 'text-text-main'}`}>
                      {formData.key || 'Definir'}
                    </span>
                  </div>
                  <ChevronDown size={16} className={`text-text-dim transition-transform ${isKeyPickerOpen ? 'rotate-180' : ''}`} />
                </button>

                {isKeyPickerOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-border rounded-2xl p-4 shadow-2xl z-[100] min-w-[300px] border-b-4 border-b-primary animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <span className="text-[10px] font-black uppercase text-text-dim tracking-widest">Seletor de Tom</span>
                      <button onClick={() => setIsKeyPickerOpen(false)} className="text-text-dim hover:text-text-main"><X size={16} /></button>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="text-[9px] font-black uppercase mb-2 text-text-dim/60 ml-1">Tons Maiores</div>
                        <div className="grid grid-cols-6 gap-1">
                          {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(k => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => transposeToKey(k)}
                              className={`flex items-center justify-center text-xs rounded-lg h-9 transition-all border font-bold ${formData.key === k ? 'bg-primary text-white border-primary shadow-md scale-105' : 'hover:bg-zinc-50 text-text-main bg-white border-border'}`}
                            >
                              {k}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-[9px] font-black uppercase mb-2 text-text-dim/60 ml-1">Tons Menores</div>
                        <div className="grid grid-cols-6 gap-1">
                          {['Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'].map(k => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => transposeToKey(k)}
                              className={`flex items-center justify-center text-xs rounded-lg h-9 transition-all border font-bold ${formData.key === k ? 'bg-primary text-white border-primary shadow-md scale-105' : 'hover:bg-zinc-50 text-text-main bg-white border-border'}`}
                            >
                              {k}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pasta de Destino */}
              <div className="space-y-1">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-black text-text-dim uppercase tracking-widest">Pasta</label>
                  <button 
                    type="button"
                    onClick={() => setIsManagingFolders(true)}
                    className="text-[9px] font-black uppercase text-primary hover:bg-primary/5 px-2 py-0.5 rounded transition-all"
                  >
                    Gerenciar
                  </button>
                </div>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-primary transition-colors">
                    <FolderOpen size={16} />
                  </div>
                  <select 
                    value={formData.folderId}
                    onChange={e => setFormData({...formData, folderId: e.target.value})}
                    className="w-full bg-white border border-border rounded-lg h-10 pl-10 pr-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none cursor-pointer transition-all"
                  >
                    <option value="">Sem Pasta (Raiz)</option>
                    {folders.filter(f => !f.type || f.type === 'song').map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-dim">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>

              <div className="col-span-2 lg:col-span-2 grid grid-cols-2 gap-3 min-w-0">
              <div className="space-y-1 min-w-0">
                <label className="text-[10px] font-black text-text-dim uppercase tracking-widest flex items-center gap-1.5 ml-1">
                  Andamento <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-1 bg-zinc-50 border border-border rounded-lg p-1 h-10">
                  {['Lento', 'Moderado', 'Rápido'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormData({...formData, tempo: t})}
                      className={`flex items-center justify-center text-[10px] font-bold rounded-lg transition-all ${formData.tempo === t ? 'bg-white text-primary shadow-sm ring-1 ring-primary/20' : 'text-text-dim hover:text-text-main'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1 min-w-0">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-black text-text-dim uppercase tracking-widest">
                    Categoria <span className="text-red-500">*</span>
                  </label>
                  <button 
                    type="button"
                    onClick={() => setIsManagingCategories(true)}
                    className="text-[9px] font-black uppercase text-primary hover:bg-primary/5 px-2 py-0.5 rounded transition-all"
                  >
                    Editar
                  </button>
                </div>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-primary transition-colors">
                    <Tag size={16} />
                  </div>
                  <select 
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full bg-white border border-border rounded-lg h-10 pl-10 pr-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none cursor-pointer transition-all"
                  >
                    <option value="">Selecionar...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-dim">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
          <div className="flex-none lg:flex-1 lg:overflow-hidden min-h-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 lg:h-full items-start lg:items-stretch">
              {/* COLUMN 1: Editor */}
              <div className="flex h-auto lg:h-full min-h-0 flex-col bg-white border border-primary rounded-2xl overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-4 h-12 bg-primary">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsEditorExpanded(!isEditorExpanded)}
                      className="text-white hover:text-zinc-200 px-2 py-0.5 rounded transition-all"
                    >
                      {isEditorExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <span className="text-[12px] font-black uppercase text-white tracking-widest">Editor Chordpro</span>
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={undo} title="Desfazer (Ctrl+Z)" aria-label="Desfazer" disabled={history.length === 0} className="text-white/80 hover:text-white transition-colors disabled:opacity-30"><RotateCcw size={14} /></button>
                    <button type="button" onClick={redo} title="Refazer (Ctrl+Y)" aria-label="Refazer" disabled={redoStack.length === 0} className="text-white/80 hover:text-white transition-colors disabled:opacity-30"><RotateCw size={14} /></button>
                  </div>
                </div>
                {isEditorExpanded && (
                
<div className="flex flex-wrap items-center gap-1 p-1.5 bg-zinc-50 border-b border-zinc-200">
  {usedChords.length > 0 ? (
    usedChords.map(chord => (
      <button
        key={chord}
        type="button"
        onClick={() => insertChord(chord)}
        className="h-6 w-auto flex-none px-2 rounded bg-white border font-bold text-[11px] hover:scale-105 transition-all shadow-sm active:scale-95 whitespace-nowrap"
        style={{ color: chordColor, borderColor: chordColor }}
      >
        {chord}
      </button>
    ))
  ) : (
    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest px-2 py-1">
      Digite acordes na cifra para exibi-los aqui...
    </span>
  )}
</div>

                )}

                {isEditorExpanded && (
                  <>
                    <div className="relative flex-none lg:flex-1 min-h-[280px] lg:min-h-0 bg-white shadow-inner overflow-hidden" style={{ height: window.matchMedia('(max-width: 1023px)').matches ? Math.max(280, formData.chordPro.split(/\r?\n/).reduce((total, line) => { const usableWidth = Math.max(120, window.innerWidth - 64); const charsPerVisualLine = Math.max(18, Math.floor(usableWidth / 6.6)); return total + Math.max(1, Math.ceil(line.length / charsPerVisualLine)); }, 0) * 18 + 64) : undefined }}>
                      <div aria-hidden="true" className="absolute z-20 inset-0 w-full h-full py-6 px-4 sm:px-8 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words overflow-hidden pointer-events-none">
                        {formData.chordPro.split(/(\\[[^\\]\\n]+\\])/g).map((part, index) =>
                          /^\\[[^\\]\\n]+\\]$/.test(part)
                            ? <span key={index} style={{ color: chordColor }}>{part}</span>
                            : <span key={index} className="text-zinc-900">{part}</span>
                        )}
                      </div>
                      <textarea
                        ref={editorRef}
                        value={formData.chordPro}
                        onChange={e => updateChordPro(e.target.value)}
                        onKeyDown={handleEditorKeyDown}
                        className="absolute z-10 inset-0 w-full h-full bg-transparent py-6 px-4 sm:px-8 font-mono text-[11px] leading-relaxed text-transparent caret-zinc-900 outline-none resize-none overflow-auto placeholder:text-zinc-300 selection:bg-primary/20" style={{ WebkitTextFillColor: 'transparent', color: 'transparent' }}
                        placeholder="[C] Digite ou [G] cole sua [Am] cifra aqui..."
                        spellCheck={false}
                        required
                      />
                    </div>
                    
                    {/* Editor Bottom Actions */}
                    <div className="p-2.5 bg-[#EEF1F5] border-t border-[#DCE3EC] rounded-b-2xl">
                      <input
                        ref={importFileRef}
                        type="file"
                        accept=".cho,.chordpro,.txt,text/plain"
                        className="hidden"
                        onChange={handleImportChordPro}
                        aria-label="Selecionar arquivo de cifra para importar"
                      />
                      <div className="grid grid-cols-5 gap-1.5">
                        <button type="button" title="Novo" aria-label="Novo" onClick={() => { originalTransposeRef.current = null; setHistory(prev => [formData.chordPro, ...prev].slice(0, 50)); setRedoStack([]); setFormData({...formData, title: '', artist: '', composition: '', category: '', tempo: 'Moderado', key: 'C', chordPro: '', folderId: ''}); }} className="h-9 min-w-0 flex items-center justify-center gap-1 bg-[#174EA6] border border-[#174EA6] rounded-lg text-[8px] sm:text-[9px] font-bold uppercase text-white hover:bg-[#0D3F8A] transition-all"><FilePlus size={13} /> <span className="truncate">Novo</span></button>
                        <button type="button" title="Importar cifra" aria-label="Importar" onClick={() => importFileRef.current?.click()} className="h-9 min-w-0 flex items-center justify-center gap-1 bg-[#174EA6] border border-[#174EA6] rounded-lg text-[8px] sm:text-[9px] font-bold uppercase text-white hover:bg-[#0D3F8A] transition-all"><FileUp size={13} /> <span className="truncate">Importar</span></button>
                        <button type="button" title="Exportar cifra" aria-label="Exportar" onClick={handleExportChordPro} className="h-9 min-w-0 flex items-center justify-center gap-1 bg-[#174EA6] border border-[#174EA6] rounded-lg text-[8px] sm:text-[9px] font-bold uppercase text-white hover:bg-[#0D3F8A] transition-all"><Download size={13} /> <span className="truncate">Exportar</span></button>
                        <button type="button" title="Limpar acordes da cifra" aria-label="Limpar cifra" onClick={() => updateChordPro(formData.chordPro.replace(/\[[^\]]+\]/g, ''))} className="h-9 min-w-0 flex items-center justify-center gap-1 bg-[#174EA6] border border-[#174EA6] rounded-lg text-[8px] sm:text-[9px] font-bold uppercase text-white hover:bg-[#0D3F8A] transition-all"><Eraser size={13} /> <span className="truncate">Limpar</span></button>
                        <button type="button" title="Restaurar tom original" aria-label="Restaurar tom" onClick={restoreOriginalKey} className="h-9 min-w-0 flex items-center justify-center gap-1 bg-[#174EA6] border border-[#174EA6] rounded-lg text-[8px] sm:text-[9px] font-bold uppercase text-white hover:bg-[#0D3F8A] transition-all"><RotateCcw size={13} /> <span className="truncate">Restaurar</span></button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              {/* COLUMN 2: Preview */}
              <div className="flex h-auto lg:h-full min-h-0 flex-col bg-white border border-primary rounded-2xl overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-4 h-12 bg-primary">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
                      className="text-white hover:text-zinc-200 transition-colors px-2 py-0.5 rounded transition-all"
                    >
                      {isPreviewExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <span className="text-[12px] font-black uppercase text-white tracking-widest">VISOR</span>
                    <div className="flex items-center gap-2 ml-8" title="Ajustar tamanho da letra e disposição da pré-visualização">
                      <button type="button" onClick={() => { setChordSize(v => Math.max(9, v - 1)); setLyricSize(v => Math.max(10, v - 1)); }} className="w-7 h-7 rounded-md border border-zinc-200 text-white hover:text-primary" title="Diminuir fonte">A−</button>
                      <button type="button" onClick={() => { setChordSize(v => Math.min(22, v + 1)); setLyricSize(v => Math.min(24, v + 1)); }} className="w-7 h-7 rounded-md border border-zinc-200 text-white hover:text-primary" title="Aumentar fonte">A+</button>
                      <button type="button" onClick={() => setPreviewColumns(v => v === 1 ? 2 : 1)} className="h-7 px-2 rounded-md border border-zinc-200 text-[9px] font-bold text-white hover:text-primary" title="Alternar entre uma e duas colunas">{previewColumns} col.</button>
                    </div>
                  </div>

                </div>
                {isPreviewExpanded && (
                  <div className="flex flex-wrap items-center gap-1 p-1.5 bg-zinc-50 border-b border-zinc-200">
                    {toolbarButtons.map(btn => {
                      const isCustomMarker = !btn.requiresSelection;
                      const hasPreviewPosition = previewSelection !== null;
                      const hasPreviewTextSelection = Boolean(
                        previewSelection && previewSelection.end > previewSelection.start
                      );
                      const isDisabled = btn.requiresSelection
                        ? !hasPreviewTextSelection
                        : (!hasPreviewPosition || hasPreviewTextSelection);
                      const buttonTooltip = isCustomMarker
                        ? (hasPreviewTextSelection
                            ? 'Marcadores indisponíveis durante a seleção de texto.'
                            : hasPreviewPosition
                              ? 'Inserir marcador no ponto selecionado.'
                              : 'Posicione o cursor no ponto desejado.')
                        : btn.tooltip;
                      return (
                        <button
                          key={btn.label}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleToolbarAction(btn.label)}
                          disabled={isDisabled}
                          title={buttonTooltip}
                          aria-label={buttonTooltip}
                          className={`h-6 w-auto flex-none px-2 rounded bg-white border font-bold text-[11px] transition-all shadow-sm whitespace-nowrap ${
                            isDisabled
                              ? 'opacity-35 cursor-not-allowed'
                              : 'hover:scale-105 active:scale-95'
                          }`}
                          style={{ color: chordColor, borderColor: chordColor }}
                        >
                          {btn.label.replace(/\{|\}|#/g, '')}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      title="Gerenciar marcadores"
                      aria-label="Gerenciar marcadores"
                      onClick={() => setIsManagingLabels(true)}
                      className="h-6 w-7 flex-none flex items-center justify-center bg-white border border-dashed border-zinc-300 rounded-md text-zinc-400 hover:text-primary hover:border-primary transition-all"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                )}

                {isPreviewExpanded && (
                  <>
                    <div className="flex-1 bg-white p-4.5 font-mono text-[10px] leading-relaxed shadow-inner">
                       <div className="mb-3 space-y-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-black text-zinc-900 uppercase">{formData.title || 'Música Sem Nome'}</h4>
                            <span className="text-lg font-black" style={{ color: chordColor }}>({formData.key || '-'})</span>
                          </div>
                          <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                            {formData.artist || 'Artista'} <span className="font-medium lowercase">({formData.composition || 'Compositores'})</span>
                          </div>
                       </div>

                       <div data-preview-brace-layer="true" className="relative">
                       <div
                         data-preview-editor="true"
                         contentEditable
                         suppressContentEditableWarning
                         role="textbox"
                         aria-label="Visor da música: posicione o cursor ou selecione somente a letra"
                         spellCheck={false}
                         style={{
                           columnCount: previewColumns,
                           columnGap: '2rem',
                           outline: 'none',
                           cursor: 'text',
                           userSelect: 'text',
                           WebkitUserSelect: 'text'
                         }}
                         onBeforeInput={(event) => event.preventDefault()}
                         onPaste={(event) => event.preventDefault()}
                         onDrop={(event) => event.preventDefault()}
                         onCut={(event) => event.preventDefault()}
                         onKeyDown={(event) => {
                           const navigationKeys = [
                             'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
                             'Home', 'End', 'PageUp', 'PageDown', 'Shift',
                             'Control', 'Alt', 'Meta', 'Escape'
                           ];
                           const isSelectAll = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a';
                           if (!navigationKeys.includes(event.key) && !isSelectAll) {
                             event.preventDefault();
                           }
                         }}
                         onMouseUp={capturePreviewSelection}
                         onKeyUp={capturePreviewSelection}
                         onTouchEnd={capturePreviewSelection}
                         onBlur={() => {
                           // Ao sair do VISOR, invalida a posição anterior para
                           // exigir um novo posicionamento antes de inserir outro marcador.
                           previewSelectionRef.current = null;
                           setPreviewSelection(null);
                         }}
                       >
                         <ChordProRenderer
                           text={formData.chordPro}
                           chordSize={chordSize}
                           lyricSize={lyricSize}
                           chordColor={chordColor}
                           lyricColor={lyricColor}
                         />
                       </div>
                       </div>
                    </div>

                    {/* Preview Bottom Actions */}
                    <div className="flex flex-col gap-1.5 p-2.5 bg-[#EEF1F5] border-t border-[#DCE3EC] rounded-b-2xl">
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={handleDiscard}
                          className="h-9 bg-[#174EA6] border border-[#174EA6] rounded-lg text-[10px] font-bold uppercase tracking-widest text-white hover:bg-[#0D3F8A] transition-all"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={!isFormValid}
                          className={`h-9 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                            isFormValid
                              ? 'bg-[#174EA6] text-white shadow-lg hover:bg-[#0D3F8A]'
                              : 'bg-[#174EA6]/45 text-white/80'
                          }`}
                        >
                          <Save size={15} /> Salvar
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}
