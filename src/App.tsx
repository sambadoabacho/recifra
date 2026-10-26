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
  query, orderBy, serverTimestamp, where 
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
  ArrowUp, ArrowDown, Radio, Menu, Layout, Settings, ListMusic, Sun, Moon, Archive, Library,
  Share2, CheckSquare, Square, GripVertical, ArrowLeft, Download, Upload, FilePlus, Boxes, Brain, FileText, Check, Lock, LockOpen, Plus,
  Folder as FolderIcon, Hash, Info, Gamepad, LayoutList, Mic2, Music2, FolderOpen, ChevronDown, Tag, RotateCcw, RotateCw, Smile, PlusCircle, FileUp, Eraser, Eye
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { jsPDF } from 'jspdf';

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
  const [isMaestroActive, setIsMaestroActive] = useState(false);
  const [followLeader, setFollowLeader] = useState(false);
  const [userRole, setUserRole] = useState<'maestro' | 'musician'>('musician');

  const isMaestro = userRole === 'maestro';

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('songs');
  const [sidebarView, setSidebarView] = useState<'tabs' | 'repertorio-songs'>('tabs');
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const [expandedRepFolders, setExpandedRepFolders] = useState<string[]>([]);
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem('GEMINI_API_KEY') || '');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [selectedSongIdForAction, setSelectedSongIdForAction] = useState<string | null>(null);
  const [selectedRepIds, setSelectedRepIds] = useState<string[]>([]);
  const [isKeyPickerOpen, setIsKeyPickerOpen] = useState(false);
  const [isSharePopoverOpen, setIsSharePopoverOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSidebarActionOpen, setIsSidebarActionOpen] = useState(false);
  const [isUpdatingKey, setIsUpdatingKey] = useState(false);
  const lastKeyUpdateRef = useRef<{time: number, id: string} | null>(null);
  const [isSidebarArchiveOpen, setIsSidebarArchiveOpen] = useState(false);
  const bottomArchiveRef = useRef<HTMLDivElement>(null);
  const [isExportFolderModalOpen, setIsExportFolderModalOpen] = useState(false);
  const [isPickingFolderForNewRep, setIsPickingFolderForNewRep] = useState(false);
  const [managingFolderType, setManagingFolderType] = useState<'song' | 'repertorio' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sidebarActionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideDropdown = !dropdownRef.current || !dropdownRef.current.contains(target);
      const isOutsideSidebarAction = !sidebarActionRef.current || !sidebarActionRef.current.contains(target);
      
      if (isOutsideDropdown && isOutsideSidebarAction) {
        setIsSidebarActionOpen(false);
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
          
          newScale = Math.min(newScale, Math.max(0.6, maxAllowedScale));
        }

        setChordProScale(prev => Math.min(Math.max(0.6, newScale), 2.5));
        setInitialDist(dist);
      }
    }
  };

  const [isCapturingKey, setIsCapturingKey] = useState<any>(null); // 'next' or 'prev'
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('geral');
  const [isMovingSongs, setIsMovingSongs] = useState(false);

  // Reset selection mode when changing tabs, views or folders
  useEffect(() => {
    setIsSelectionMode(false);
    setSelectedSongIds([]);
    setSelectedRepIds([]);
    setIsMovingSongs(false);
  }, [sidebarTab, sidebarView, expandedFolders]);
  const [activeMobileSongId, setActiveMobileSongId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'title' | 'composition' | 'artist' | 'updatedAt'>('title');
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

  // Auto-select last song for Maestro if on list view
  useEffect(() => {
    if (isMaestro && songs.length > 0 && currentView === 'list') {
      const lastId = localStorage.getItem('lastSongId');
      const lastSong = songs.find(s => s.id === lastId) || songs[0];
      
      if (lastSong) {
        setSelectedSong(lastSong);
        setCurrentView('details');
      }
    }
  }, [isMaestro, songs, currentView]);

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
      const songList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Song));
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
    const unsubscribe = onSnapshot(sessionDoc, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Session;
        setLiveSession(data);
        
        // If following leader and song changes
        if (followLeader && data.currentSongId && (!selectedSong || selectedSong.id !== data.currentSongId)) {
          if (data.currentSongId.startsWith('group:')) {
            const groupId = data.currentSongId.replace('group:', '');
            // Buscamos o grupo no repertório selecionado pelo músico
            if (selectedRepertorio) {
              const group = selectedRepertorio.songGroups?.find((g: any) => (g.id === groupId || g.title === groupId));
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
            }
          } else {
            const song = songs.find(s => s.id === data.currentSongId);
            if (song) {
              setSelectedSong(song);
              setCurrentView('details');
            }
          }
        }
      }
    });
    return () => unsubscribe();
  }, [user, followLeader, songs, selectedSong]);

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

  const saveSong = async (songData: Partial<Song>) => {
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
        await addDoc(collection(db, 'songs'), data);
        setCurrentView('list');
      }
    } catch (error) {
      console.error('Error saving song:', error);
    }
  };

  const saveSongBlock = async (blockData: SongBlock) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'song_blocks'), blockData);
      setCurrentView('blocks');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'song_blocks');
    }
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
    if (!window.confirm('Excluir esta música?')) return;
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
        songKeys: data.songKeys || selectedRepertorio?.songKeys || {},
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
    setIsMaestroActive(newIsMaestroActive);
    if (newIsMaestroActive) {
      setFollowLeader(false);
      // Auto open sidebar for repertoire selection
      setSidebarTab('repertorios');
      setIsSidebarOpen(true);
      try {
        await setDoc(doc(db, 'sessions', 'current_live'), {
          leaderId: user.uid,
          leaderName: user.displayName,
          currentSongId: selectedSong?.id || null,
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error setting maestro:', error);
      }
    } else {
      // Clear maestro if we were the leader
      if (liveSession?.leaderId === user.uid) {
        await updateDoc(doc(db, 'sessions', 'current_live'), {
          leaderId: null,
          leaderName: null,
          updatedAt: new Date().toISOString()
        });
      }
    }
  };

  const updateLiveSong = async (songId: string) => {
    if (isMaestroActive && user) {
      try {
        await updateDoc(doc(db, 'sessions', 'current_live'), {
          currentSongId: songId,
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error updating live song:', error);
      }
    }
  };

  const enterStageMode = () => {
    if (isMaestro) {
      toggleLeader(true);
    } else {
      setFollowLeader(true);
    }
    setCurrentView('details');
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
        doc.setFont('courier', 'normal');
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
                doc.setFont('courier', 'normal');
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
            doc.setFont('courier', 'normal');
            doc.setFontSize(10);
          } else if (hasChords) {
            let cursorX = leftMargin;
            const charWidth = doc.getTextWidth(" "); // Courier is mono
            
            doc.setFont('courier', 'bold');
            doc.setTextColor(primaryRed[0], primaryRed[1], primaryRed[2]);
            chunks.forEach(chunk => {
              if (chunk.chord) doc.text(chunk.chord, cursorX, y);
              const cW = chunk.chord ? chunk.chord.length : 0;
              const tW = chunk.text ? chunk.text.length : 0;
              cursorX += Math.max(cW, tW) * charWidth;
            });
            
            y += chordOffset;
            cursorX = leftMargin;

            doc.setFont('courier', isChorus ? 'bold' : 'normal');
            doc.setTextColor(0, 0, 0);
            chunks.forEach(chunk => {
              if (chunk.text) doc.text(chunk.text, cursorX, y);
              const cW = chunk.chord ? chunk.chord.length : 0;
              const tW = chunk.text ? chunk.text.length : 0;
              cursorX += Math.max(cW, tW) * charWidth;
            });
            
            y += lineHeight * 1.15;
          } else {
            doc.setFont('courier', isChorus ? 'bold' : 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text(line, leftMargin, y);
            y += lineHeight * 1.15;
          }
        });
      }
    });

    if (returnDoc) return doc;
    doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}.pdf`);
  };

  const shareAsPDF = async (songList: Song[], title: string) => {
    const docObj = generatePDF(songList, title, true) as jsPDF;
    const pdfBlob = docObj.output('blob');
    const fileName = `${title.replace(/\s+/g, '_')}.pdf`;
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
              pdfPages,
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
          pdfPages,
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
          const header = [
            `{title: ${song.title}}`,
            `{artist: ${song.artist}}`,
            `{composition: ${song.composition || ''}}`,
            `{key: ${song.key}}`,
            `{tempo: ${song.tempo}}`,
            `{category: ${song.category}}`,
            folderName ? `{folder: ${folderName}}` : '',
            '',
            ''
          ].filter(Boolean).join('\n');
          const blob = new Blob([header + song.chordPro], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${song.title.replace(/\s+/g, '_')}.cho`;
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
          zip.file(`${song.title.replace(/\s+/g, '_')}.pdf`, docObj.output('blob'));
        } else {
          const header = [
            `{title: ${song.title}}`,
            `{artist: ${song.artist}}`,
            `{composition: ${song.composition || ''}}`,
            `{key: ${song.key}}`,
            `{tempo: ${song.tempo}}`,
            `{category: ${song.category}}`,
            '',
            ''
          ].filter(Boolean).join('\n');
          zip.file(`${song.title.replace(/\s+/g, '_')}.cho`, header + song.chordPro);
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
        zip.file(`${song.title.replace(/\s+/g, '_')}.pdf`, pdfBlob);
      } else {
        const folderName = folders.find(f => f.id === song.folderId)?.name || '';
        const header = [
          `{title: ${song.title}}`,
          `{artist: ${song.artist}}`,
          `{composition: ${song.composition || ''}}`,
          `{key: ${song.key}}`,
          `{tempo: ${song.tempo}}`,
          `{category: ${song.category}}`,
          folderName ? `{folder: ${folderName}}` : '',
          '',
          ''
        ].filter(Boolean).join('\n');
        zip.file(`${song.title.replace(/\s+/g, '_')}.cho`, header + song.chordPro);
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

  const handleRstExport = async () => {
    const repsToExport = repertorios.filter(r => selectedRepIds.includes(r.id!));

    if (repsToExport.length === 0) {
      alert("Selecione ao menos um repertório para exportar (use o modo de seleção na lista).");
      return;
    }

    if (repsToExport.length === 1) {
      const rep = repsToExport[0];
      const rstData = {
        type: 'repertorio_instruction',
        title: rep.title,
        songs: rep.songIds.map((id: string) => {
          const song = songs.find(s => s.id === id);
          if (!song) return null;
          return {
            title: song.title,
            artist: song.artist,
            key: song.key,
            category: song.category,
            tempo: song.tempo,
            composition: song.composition || ''
          };
        }).filter(Boolean)
      };

      const blob = new Blob([JSON.stringify(rstData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${rep.title.replace(/\s+/g, '_')}.rst`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const zip = new JSZip();
      repsToExport.forEach(rep => {
        const rstData = {
          type: 'repertorio_instruction',
          title: rep.title,
          songs: rep.songIds.map((id: string) => {
            const song = songs.find(s => s.id === id);
            if (!song) return null;
            return {
              title: song.title,
              artist: song.artist,
              key: song.key,
              category: song.category,
              tempo: song.tempo,
              composition: song.composition || ''
            };
          }).filter(Boolean)
        };
        zip.file(`${rep.title.replace(/\s+/g, '_')}.rst`, JSON.stringify(rstData, null, 2));
      });
      
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Exportacao_Repertorios.zip`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleRstImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.rst';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        if (data.type !== 'repertorio_instruction') throw new Error('Formato inválido');
        
        const foundSongIds: string[] = [];
        const missingSongs: string[] = [];

        data.songs.forEach((sInfo: any) => {
          const song = songs.find(s => 
            s.title.toLowerCase().trim() === sInfo.title.toLowerCase().trim() && 
            s.artist.toLowerCase().trim() === sInfo.artist.toLowerCase().trim()
          );
          if (song) {
            foundSongIds.push(song.id!);
          } else {
            missingSongs.push(`${sInfo.title} (${sInfo.artist})`);
          }
        });

        if (missingSongs.length > 0) {
          alert(`Importação concluída com avisos. As seguintes músicas não foram encontradas no banco e foram ignoradas:\n\n${missingSongs.join('\n')}`);
        }

        const newRepertorio = {
          title: data.title,
          songIds: foundSongIds,
          createdBy: user?.uid || 'unknown',
          updatedAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, 'setlists'), newRepertorio);
        alert('Repertório importado com sucesso!');
        setSelectedRepertorio({ id: docRef.id, ...newRepertorio });
        setCurrentView('repertorios');
      } catch (err) {
        alert('Erro ao importar arquivo .rst. Verifique se o formato está correto.');
      }
    };
    input.click();
  };

  const handleRepertorioPdfList = () => {
    if (!selectedRepertorio) return;
    const doc = new jsPDF();
    let y = 20;
    const songIds = selectedRepertorio.songIds || [];
    const songGroups = selectedRepertorio.songGroups || [];
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(selectedRepertorio.title.toUpperCase(), 20, y);
    
    if (selectedRepertorio.date) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const dateDisplay = new Date(selectedRepertorio.date + 'T12:00:00').toLocaleDateString('pt-BR');
      doc.text(dateDisplay, 190, y, { align: 'right' });
    }
    
    y += 12;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('#', 20, y);
    doc.text('Título / Artista', 30, y);
    doc.text('Tom', 120, y);
    doc.text('Categoria', 145, y);
    doc.text('Andamento', 175, y);
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
        doc.text('Categoria', 145, y);
        doc.text('Andamento', 175, y);
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
          
          doc.setTextColor(13, 71, 161);
          doc.text(song.key || '-', 120, y);
          doc.setTextColor(0, 0, 0);
          
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text((song.category || '').substring(0, 18), 145, y);
          doc.text(song.tempo || '-', 175, y);
          
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

    doc.save(`Lista_${selectedRepertorio.title.replace(/\s+/g, '_')}.pdf`);
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

    const oldIdx = selectedRepertorio.songIds.indexOf(active.id as string);
    const newIdx = selectedRepertorio.songIds.indexOf(over.id as string);
    
    if (oldIdx === -1 || newIdx === -1) return;

    // Local state calculation for instant feedback
    const newSongIds = arrayMove([...selectedRepertorio.songIds], oldIdx, newIdx);
    
    try {
      // Optimistic update of local state
      let finalNewSongIds = [...newSongIds];
      
      const activeItem = sortableItemsData.find(i => i.id === active.id);
      if (activeItem?.type === 'group_handle' && activeItem.group.isLocked) {
        // If we are moving a LOCKED group, we need to move its "tail" (all songs following it until the next group)
        const groupIndex = selectedRepertorio.songIds.indexOf(active.id as string);
        const tailSongs: string[] = [];
        for (let i = groupIndex + 1; i < selectedRepertorio.songIds.length; i++) {
          if (selectedRepertorio.songIds[i].startsWith('group:')) break;
          tailSongs.push(selectedRepertorio.songIds[i]);
        }
        
        if (tailSongs.length > 0) {
          // Remove them from current positions and insert them after the moved handle
          const filteredIds = newSongIds.filter(id => !tailSongs.includes(id));
          const handleIdx = filteredIds.indexOf(active.id as string);
          filteredIds.splice(handleIdx + 1, 0, ...tailSongs);
          finalNewSongIds = filteredIds;
        }
      }

      const updatedRepertorio = { ...selectedRepertorio, songIds: finalNewSongIds };
      setSelectedRepertorio(updatedRepertorio);
      setRepertorios(prev => prev.map(r => r.id === selectedRepertorio.id ? updatedRepertorio : r));

      const setlistRef = doc(db, 'setlists', selectedRepertorio.id);
      await updateDoc(setlistRef, {
        songIds: finalNewSongIds,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error reordering items:', error);
      // Revert if Firestore update fails
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
    let currentGroupLocked = false;

    songIds.forEach((id: string) => {
      if (id.startsWith('group:')) {
        const gid = id.split(':')[1];
        const group = groups.find((g: any) => g.id === gid);
        if (group) {
          currentGroupLocked = !!group.isLocked;
          items.push({ 
            id: id, 
            type: 'group_handle', 
            group: group,
            displayIndex: blockCounter++
          });
        }
      } else {
        items.push({ 
          id: id, 
          type: 'song', 
          index: songCounter++, 
          isLocked: currentGroupLocked
        });
      }
    });

    return items;
  }, [selectedRepertorio?.songIds, selectedRepertorio?.songGroups]);

  const sortableIds = useMemo(() => sortableItemsData.map(item => item.id), [sortableItemsData]);

  const handleToggleGroupLock = async (groupId: string) => {
    if (!selectedRepertorio) return;
    const newGroups = (selectedRepertorio.songGroups || []).map((g: any) => 
      g.id === groupId ? { ...g, isLocked: !g.isLocked } : g
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

  const handleToggleAllGroupsLock = async () => {
    if (!selectedRepertorio) return;
    const allLocked = selectedRepertorio.songGroups?.every((g: any) => g.isLocked) || false;
    const newGroups = (selectedRepertorio.songGroups || []).map((g: any) => ({
      ...g,
      isLocked: !allLocked
    }));
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
      const header = [
        `{title: ${song.title}}`,
        `{artist: ${song.artist}}`,
        `{composition: ${song.composition || ''}}`,
        `{key: ${song.key}}`,
        `{tempo: ${song.tempo}}`,
        `{category: ${song.category}}`,
        folderName ? `{folder: ${folderName}}` : '',
        '',
        ''
      ].filter(Boolean).join('\n');
      const blob = new Blob([header + song.chordPro], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${song.title.replace(/\s+/g, '_')}.cho`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const shareContent = async (song: Song) => {
    shareAsPDF([song], song.title);
    setIsSharePopoverOpen(false);
  };

  const filteredSongs = useMemo(() => {
    let result = songs.filter(s => 
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.composition && s.composition.toLowerCase().includes(searchTerm.toLowerCase())) ||
      s.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
  }, [songs, searchTerm, sortBy, filterKey, filterTempo, filterCategory]);

  const songsInActiveContext = useMemo(() => {
    if (searchTerm) return filteredSongs;
    if (expandedFolders.length > 0) {
      if (expandedFolders.includes('all')) return filteredSongs;
      return filteredSongs.filter(s => s.folderId && expandedFolders.includes(s.folderId));
    }
    return filteredSongs.filter(s => !s.folderId);
  }, [searchTerm, filteredSongs, expandedFolders]);

  const filteredRepertorios = useMemo(() => {
    return repertorios.filter(s => 
      s.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [repertorios, searchTerm]);

  const allKeys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  const handleKeySelect = async (targetKey: string) => {
    if (!selectedSong) return;
    const sourceIndex = allKeys.indexOf(selectedSong.key);
    const targetIndex = allKeys.indexOf(targetKey);
    
    const diff = sourceIndex !== -1 && targetIndex !== -1 ? targetIndex - sourceIndex : 0;
    
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

  const currentKey = useMemo(() => {
    if (!selectedSong) return '';
    const sourceIndex = allKeys.indexOf(selectedSong.key);
    if (sourceIndex === -1) return selectedSong.key;
    const targetIndex = (sourceIndex + transposition + 12) % 12;
    return allKeys[targetIndex];
  }, [selectedSong, transposition]);

  if (!user) {
    return (
      <div className="min-h-screen bg-bg text-text-main flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <h1 className="text-6xl font-bold mb-2 tracking-tighter text-primary">#ReSet</h1>
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
                  setSelectedRepertorio(null);
                  setTransposition(0);
                }}
                className="p-2 -ml-2 hover:bg-surface rounded-full text-primary"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="font-bold text-xl tracking-tighter uppercase">
              #RE<span className="text-primary">SET</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5" ref={dropdownRef}>
            {isMaestro && (
              <button 
                onClick={() => toggleLeader()}
                className={`p-2 rounded-full transition-all ${isMaestroActive ? 'bg-primary text-white' : 'text-text-dim hover:bg-surface'}`}
                title={isMaestroActive ? "Desativar Modo Maestro" : "Ativar Modo Maestro"}
              >
                <UserIcon size={18} />
              </button>
            )}

            {!isMaestroActive && isMaestro && (
              <button 
                onClick={enterStageMode}
                className="p-2 hover:bg-surface rounded-full transition-colors text-text-dim"
                title="Modo Palco"
              >
                <Mic2 size={18} />
              </button>
            )}
            
            <div className="w-px h-4 bg-border mx-1" />

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
                className="p-2 hover:bg-surface rounded-full text-text-dim"
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
            active={sidebarTab === 'songs'} 
            onClick={() => {
              setSidebarTab('songs');
              setSidebarView('tabs');
              setSelectedRepertorio(null);
              setTransposition(0);
              setSelectedSongIds([]);
              setIsSelectionMode(false);
            }} 
          />
          <SidebarNavItem 
            icon={<ListMusic size={18} />} 
            label="Repertórios" 
            active={sidebarTab === 'repertorios'} 
            onClick={() => {
              setSidebarTab('repertorios');
              setSidebarView('tabs');
              setSelectedRepertorio(null);
              setTransposition(0);
              setSelectedSongIds([]);
              setIsSelectionMode(false);
            }} 
          />
          <SidebarNavItem 
            icon={<LayoutList size={18} />} 
            label="Blocos" 
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
            icon={<Settings size={18} />} 
            label="Ajustes" 
            active={sidebarTab === 'settings'} 
            onClick={() => {
              setSidebarTab('settings');
              setSidebarView('tabs');
              setSelectedRepertorio(null);
              setTransposition(0);
              setSelectedSongIds([]);
              setIsSelectionMode(false);
            }} 
          />
        </nav>

        <div className="px-4 pt-4 pb-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0D47A1]" size={16} />
            <input 
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-[#0D47A1] rounded-lg py-2 pl-9 pr-10 text-sm focus:ring-1 focus:ring-[#0D47A1] outline-none text-[#0D47A1] placeholder:text-[#0D47A1]/50"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0D47A1] hover:text-[#0D47A1]/80 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {(sidebarTab === 'songs' && (expandedFolders.length > 0 || searchTerm)) && (
            <div className="flex flex-col gap-2 p-2 bg-surface/50 border border-border rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex flex-1 items-center gap-2 pr-10">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-dim whitespace-nowrap">Ordenar por:</span>
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="flex-1 bg-transparent border-none text-[10px] font-bold uppercase tracking-wider text-primary outline-none cursor-pointer"
                  >
                    <option value="title">Título</option>
                    <option value="composition">Composição</option>
                    <option value="artist">Artista</option>
                    <option value="updatedAt">Modificação</option>
                  </select>
                </div>
                <button 
                  onClick={() => setIsFilterActive(!isFilterActive)}
                  className={`p-1.5 rounded-lg transition-colors ${isFilterActive ? 'bg-primary text-white' : 'text-text-dim hover:bg-surface'}`}
                  title="Filtros"
                >
                  <Filter size={14} />
                </button>
              </div>

              <AnimatePresence>
                {isFilterActive && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="pt-2 border-t border-border/50 space-y-2 overflow-hidden"
                  >
                    <div className="grid grid-cols-1 gap-2">
                      <select 
                        value={filterKey}
                        onChange={(e) => setFilterKey(e.target.value)}
                        className="w-full bg-bg border border-border rounded-lg p-2 text-[10px] font-medium outline-none"
                      >
                        <option value="">Todas as Tonalidades</option>
                        {allKeys.map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                      <select 
                        value={filterTempo}
                        onChange={(e) => setFilterTempo(e.target.value)}
                        className="w-full bg-bg border border-border rounded-lg p-2 text-[10px] font-medium outline-none"
                      >
                        <option value="">Todos os Andamentos</option>
                        <option value="Lento">Lento</option>
                        <option value="Moderado">Moderado</option>
                        <option value="Rápido">Rápido</option>
                      </select>
                      <select 
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="w-full bg-bg border border-border rounded-lg p-2 text-[10px] font-medium outline-none"
                      >
                        <option value="">Todas as Categorias</option>
                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    {(filterKey || filterTempo || filterCategory) && (
                      <button 
                        onClick={() => {
                          setFilterKey('');
                          setFilterTempo('');
                          setFilterCategory('');
                        }}
                        className="w-full py-1.5 text-[9px] font-bold uppercase tracking-widest text-red-500 bg-red-500/5 rounded-lg hover:bg-red-500/10"
                      >
                        Limpar Filtros
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-20">
          {sidebarView === 'tabs' ? (
            <>
          {sidebarTab === 'songs' && (
                <div className="space-y-0">
                  <div className="sticky top-0 z-30 bg-bg pt-2">
                    {isSelectionMode && (
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

                  {/* TODAS Folder */}
                  <div className="mt-2 border border-border/50 rounded-xl overflow-hidden bg-surface/30 mb-2">
                    <button 
                      onClick={() => {
                        setExpandedFolders(prev => 
                          prev.includes('all') ? [] : ['all']
                        );
                      }}
                      className={`w-full flex items-center justify-between p-3.5 transition-colors ${expandedFolders.includes('all') ? 'bg-[#E6ECF5] border-b border-border dark:bg-primary/20' : 'hover:bg-surface'}`}
                    >
                      <div className="flex items-center gap-3">
                        <FolderIcon size={16} fill="currentColor" className="text-text-dim" />
                        <span className="text-xs font-bold uppercase tracking-[0.1em]">TODAS</span>
                        <span className="text-[10px] bg-border px-1.5 py-0.5 rounded text-text-dim font-bold">{filteredSongs.length}</span>
                      </div>
                      <ChevronRight size={16} className={`text-text-dim transition-transform duration-300 ${expandedFolders.includes('all') ? 'rotate-90' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {expandedFolders.includes('all') && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="bg-bg/40"
                        >
                          {filteredSongs.length === 0 ? (
                            <div className="p-4 text-[10px] text-center text-text-dim italic uppercase tracking-widest">Sem músicas</div>
                          ) : (
                            filteredSongs.map(song => (
                              <SongSidebarItem 
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

                  {/* Archive Folders */}
                  <div className="px-2 mb-2">
                    <span className="text-[9px] font-black uppercase text-text-dim/50 tracking-[0.2em] ml-1">Arquivos</span>
                  </div>
                  {folders.filter(f => !f.type || f.type === 'song').map(folder => {
                    const isExpanded = expandedFolders.includes(folder.id!);
                    const folderSongs = filteredSongs.filter(s => s.folderId === folder.id);
                    if (folderSongs.length === 0 && searchTerm) return null;

                    return (
                      <div key={folder.id} className="mt-2 border border-border/50 rounded-xl overflow-hidden bg-surface/30">
                        <button 
                          onClick={() => {
                            setExpandedFolders(prev => 
                              isExpanded ? [] : [folder.id!]
                            );
                          }}
                          className={`w-full flex items-center justify-between p-3.5 transition-colors ${isExpanded ? 'bg-[#E6ECF5] border-b border-border dark:bg-primary/20' : 'hover:bg-surface'}`}
                        >
                          <div className="flex items-center gap-3">
                            <FolderIcon size={16} className={isExpanded ? 'text-primary' : 'text-text-dim'} />
                            <span className="text-xs font-bold uppercase tracking-widest truncate max-w-[140px]">{folder.name}</span>
                            <span className="text-[10px] bg-border px-1.5 py-0.5 rounded text-text-dim font-bold">{folderSongs.length}</span>
                          </div>
                          <ChevronRight size={16} className={`text-text-dim transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                        
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="bg-bg/40"
                            >
                              {folderSongs.length === 0 ? (
                                <div className="p-4 text-[10px] text-center text-text-dim italic uppercase tracking-widest">Pasta Vazia</div>
                              ) : (
                                folderSongs.map(song => (
                                  <SongSidebarItem 
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
                  <div className="px-2 mt-4 mb-1">
                    <span className="text-[9px] font-black uppercase text-text-dim/50 tracking-[0.2em] ml-1">Sem Pasta (Raiz)</span>
                  </div>
                  {filteredSongs.filter(s => !s.folderId).map(song => (
                    <SongSidebarItem 
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
                  <div className="px-2 mb-2">
                    <span className="text-[9px] font-black uppercase text-text-dim/50 tracking-[0.2em] ml-1">Classificadores</span>
                  </div>
                  {folders.filter(f => f.type === 'repertorio').map(folder => {
                    const isExpanded = expandedRepFolders.includes(folder.id!);
                    const folderReps = filteredRepertorios.filter(r => r.folderId === folder.id);
                    if (folderReps.length === 0 && searchTerm) return null;

                    return (
                      <div key={folder.id} className="mt-2 border border-border/50 rounded-xl overflow-hidden bg-surface/30">
                        <button 
                          onClick={() => {
                            setExpandedRepFolders(prev => 
                              isExpanded ? [] : [folder.id!]
                            );
                          }}
                          className={`w-full flex items-center justify-between p-3.5 transition-colors ${isExpanded ? 'bg-[#E6ECF5] border-b border-border dark:bg-primary/20' : 'hover:bg-surface'}`}
                        >
                          <div className="flex items-center gap-3">
                            <FolderIcon size={16} className={isExpanded ? 'text-primary' : 'text-text-dim'} />
                            <span className="text-xs font-bold uppercase tracking-widest truncate max-w-[140px]">{folder.name}</span>
                            <span className="text-[10px] bg-border px-1.5 py-0.5 rounded text-text-dim font-bold">{folderReps.length}</span>
                          </div>
                          <ChevronRight size={16} className={`text-text-dim transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                        
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="bg-bg/40"
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
                                      setSelectedRepertorio(repertorio);
                                      setSidebarView('repertorio-songs');
                                    }}
                                    onDelete={() => deleteRepertorio(repertorio.id)}
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
                  <div className="px-2 mt-4 mb-1">
                    <span className="text-[9px] font-black uppercase text-text-dim/50 tracking-[0.2em] ml-1">Outros</span>
                  </div>
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
                        setSelectedRepertorio(repertorio);
                        setSidebarView('repertorio-songs');
                      }}
                      onDelete={() => deleteRepertorio(repertorio.id)}
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
                <div className="space-y-0 p-2">
                  <button 
                    onClick={() => {
                      setCurrentView('block-form');
                      setIsSidebarOpen(false);
                    }}
                    className="w-full flex items-center gap-2 p-3 text-primary font-bold text-sm hover:bg-surface rounded-lg mb-2"
                  >
                    <Plus size={16} /> Novo Bloco
                  </button>
                  <div className="space-y-1">
                    {songBlocks.map(block => (
                      <button
                        key={block.id}
                        onClick={() => {
                          setSelectedBlockSet(block);
                          setCurrentView('block-details');
                          setIsSidebarOpen(false);
                        }}
                        className={`w-full text-left p-3 rounded-lg transition-all group flex items-center justify-between border ${
                          selectedBlockSet?.id === block.id 
                          ? 'bg-primary/10 border-primary text-primary' 
                          : 'border-transparent text-zinc-400 hover:bg-surface'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-sm truncate uppercase tracking-normal text-black">
                            {block.title}
                          </div>
                          <div className="text-[10px] opacity-70 flex items-center gap-2">
                             <span>{block.suggestions.length} Blocos</span>
                             <span>•</span>
                             <span>{new Date(block.createdAt).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>
                        <ChevronRight size={14} className={`transition-transform ${selectedBlockSet?.id === block.id ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'}`} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {sidebarTab === 'settings' && (
                <div className="flex flex-col h-full bg-surface">
                  <div className="p-6 border-b border-border bg-bg/50">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-text-main">Ajustes & Configurações</h3>
                  </div>
                  <div className="flex-1 py-1">
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
                        className={`w-full text-left px-6 py-4 text-sm font-bold uppercase tracking-widest border-l-4 transition-all flex items-center gap-3 ${
                          currentView === 'settings' && activeSettingsTab === item.id 
                            ? 'bg-primary/10 border-primary text-primary' 
                            : 'border-transparent text-text-dim hover:bg-surface hover:text-text-main'
                        }`}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    ))}
                    <button 
                      onClick={() => setIsLogoutDialogOpen(true)}
                      className="w-full text-left px-6 py-4 text-sm font-bold uppercase tracking-widest border-l-4 border-transparent text-red-500 hover:bg-red-500/10 transition-all flex items-center gap-3"
                    >
                      <LogOut size={18} />
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
                    <h3 className="font-bold text-lg truncate uppercase tracking-tight text-[#0D47A1] leading-none mb-1">
                      {selectedRepertorio?.title} ({selectedRepertorio?.songIds?.filter((id: string) => !id.startsWith('group:')).length || 0})
                    </h3>
                    {selectedRepertorio?.date ? (
                      <p className="text-[10px] text-text-dim uppercase font-bold tracking-[0.2em] mt-1">
                        {new Date(selectedRepertorio.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button 
                      onClick={handleToggleAllGroupsLock}
                      className="p-2 hover:bg-surface rounded-full text-primary transition-all hover:scale-110 active:scale-95"
                      title={selectedRepertorio?.songGroups?.every((g: any) => g.isLocked) ? "Desbloquear Todos" : "Travar Todos"}
                    >
                      {selectedRepertorio?.songGroups?.every((g: any) => g.isLocked) ? <Lock size={20} /> : <LockOpen size={20} className="opacity-40" />}
                    </button>
                    <button 
                      onClick={() => {
                        setSidebarView('tabs');
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
                              onToggleLock={() => handleToggleGroupLock(item.group.id)}
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
                                const isLocked = item.group.isLocked;
                                const confirmMsg = isLocked 
                                  ? 'Este bloco está travado. Excluir o marcador e TODAS as músicas deste bloco?' 
                                  : 'Excluir este marcador de bloco? As músicas não serão excluídas.';
                                
                                if (!window.confirm(confirmMsg)) return;

                                const gid = item.group.id;
                                const groupMarkerId = `group:${gid}`;
                                let newIds = [...selectedRepertorio.songIds];
                                
                                if (isLocked) {
                                  const markerIndex = newIds.indexOf(groupMarkerId);
                                  if (markerIndex !== -1) {
                                    // Encontrar os IDs a serem removidos (o marcador + músicas seguintes até o próximo marcador)
                                    const idsToRemove = [groupMarkerId];
                                    for (let i = markerIndex + 1; i < newIds.length; i++) {
                                      if (newIds[i].startsWith('group:')) break;
                                      idsToRemove.push(newIds[i]);
                                    }
                                    newIds = newIds.filter(id => !idsToRemove.includes(id));
                                  }
                                } else {
                                  // Apenas remove o marcador
                                  newIds = newIds.filter(id => id !== groupMarkerId);
                                }

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
                              isLocked={item.isLocked}
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
                                <div className="text-[10px] text-text-dim font-medium uppercase tracking-widest truncate leading-tight flex-1">
                                  {song.artist?.length > 22 ? song.artist.substring(0, 22) + '...' : song.artist}
                                </div>
                                <div className="text-[12px] text-primary font-bold tracking-tight shrink-0 text-right">
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
                <FolderIcon size={12} /> Mover
              </button>
              <button 
                onClick={handleBatchShare}
                disabled={selectedSongIds.length === 0}
                className="flex-1 flex items-center justify-center gap-1 bg-primary/10 text-primary py-1.5 rounded-xl font-bold text-[9px] uppercase tracking-tighter disabled:opacity-50 border border-primary/20"
              >
                <Share2 size={12} /> Compartilhar
              </button>
              <button 
                onClick={handleBatchDelete}
                disabled={selectedSongIds.length === 0}
                className="flex-1 flex items-center justify-center gap-1 bg-red-500/10 text-red-500 py-1.5 rounded-xl font-bold text-[9px] uppercase tracking-tighter disabled:opacity-50 border border-red-500/20"
              >
                <Trash2 size={12} /> Excluir
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
                    {folders.map(f => (
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
                active={false} 
                variant="light"
                onClick={() => {
                  setEditingSong(null);
                  setCurrentView('form');
                  setIsSidebarOpen(false);
                }} 
              />
              <div className="relative" ref={bottomArchiveRef}>
                <SidebarNavItem 
                  icon={<Hash size={18} />} 
                  label="Arquivo" 
                  active={isSidebarArchiveOpen} 
                  variant="light"
                  onClick={() => setIsSidebarArchiveOpen(!isSidebarArchiveOpen)} 
                />
                <AnimatePresence>
                  {isSidebarArchiveOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-white border border-[#DDE3EC] rounded-xl shadow-2xl z-[300] overflow-hidden"
                    >
                      <button 
                        onClick={() => { handleIndividualImport(); setIsSidebarArchiveOpen(false); setIsSidebarOpen(false); }}
                        className="w-full px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#0D47A1] hover:bg-[#E6ECF5] transition-colors border-b border-[#DDE3EC] flex items-center gap-2"
                      >
                        <Download size={14} /> Importar Música
                      </button>
                      <button 
                        onClick={() => { handleBulkImport(); setIsSidebarArchiveOpen(false); setIsSidebarOpen(false); }}
                        className="w-full px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#0D47A1] hover:bg-[#E6ECF5] transition-colors border-b border-[#DDE3EC] flex items-center gap-2"
                      >
                        <Download size={14} /> Importar Acervo (ZIP)
                      </button>
                      <button 
                        onClick={() => { handleManualExport(); setIsSidebarArchiveOpen(false); if (selectedSongIds.length > 0) setIsSidebarOpen(false); }}
                        className="w-full px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#0D47A1] hover:bg-[#E6ECF5] transition-colors border-b border-[#DDE3EC] flex items-center gap-2"
                      >
                        <Upload size={14} /> Exportar Música
                      </button>
                      <button 
                        onClick={() => { setIsExportFolderModalOpen(true); setIsSidebarArchiveOpen(false); setIsSidebarOpen(false); }}
                        className="w-full px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#0D47A1] hover:bg-[#E6ECF5] transition-colors flex items-center gap-2"
                      >
                        <Upload size={14} /> Exportar Acervo (ZIP)
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <SidebarNavItem 
                icon={<FolderIcon size={18} />} 
                label="Pastas" 
                active={false} 
                variant="light"
                onClick={() => {
                  setManagingFolderType('song');
                  setIsSidebarOpen(false);
                }} 
              />
              <SidebarNavItem 
                icon={expandedFolders.length > 0 ? (isSelectionMode ? <Check size={18} /> : <CheckSquare size={18} />) : <Settings size={18} />} 
                label={expandedFolders.length > 0 ? (isSelectionMode ? "Concluir" : "Selecionar") : "Ajustes"} 
                active={expandedFolders.length > 0 ? isSelectionMode : sidebarTab === 'settings'} 
                variant="light"
                onClick={() => {
                  if (expandedFolders.length > 0) {
                    setIsSelectionMode(!isSelectionMode);
                    if (isSelectionMode) setSelectedSongIds([]);
                  } else {
                    setSidebarTab('settings');
                    setSidebarView('tabs');
                  }
                }} 
              />
            </>
          ) : sidebarTab === 'repertorios' ? (
            <>
              <SidebarNavItem 
                icon={<Plus size={18} />} 
                label="Setlist" 
                active={false} 
                variant="light"
                onClick={() => {
                  const repFolders = folders.filter(f => f.type === 'repertorio');
                  if (repFolders.length === 0) {
                    alert('Por favor, crie uma pasta para repertórios primeiro usando o botão "Pastas".');
                    return;
                  }
                  setIsPickingFolderForNewRep(true);
                  setIsSidebarOpen(false);
                }} 
              />
              <div className="relative">
                <SidebarNavItem 
                  icon={<Hash size={18} />} 
                  label="Arquivo" 
                  active={isSidebarArchiveOpen} 
                  variant="light"
                  onClick={() => setIsSidebarArchiveOpen(!isSidebarArchiveOpen)} 
                />
                <AnimatePresence>
                  {isSidebarArchiveOpen && sidebarTab === 'repertorios' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-white border border-[#DDE3EC] rounded-xl shadow-2xl z-[300] overflow-hidden"
                    >
                      <button 
                        onClick={() => { handleRstImport(); setIsSidebarArchiveOpen(false); }}
                        className="w-full px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#0D47A1] hover:bg-[#E6ECF5] transition-colors border-b border-[#DDE3EC] flex items-center gap-2"
                      >
                        <Download size={14} /> Importar Repertório
                      </button>
                      <button 
                        onClick={() => { handleRstExport(); setIsSidebarArchiveOpen(false); }}
                        className="w-full px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#0D47A1] hover:bg-[#E6ECF5] transition-colors border-b border-[#DDE3EC] flex items-center gap-2"
                      >
                        <Upload size={14} /> Exportar Repertório
                      </button>
                      <button 
                        onClick={() => { handleRepertorioPdfList(); setIsSidebarArchiveOpen(false); }}
                        className="w-full px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#0D47A1] hover:bg-[#E6ECF5] transition-colors border-b border-[#DDE3EC] flex items-center gap-2"
                      >
                        <FileText size={14} /> Exportar Setlist
                      </button>
                      <button 
                        onClick={() => { handleRepertorioPdfFull(); setIsSidebarArchiveOpen(false); }}
                        className="w-full px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-[#0D47A1] hover:bg-[#E6ECF5] transition-colors flex items-center gap-2"
                      >
                        <FileText size={14} /> Exportar Set Musical
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <SidebarNavItem 
                icon={sidebarView === 'repertorio-songs' ? <LayoutList size={18} /> : <FolderIcon size={18} />} 
                label={sidebarView === 'repertorio-songs' ? "Bloco" : "Pastas"} 
                active={false} 
                variant="light"
                onClick={() => {
                  if (sidebarView === 'repertorio-songs') {
                    handleCreateBlock();
                  } else {
                    setManagingFolderType('repertorio');
                    setIsSidebarOpen(false);
                  }
                }} 
              />
              <SidebarNavItem 
                icon={sidebarView === 'repertorio-songs' ? <Edit2 size={18} /> : (isSelectionMode ? <Check size={18} /> : <CheckSquare size={18} />)} 
                label={sidebarView === 'repertorio-songs' ? "Editar" : (isSelectionMode ? "Concluir" : "Selecionar")} 
                active={isSelectionMode && sidebarView !== 'repertorio-songs'} 
                variant="light"
                onClick={() => {
                  if (sidebarView === 'repertorio-songs') {
                    setEditingRepertorio(selectedRepertorio);
                    setCurrentView('repertorio-form');
                    setIsSidebarOpen(false);
                    return;
                  }
                  if (sidebarTab === 'repertorios') {
                    setIsSelectionMode(!isSelectionMode);
                    if (isSelectionMode) setSelectedRepIds([]);
                  }
                }} 
              />
            </>
          ) : sidebarTab === 'blocks' ? (
            <>
              <SidebarNavItem 
                icon={<Plus size={18} />} 
                label="Bloco" 
                active={false} 
                variant="light"
                onClick={() => {
                  setCurrentView('block-form');
                  setIsSidebarOpen(false);
                }} 
              />
              <div className="flex-1" />
              <div className="flex-1" />
              <SidebarNavItem 
                icon={<Settings size={18} />} 
                label="Ajustes" 
                active={sidebarTab === 'settings'} 
                variant="light"
                onClick={() => {
                  setSidebarTab('settings');
                  setSidebarView('tabs');
                }} 
              />
            </>
          ) : (
            <div className="flex justify-around w-full">
              <SidebarNavItem 
                icon={<Music size={18} />} 
                label="Músicas" 
                active={sidebarTab === 'songs'} 
                variant="light"
                onClick={() => {
                  setSidebarTab('songs');
                  setSidebarView('tabs');
                }} 
              />
              <SidebarNavItem 
                icon={<ListMusic size={18} />} 
                label="Repertórios" 
                active={sidebarTab === 'repertorios'} 
                variant="light"
                onClick={() => {
                  setSidebarTab('repertorios');
                  setSidebarView('tabs');
                }} 
              />
              <SidebarNavItem 
                icon={<LayoutList size={18} />} 
                label="Blocos" 
                active={sidebarTab === 'blocks'} 
                variant="light"
                onClick={() => {
                  setSidebarTab('blocks');
                  setSidebarView('tabs');
                  setCurrentView('blocks');
                }} 
              />
              <SidebarNavItem 
                icon={<Settings size={18} />} 
                label="Ajustes" 
                active={sidebarTab === 'settings'} 
                variant="light"
                onClick={() => {
                  setSidebarTab('settings');
                  setSidebarView('tabs');
                }} 
              />
            </div>
          )}
        </nav>
      </motion.aside>

      <div className="w-full max-w-[1000px] bg-bg border-x border-border h-screen flex flex-col relative overflow-hidden">
        {/* Sticky Header Section */}
        <div className="sticky top-0 z-[100] bg-bg/95 backdrop-blur-md border-b border-border transition-colors">
          <header className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 hover:bg-surface rounded-full transition-colors text-primary"
              title="Abrir Menu"
            >
              <Menu size={24} />
            </button>
            <AnimatePresence mode="wait">
              {currentView === 'details' && selectedRepertorio ? (
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
                        <span className="text-[12px] font-black uppercase tracking-[0.25em] text-primary/70 leading-none mb-1">
                          Próxima:
                        </span>
                        <span className="font-black text-xl md:text-2xl uppercase tracking-tighter text-primary truncate max-w-[160px] sm:max-w-[220px] md:max-w-[380px] leading-none">
                          {nextItemTitle} {nextItemKey && <span className="opacity-60 text-lg md:text-xl normal-case">({nextItemKey})</span>}
                        </span>
                      </>
                    );
                  })()}
                </motion.div>
              ) : (
                <motion.div 
                  key="logo-header"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="font-bold text-2xl tracking-tighter uppercase hidden sm:block"
                >
                  #RE<span className="text-primary">SET</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="flex items-center gap-3">
            {currentView === 'details' && selectedSong && (
              <div className="flex items-center gap-2">
                {isMaestro && (
                  <button 
                    onClick={() => {
                      setEditingSong(selectedSong);
                      setCurrentView('form');
                    }}
                    className="p-2 bg-white text-[#0D47A1] border border-[#0D47A1] rounded-full hover:scale-110 active:scale-95 transition-all shadow-md"
                    title="Editar Música"
                  >
                    <Edit2 size={16} />
                  </button>
                )}

                <button 
                  onClick={() => downloadSongFile(selectedSong)}
                  className="p-2 bg-white text-[#0D47A1] border border-[#0D47A1] rounded-full hover:scale-110 active:scale-95 transition-all shadow-md"
                  title="Baixar Música"
                >
                  <Download size={16} />
                </button>

                <button 
                  onClick={() => shareAsPDF([selectedSong], selectedSong.title)}
                  className="p-2 bg-white text-[#0D47A1] border border-[#0D47A1] rounded-full hover:scale-110 active:scale-95 transition-all shadow-md"
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
            )}
          </div>
        </header>

        {/* List Controls (Sticky) */}
        {currentView === 'list' && isMaestro && (
          <div className="px-5 pb-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0D47A1]" size={18} />
                <input 
                  type="text"
                  placeholder="Buscar música, artista..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-[#0D47A1] rounded-xl py-3 pl-10 pr-10 focus:ring-1 focus:ring-[#0D47A1] transition-all outline-none text-[#0D47A1] placeholder:text-[#0D47A1]/50"
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
              {!isMaestro ? (
                // Musician Dashboard
                <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 text-center px-4">
                  <div className="space-y-4">
                    <div className="w-24 h-24 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto shadow-inner">
                      <Mic2 size={48} className={liveSession?.leaderId ? 'animate-pulse' : 'opacity-40'} />
                    </div>
                    <div>
                      <h2 className="text-3xl font-extrabold uppercase tracking-tighter">Modo Músico</h2>
                      <p className="text-text-dim text-sm uppercase tracking-widest font-bold">Aguardando o Maestro</p>
                    </div>
                  </div>

                  <button 
                    onClick={enterStageMode}
                    disabled={!liveSession?.leaderId}
                    className={`w-full max-w-sm py-8 rounded-3xl font-bold text-2xl uppercase tracking-tighter transition-all flex flex-col items-center gap-2 border-4 ${
                      liveSession?.leaderId 
                        ? 'bg-primary border-primary text-white shadow-2xl shadow-primary/40 hover:scale-[1.02] active:scale-[0.95]' 
                        : 'bg-surface border-border text-text-dim opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Play size={28} />
                      Ir Para o Palco
                    </span>
                    {liveSession?.leaderId ? (
                      <span className="text-[10px] font-bold tracking-widest opacity-80 animate-pulse">Maestro {liveSession.leaderName} está Online!</span>
                    ) : (
                      <span className="text-[10px] font-bold tracking-widest opacity-60">Status: Sessão Inativa</span>
                    )}
                  </button>

                  <div className="bg-surface/50 border border-border p-6 rounded-2xl max-w-sm w-full">
                    <p className="text-xs text-text-dim leading-relaxed font-bold uppercase tracking-widest text-center">
                      O botão palco será ativado assim que o maestro iniciar a transmissão.
                    </p>
                  </div>
                </div>
              ) : null}
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

              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 relative z-[60] px-6 md:px-[4.5rem] lg:px-[6.5rem]">
                <div className="space-y-1 flex-1">
                  {!selectedSong.isGroup ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[18px] font-extrabold tracking-tight leading-tight mr-2 uppercase">{selectedSong.title}</h2>
                        
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div 
                            className="cursor-pointer hover:scale-105 transition-transform relative"
                            onClick={() => setIsKeyPickerOpen(!isKeyPickerOpen)}
                          >
                            <span 
                              className="text-[10px] font-bold tracking-[0.1em] px-3 py-1.5 rounded-full bg-[#0D47A1] text-white border border-[#0D47A1] whitespace-nowrap inline-block"
                            >
                              Tom: {currentKey}
                            </span>
                            
                            <AnimatePresence>
                              {isKeyPickerOpen && (
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 10 }}
                                  className="absolute top-full left-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-2xl z-[100] grid grid-cols-3 p-2 gap-1"
                                >
                                  {allKeys.map(k => (
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
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          <span 
                            className="text-[10px] font-bold tracking-[0.1em] px-3 py-1.5 rounded-full text-white whitespace-nowrap"
                            style={{ 
                              backgroundColor: selectedSong.tempo === 'Lento' ? '#698CC2' : selectedSong.tempo === 'Rápido' ? '#0D47A1' : '#527FFF' 
                            }}
                          >
                            {selectedSong.tempo}
                          </span>

                          <span 
                            className="text-[10px] font-bold tracking-[0.1em] px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 whitespace-nowrap"
                          >
                            {selectedSong.category}
                          </span>

                          <div className="flex items-center bg-surface border border-border rounded-full h-[28px] overflow-hidden ml-2 shadow-sm">
                            <button 
                              onClick={() => setChordProScale(prev => Math.max(0.6, prev - 0.1))}
                              className="w-8 h-full flex items-center justify-center hover:bg-primary/10 text-text-dim hover:text-primary transition-colors border-r border-border"
                              title="Diminuir Zoom"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="px-2 text-[10px] font-black text-text-dim min-w-[40px] text-center">
                              {Math.round(chordProScale * 100)}%
                            </span>
                            <button 
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
                              className="w-8 h-full flex items-center justify-center hover:bg-primary/10 text-text-dim hover:text-primary transition-colors border-l border-border"
                              title="Aumentar Zoom"
                            >
                              <Plus size={14} />
                            </button>
                            <button 
                              onClick={() => setChordProScale(1)}
                              className="w-8 h-full flex items-center justify-center hover:bg-primary/10 text-text-dim hover:text-primary transition-colors border-l border-border"
                              title="Resetar Zoom"
                            >
                              <RotateCcw size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-text-dim font-light">
                        {selectedSong.artist}
                        {selectedSong.composition && ` (${selectedSong.composition})`}
                      </p>
                    </>
                  ) : (
                    <div className="h-0" /> 
                  )}
                </div>
                
                <div className="flex items-center gap-2 self-end sm:self-start flex-wrap justify-end">
                </div>
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
                              chordSize={13 * chordProScale}
                              lyricSize={14 * chordProScale}
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
                                  chordSize={13 * chordProScale}
                                  lyricSize={14 * chordProScale}
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
                <div className="space-y-8 max-w-2xl">
                  {/* Perfil Informação Card */}
                  <section className="relative overflow-hidden bg-primary text-white rounded-[32px] p-8 shadow-2xl shadow-primary/30">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <Mic2 size={120} />
                    </div>
                    
                    <div className="relative z-10 space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2.5xl flex items-center justify-center border border-white/30 shadow-lg">
                          {isMaestro ? <UserIcon size={32} /> : <Music size={32} />}
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70 mb-1">Status da Conta</div>
                          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white text-primary rounded-full text-[10px] font-bold uppercase tracking-widest">
                            {appUser?.status === 'active' ? '● Ativo' : '○ Pendente'}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70 mb-1">Perfil Selecionado</div>
                        <h2 className="text-4xl font-bold uppercase tracking-tighter leading-none">{isMaestro ? 'Maestro' : 'Músico'}</h2>
                      </div>

                      <div className="pt-4 border-t border-white/20 grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <div className="text-[8px] font-bold uppercase tracking-widest opacity-60">Nome</div>
                          <div className="text-xs font-bold truncate">{appUser?.displayName}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[8px] font-bold uppercase tracking-widest opacity-60">E-mail</div>
                          <div className="text-xs font-bold truncate">{appUser?.email}</div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-text-dim mb-4">Tema:</h3>
                    <div className="space-y-3">
                      <button 
                        onClick={() => setDarkMode(false)}
                        className="flex items-center gap-4 group"
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${!darkMode ? 'border-primary' : 'border-border'}`}>
                          {!darkMode && <div className="w-2.5 h-2.5 bg-primary rounded-full transition-transform" />}
                        </div>
                        <span className={`text-lg font-bold uppercase transition-colors ${!darkMode ? 'text-primary' : 'text-text-dim group-hover:text-text-main'}`}>Claro</span>
                      </button>
                      <button 
                        onClick={() => setDarkMode(true)}
                        className="flex items-center gap-4 group"
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${darkMode ? 'border-primary' : 'border-border'}`}>
                          {darkMode && <div className="w-2.5 h-2.5 bg-primary rounded-full transition-transform" />}
                        </div>
                        <span className={`text-lg font-bold uppercase transition-colors ${darkMode ? 'text-primary' : 'text-text-dim group-hover:text-text-main'}`}>Escuro</span>
                      </button>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-text-dim mb-4">Qualidade de Importação PDF (Imagem):</h3>
                    <div className="flex gap-2">
                      {(['low', 'medium', 'high'] as PDFQuality[]).map((q) => (
                        <button
                          key={q}
                          onClick={() => {
                            setPdfQuality(q);
                            localStorage.setItem('pdfQuality', q);
                          }}
                          className={`flex-1 py-3 px-4 rounded-xl border-2 font-bold uppercase tracking-widest text-[10px] transition-all ${
                            pdfQuality === q 
                              ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                              : 'bg-surface border-border text-text-dim hover:border-text-dim'
                          }`}
                        >
                          {q === 'low' ? 'Baixa' : q === 'medium' ? 'Média' : 'Alta'}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-text-dim uppercase font-bold tracking-widest">
                      {pdfQuality === 'low' && 'Ideal para economizar espaço e carregar rápido.'}
                      {pdfQuality === 'medium' && 'Equilíbrio ideal entre nitidez e performance.'}
                      {pdfQuality === 'high' && 'Máxima nitidez, recomendado para telas grandes.'}
                    </p>
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
                        <p className="text-text-dim text-sm">O #ReSet usa o Google Gemini para gerar blocos de sugestões.</p>
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
                    <div className="text-5xl font-bold tracking-tighter text-primary">#ReSet</div>
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 hover:bg-surface rounded-full">
                    <Menu size={24} />
                  </button>
                  <h2 className="text-3xl font-bold tracking-tighter uppercase">Meus Blocos (IA)</h2>
                </div>
                {isMaestro && (
                  <button 
                    onClick={() => setCurrentView('block-form')}
                    className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <Plus size={18} /> Novo Bloco
                  </button>
                )}
              </div>
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
                onSave={saveSongBlock}
                onCancel={() => setCurrentView('blocks')}
            />
          )}

          {currentView === 'block-details' && selectedBlockSet && (
            <SongBlockDetails 
                blockSet={selectedBlockSet}
                songs={songs}
                onBack={() => setCurrentView('blocks')}
            />
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
                  {folders.map(folder => (
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
                      className="w-full text-left p-4 bg-surface border border-border rounded-xl hover:border-primary transition-all font-bold text-sm uppercase tracking-tighter"
                    >
                      📁 Sem Pasta (Raiz)
                    </button>
                    {folders.map(folder => (
                      <button 
                        key={folder.id}
                        onClick={() => processBulkImport(folder.id!)}
                        className="w-full text-left p-4 bg-surface border border-border rounded-xl hover:border-primary transition-all font-bold text-sm uppercase tracking-tighter"
                      >
                        📁 {folder.name}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  </div>
);
}

function SongSidebarItem({ song, isSelectionMode, isSelected, onToggleSelect, onClick }: any) {
  return (
    <div className="relative border-b border-border last:border-0 overflow-hidden">
      <motion.button 
        onClick={onClick}
        whileTap={{ scale: 0.98 }}
        className={`w-full text-left p-3.5 rounded-lg hover:bg-surface transition-colors group flex items-center gap-5 ${isSelected ? 'bg-primary/5' : ''}`}
      >
        {isSelectionMode && (
          <div className="text-primary">
            {isSelected ? <CheckSquare size={22} /> : <Square size={22} className="text-border" />}
          </div>
        )}
        <div className="flex-1 min-w-0">
           <div className="font-bold text-sm truncate tracking-normal uppercase leading-none mb-1 text-black">
             {song.title?.length > 22 ? song.title.substring(0, 22) + '...' : song.title}
           </div>
           <div className="flex items-center justify-between gap-3">
             <div className="text-[10px] text-text-dim uppercase font-bold tracking-widest truncate leading-tight flex-1">
               {song.artist?.length > 22 ? song.artist.substring(0, 22) + '...' : song.artist}
             </div>
             <div className="text-[12px] text-primary font-bold shrink-0 text-right">{song.key}</div>
           </div>
         </div>
        {!isSelectionMode && <ChevronLeft size={18} className="rotate-180 text-border group-hover:text-primary" />}
      </motion.button>
    </div>
  );
}

function RepertorioSidebarItem({ 
  repertorio, onClick, onDelete, onShare, isMaestro, 
  isSelectionMode, isSelected, onToggleSelect 
}: any) {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [0, 100], [0, 1]);
  
  const dragLimit = isMaestro ? 120 : 60;

  return (
    <div className="relative overflow-hidden border-b border-border last:border-0">
      <div className="absolute inset-y-0 left-0 flex items-center pl-4 gap-4 bg-primary/10 w-full">
        {isMaestro && (
          <motion.button 
            style={{ opacity }}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-2 bg-red-500 text-white rounded-lg"
          >
            <Trash2 size={16} />
          </motion.button>
        )}
        <motion.button 
          style={{ opacity: isMaestro ? opacity : 1 }}
          onClick={(e) => { e.stopPropagation(); onShare(); }}
          className="p-2 bg-primary text-white rounded-lg translate-x-0"
          animate={{ x: !isMaestro ? 0 : 0 }}
        >
          <Share2 size={16} />
        </motion.button>
      </div>
      
      <motion.div 
        drag={isSelectionMode ? false : "x"}
        dragConstraints={{ left: 0, right: dragLimit }}
        dragElastic={0.1}
        dragDirectionLock
        style={{ x }}
        className="relative bg-bg"
      >
        <motion.button 
          onClick={isSelectionMode ? onToggleSelect : onClick}
          whileTap={{ scale: 0.98 }}
          className="w-full text-left p-3.5 hover:bg-surface transition-colors group flex items-center gap-3"
        >
          {isSelectionMode && (
            <div className={`flex-shrink-0 w-5 h-5 border-2 rounded flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary' : 'border-border'}`}>
              {isSelected && <CheckSquare size={12} className="text-white" />}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate tracking-normal uppercase leading-none mb-1 text-black">{repertorio.title}</div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-dim uppercase font-bold tracking-widest">{repertorio.songIds?.length || 0} Músicas</span>
              {repertorio.date && (
                <>
                  <span className="text-text-dim/30">•</span>
                  <span className="text-[10px] text-primary font-bold uppercase tracking-widest">
                    {new Date(repertorio.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </span>
                </>
              )}
            </div>
          </div>
          {!isSelectionMode && <ChevronLeft size={18} className="rotate-180 text-border group-hover:text-primary" />}
        </motion.button>
      </motion.div>
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
              <div className="text-[10px] text-text-dim font-medium uppercase tracking-widest truncate leading-tight flex-1">
                {song.artist?.length > 22 ? song.artist.substring(0, 22) + '...' : song.artist}
              </div>
              <div className="text-[13px] text-primary font-bold tracking-tight shrink-0 text-right">
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
  onToggleLock,
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
                className="text-xs font-black uppercase tracking-widest text-[#0D47A1] truncate"
              >
                {group.title || `Marcador de Bloco`}
              </h4>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsEditingTitle(true); }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-primary/10 rounded transition-all"
              >
                <Edit2 size={10} className="text-primary" />
              </button>
            </div>
          )}
        </div>
        <div 
          className="flex items-center gap-1"
        >
          <button 
            onClick={(e) => { 
                e.stopPropagation(); 
                onToggleLock && onToggleLock();
            }}
            className={`p-2 rounded-lg transition-colors ${group.isLocked ? 'text-primary bg-primary/10' : 'text-primary/40 hover:bg-primary/5'}`}
            title={group.isLocked ? "Desbloquear Bloco" : "Travar Bloco"}
          >
            {group.isLocked ? <Lock size={20} /> : <LockOpen size={20} />}
          </button>
          <button 
            onClick={(e) => { 
                e.stopPropagation(); 
                onDelete && onDelete();
            }}
            className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
            title="Excluir Marcador"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableSongItem({ id, song, index, onClick, onDelete, onShare, isMaestro, isSelected, onToggleSelect, isInsideGroup, isLastInGroup, isLocked, onUngroup, displayKey }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id,
    disabled: !isMaestro || isLocked
  });

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

function SidebarNavItem({ icon, label, active, onClick, variant = 'dark', disabled = false }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, variant?: 'dark' | 'light', disabled?: boolean }) {
  const activeColor = variant === 'dark' ? 'text-[#E6ECF5]' : 'text-[#0D47A1]';
  const inactiveColor = variant === 'dark' ? 'text-white hover:text-white/80' : 'text-[#0D47A1]/60 hover:text-[#0D47A1]';
  const indicatorColor = variant === 'dark' ? 'bg-[#E6ECF5]' : 'bg-[#0D47A1]';

  return (
    <button 
      onClick={disabled ? undefined : onClick}
      className={`relative flex flex-col items-center gap-1 p-2 transition-all ${active ? activeColor : inactiveColor} ${disabled ? 'opacity-20 cursor-not-allowed grayscale' : ''}`}
    >
      {icon}
      <span className="text-[9px] uppercase font-bold tracking-widest">{label}</span>
      {active && (
        <motion.div 
          layoutId={`sidebar-nav-indicator-${variant}`}
          className={`absolute bottom-0 left-2 right-2 h-0.5 ${indicatorColor} rounded-full`}
        />
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

    // Search
    if (searchTerm) {
      const lowSearch = searchTerm.toLowerCase();
      result = result.filter(s => 
        s.title.toLowerCase().includes(lowSearch) || 
        s.artist.toLowerCase().includes(lowSearch) ||
        s.composition?.toLowerCase().includes(lowSearch)
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0D47A1]" size={14} />
                <input 
                  type="text"
                  placeholder="Pesquisar..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-[#0D47A1] rounded-lg py-2 pl-9 pr-4 text-xs outline-none focus:ring-1 focus:ring-[#0D47A1] text-[#0D47A1] placeholder:text-[#0D47A1]/50"
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

function LabelManager({ labels, onClose, isMaestro }: { labels: LabelShortcut[], onClose: () => void, isMaestro: boolean }) {
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
    if (!window.confirm('Excluir esta label?')) return;
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
          <h3 className="font-bold uppercase tracking-widest text-sm">Gerenciar Marcações (#)</h3>
          <button onClick={onClose} className="p-2 hover:bg-surface rounded-lg"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nova label (ex: PONTE)" className="w-full bg-surface border border-border rounded-xl px-4 py-2 outline-none focus:ring-1 focus:ring-primary uppercase h-[46px]" />
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

function FolderSelectionModal({ folders, type, onSelect, onClose }: { folders: Folder[], type: 'song' | 'repertorio', onSelect: (folderId: string) => void, onClose: () => void }) {
  const relevantFolders = folders.filter(f => type === 'song' ? (!f.type || f.type === 'song') : f.type === 'repertorio');
  const title = type === 'song' ? 'Selecionar Pasta' : 'Selecionar Marcador';
  const subtitle = type === 'song' ? 'Mover música para arquivo' : 'Classificar este repertório';

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
          {relevantFolders.length === 0 && (
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

function FolderManager({ folders, type, onClose }: { folders: Folder[], type: 'song' | 'repertorio', onClose: () => void }) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const title = type === 'song' ? 'Gerenciar Pastas de Músicas' : 'Gerenciar Marcadores de Repertório';
  const placeholder = type === 'song' ? 'Ex: Adoração, Celebração...' : 'Ex: Casamentos, Eventos...';

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
    const itemType = type === 'song' ? 'músicas' : 'repertórios';
    if (!window.confirm(`Excluir esta pasta? (Os ${itemType} dentro dela não serão apagados)`)) return;
    try {
      await deleteDoc(doc(db, 'folders', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'folders');
    }
  };

  const relevantFolders = folders.filter(f => 
    type === 'song' ? (!f.type || f.type === 'song') : f.type === 'repertorio'
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

function SongForm({ initialData, categories, folders, labels, chordBanks, onSave, onCancel, isMaestro }: { 
  initialData?: Partial<Song>, 
  categories: Category[],
  folders: Folder[],
  labels: LabelShortcut[],
  chordBanks: ChordBank[],
  onSave: (data: Partial<Song>) => void,
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
    folderId: initialData?.folderId || ''
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
  const [chordSize, setChordSize] = useState(12);
  const [lyricSize, setLyricSize] = useState(13);
  const [chordColor, setChordColor] = useState('#dc2626');
  const [lyricColor, setLyricColor] = useState('#333333');
  const [isEditorExpanded, setIsEditorExpanded] = useState(true);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(true);
  const editorRef = useRef<HTMLTextAreaElement>(null);

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
      setHistory(prev => [formData.chordPro, ...prev].slice(0, 50));
      setRedoStack([]);
      
      let newKey = formData.key;
      if (!newKey) {
        newKey = detectKey(processedText);
      }
      
      setFormData({ ...formData, chordPro: processedText, key: newKey });
    }
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

  const handleToolbarAction = (label: string) => {
    if (!editorRef.current) return;
    const { selectionStart, selectionEnd } = editorRef.current;
    const currentText = formData.chordPro;
    const selection = currentText.substring(selectionStart, selectionEnd);
    
    let textToInsert = '';
    let newCursorPos = selectionStart;

    if (label === '{DESTAQUE}') {
      textToInsert = `{C:Chorus}\n${selection || 'TRECHO DO REFRÃO'}\n{C:}`;
    } else if (label === '{CÔRO}') {
      textToInsert = `{textfill: yellow}\n${selection || 'TRECHO DO CÔRO'}\n{textfill}`;
    } else {
      // Find color from labels list
      const lb = labels.find(l => `#${l.name}` === label);
      const color = lb ? lb.color : '#gray';
      textToInsert = `\n{textfill: ${color}}\n${label.substring(1)}\n{textfill}\n`;
    }

    const newText = currentText.substring(0, selectionStart) + textToInsert + currentText.substring(selectionEnd);
    updateChordPro(newText);

    setTimeout(() => {
      if (editorRef.current) {
        const nextPos = selectionStart + textToInsert.length;
        editorRef.current.focus();
        editorRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 0);
  };

  const insertChord = (chord: string) => {
    if (!editorRef.current) return;
    const { selectionStart, selectionEnd } = editorRef.current;
    const text = `[${chord}]`;
    const newText = formData.chordPro.substring(0, selectionStart) + text + formData.chordPro.substring(selectionEnd);
    updateChordPro(newText);
    
    setTimeout(() => {
      if (editorRef.current) {
        const nextPos = selectionStart + text.length;
        editorRef.current.focus();
        editorRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 0);
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Shortcuts for Shift + A, B, C, D, E, F, G
    if (e.shiftKey && ['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(e.key.toUpperCase())) {
      e.preventDefault();
      const note = e.key.toUpperCase();
      const bank = chordBanks.find(b => b.note === note);
      
      if (bank && editorRef.current) {
        // Find cursor position for the modal
        const { selectionStart } = editorRef.current;
        const rect = editorRef.current.getBoundingClientRect();
        
        // Modal position: offset from cursor
        // For simplicity, we'll position it near the cursor's approximate line
        // A more precise positioning would require cursor coordinates calculation
        setChordModal({
          isOpen: true,
          note,
          chords: bank.chords,
          position: {
            top: rect.top + 40, 
            left: rect.left + 20
          }
        });
      }
    }
  };

  const toolbarButtons = [
    { label: '{DESTAQUE}', color: 'bg-[#373f4d]', text: 'text-white', tooltip: 'Aplicar negrito à seleção' },
    { label: '{CÔRO}', color: 'bg-[#ffeb3b]', text: 'text-black', tooltip: 'Aplicar realce à seleção' },
    ...labels.map(l => ({ label: `#${l.name}`, color: `bg-[${l.color}]`, text: 'text-black', tooltip: 'Inserir marcação', customColor: l.color })),
  ];

  const isFormValid = formData.title.trim() !== '' && 
                    formData.key !== '' && 
                    formData.tempo !== '' && 
                    formData.category !== '';

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

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* Registration Header - Universal */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-zinc-100 pb-4 mb-2 gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-text-main uppercase tracking-tighter">Editor de Música</h2>
            <p className="text-[10px] font-bold text-text-dim uppercase tracking-widest mt-1">Gerencie cifras e metadados com precisão</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={onCancel}
              className="flex-1 sm:flex-none px-6 h-10 rounded-xl font-bold uppercase tracking-widest text-[11px] bg-white border border-border text-text-dim hover:bg-zinc-50 transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={() => isFormValid && onSave(formData)}
              disabled={!isFormValid}
              className={`flex-1 sm:flex-none px-8 h-10 rounded-xl font-bold uppercase tracking-widest text-[11px] transition-all shadow-sm flex items-center justify-center gap-2 ${
                isFormValid 
                  ? 'bg-primary hover:bg-[#1565c0] text-white' 
                  : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
              }`}
            >
              <Save size={16} />
              Salvar Música
            </button>
          </div>
        </div>

        <div className="space-y-6 lg:h-full lg:flex lg:flex-col lg:overflow-hidden pb-10">
          {/* Top Form Section: Metadados */}
          <div className="space-y-4 flex-shrink-0">
            {/* Metadados: Row 1 & 2 combined for better grid control */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
              {/* Row 1: Title */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-text-dim uppercase tracking-widest flex items-center gap-1.5 ml-1">
                  Título Principal <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-primary transition-colors">
                    <Music2 size={18} />
                  </div>
                  <input 
                    type="text"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full bg-white border border-border rounded-xl h-12 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-bold text-base transition-all placeholder:text-text-dim/30"
                    placeholder="Ex: Hallelujah"
                    required
                  />
                </div>
              </div>

              {/* Row 1: Composition */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-text-dim uppercase tracking-widest flex items-center gap-1.5 ml-1">Composição / Autoria</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-primary transition-colors">
                    <Users size={18} />
                  </div>
                  <input 
                    type="text"
                    value={formData.composition}
                    onChange={e => setFormData({...formData, composition: e.target.value})}
                    className="w-full bg-white border border-border rounded-xl h-12 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-text-dim/30"
                    placeholder="Nomes dos compositores"
                  />
                </div>
              </div>

              {/* Row 2: Artist */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-text-dim uppercase tracking-widest flex items-center gap-1.5 ml-1">Artista / Intérprete</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-primary transition-colors">
                    <Mic2 size={18} />
                  </div>
                  <input 
                    type="text"
                    value={formData.artist}
                    onChange={e => setFormData({...formData, artist: e.target.value})}
                    className="w-full bg-white border border-border rounded-xl h-12 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-text-dim/30"
                    placeholder="Nome do artista principal"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Folder */}
              <div className="space-y-1">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-black text-text-dim uppercase tracking-widest">Pasta de Destino</label>
                  <button 
                    type="button"
                    onClick={() => setIsManagingFolders(true)}
                    className="text-[9px] font-black uppercase text-primary hover:bg-primary/5 px-2 py-0.5 rounded transition-all"
                  >
                    Gerenciar Pastas
                  </button>
                </div>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-primary transition-colors">
                    <FolderOpen size={18} />
                  </div>
                  <select 
                    value={formData.folderId}
                    onChange={e => setFormData({...formData, folderId: e.target.value})}
                    className="w-full bg-white border border-border rounded-xl h-12 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none cursor-pointer transition-all"
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
            </div>


            {/* Row 3: Key, Tempo, Category */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1 relative">
                <label className="text-[10px] font-black text-text-dim uppercase tracking-widest flex items-center gap-1.5 ml-1">
                  Tom <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsKeyPickerOpen(!isKeyPickerOpen)}
                  className="w-full bg-white border border-border rounded-xl h-12 px-4 flex items-center justify-between focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded bg-primary/5 flex items-center justify-center">
                      <Music size={14} className="text-primary" />
                    </div>
                    <span className={`font-black text-lg ${!formData.key ? 'text-text-dim/30' : 'text-text-main'}`}>
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
                              onClick={() => {
                                const semitones = getSemitones(formData.key, k);
                                if (semitones !== 0 && formData.chordPro) {
                                  const transposed = transposeChordPro(formData.chordPro, semitones);
                                  setFormData({ ...formData, key: k, chordPro: transposed });
                                } else {
                                  setFormData({ ...formData, key: k });
                                }
                                setIsKeyPickerOpen(false);
                              }}
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
                              onClick={() => {
                                const semitones = getSemitones(formData.key, k);
                                if (semitones !== 0 && formData.chordPro) {
                                  const transposed = transposeChordPro(formData.chordPro, semitones);
                                  setFormData({ ...formData, key: k, chordPro: transposed });
                                } else {
                                  setFormData({ ...formData, key: k });
                                }
                                setIsKeyPickerOpen(false);
                              }}
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

              <div className="space-y-1">
                <label className="text-[10px] font-black text-text-dim uppercase tracking-widest flex items-center gap-1.5 ml-1">
                  Andamento <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-1 bg-zinc-50 border border-border rounded-xl p-1 h-12">
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

              <div className="space-y-1">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-black text-text-dim uppercase tracking-widest">
                    Categoria <span className="text-red-500">*</span>
                  </label>
                  <button 
                    type="button"
                    onClick={() => setIsManagingCategories(true)}
                    className="text-[9px] font-black uppercase text-primary hover:bg-primary/5 px-2 py-0.5 rounded transition-all"
                  >
                    Ajustar
                  </button>
                </div>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-dim group-focus-within:text-primary transition-colors">
                    <Tag size={18} />
                  </div>
                  <select 
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full bg-white border border-border rounded-xl h-12 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none cursor-pointer transition-all"
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

          {/* TOOLBARS AREA (Full Width) */}
          <div className="flex-shrink-0 space-y-2">
            {/* Row 1: Labels & Formatting - Wraps and Adapts Height */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 shadow-sm">
              <div className="flex flex-wrap gap-2">
                {toolbarButtons.map(btn => (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={() => handleToolbarAction(btn.label)}
                    className={`h-8 px-3 rounded-md text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap shadow-sm flex items-center gap-1 border border-black/5 hover:scale-105 active:scale-95 ${btn.text || (btn.label.startsWith('{') ? 'text-white' : 'text-zinc-900')}`}
                    style={{ backgroundColor: (btn as any).customColor || (btn.label === '{DESTAQUE}' ? '#373f4d' : btn.label === '{CÔRO}' ? '#ffeb3b' : '#eee') }}
                  >
                    {btn.label.replace(/\{|\}|#/g, '')}
                  </button>
                ))}
                <button 
                  onClick={() => setIsManagingLabels(true)}
                  className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-white border border-dashed border-zinc-300 rounded-md text-zinc-400 hover:text-primary hover:border-primary transition-all"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Row 2: Chord Shortcuts */}
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 shadow-sm">
              <div className="flex flex-wrap gap-2">
                {usedChords.length > 0 ? (
                  usedChords.map(chord => (
                    <button
                      key={chord}
                      type="button"
                      onClick={() => insertChord(chord)}
                      className="h-7 px-3 rounded-md bg-white border font-black text-[10px] hover:scale-105 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                      style={{ color: chordColor, borderColor: `${chordColor}20` }}
                    >
                      {chord}
                    </button>
                  ))
                ) : (
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest px-2 py-1">Digite acordes na cifra para exibi-los aqui...</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 lg:overflow-hidden min-h-[400px]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full items-start">
              {/* COLUMN 1: Editor */}
              <div className="flex flex-col bg-white border border-zinc-200 rounded-xl lg:rounded-t-2xl overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-4 h-10 border-b border-zinc-100 bg-white">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsEditorExpanded(!isEditorExpanded)}
                      className="text-zinc-400 hover:text-primary transition-colors"
                    >
                      {isEditorExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Editor de Cifra</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={undo} className="text-zinc-400 hover:text-primary transition-colors"><RotateCcw size={14} /></button>
                    <button onClick={redo} className="text-zinc-400 hover:text-primary transition-colors"><RotateCw size={14} /></button>
                  </div>
                </div>

                {isEditorExpanded && (
                  <>
                    <div className="relative bg-white shadow-inner">
                      <textarea 
                        ref={editorRef}
                        value={formData.chordPro}
                        onChange={e => updateChordPro(e.target.value)}
                        onKeyDown={handleEditorKeyDown}
                        className="w-full bg-white py-6 px-8 font-mono text-[11px] leading-relaxed outline-none resize-none overflow-hidden placeholder:text-zinc-200"
                        placeholder="[C] Digite ou [G] cole sua [Am] cifra aqui..."
                        required
                      />
                    </div>
                    
                    {/* Editor Bottom Actions */}
                    <div className="flex flex-col gap-2 p-3 bg-zinc-50/50 border-t border-zinc-200 border-b-0">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button type="button" onClick={() => setFormData({...formData, title: '', artist: '', composition: '', category: '', tempo: 'Moderado', key: 'C', chordPro: '', folderId: ''})} className="h-10 bg-white border border-zinc-200 rounded-xl text-[10px] font-black uppercase text-zinc-600 hover:bg-zinc-50 transition-all">Novo</button>
                        <button type="button" className="h-10 bg-white border border-zinc-200 rounded-xl text-[10px] font-black uppercase text-zinc-600 hover:bg-zinc-50 transition-all">Importar</button>
                        <button type="button" className="h-10 bg-white border border-zinc-200 rounded-xl text-[10px] font-black uppercase text-zinc-600 hover:bg-zinc-50 transition-all">Exportar</button>
                        <button type="button" onClick={() => updateChordPro(formData.chordPro.replace(/\[[^\]]+\]/g, ''))} className="h-10 bg-white border border-red-100 rounded-xl text-[10px] font-black uppercase text-red-500 hover:bg-red-50 transition-all">Limpar Cifra</button>
                      </div>
                      <button type="button" className="h-10 bg-white border border-zinc-200 rounded-xl text-[10px] font-black uppercase text-zinc-600 hover:bg-zinc-50 transition-all">Restaurar Tom</button>
                    </div>
                  </>
                )}
              </div>
              
              {/* COLUMN 2: Preview */}
              <div className="flex flex-col bg-white border border-zinc-200 rounded-t-2xl overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-4 h-10 border-b border-zinc-100 bg-white">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
                      className="text-zinc-400 hover:text-primary transition-colors"
                    >
                      {isPreviewExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Pré-Visualização</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div 
                      className="flex items-center gap-2 cursor-pointer group" 
                      onClick={() => document.getElementById('chord-color-input')?.click()}
                    >
                       <span className="text-[9px] font-black uppercase text-zinc-400 group-hover:text-zinc-600 transition-colors">Cifras</span>
                       <div className="w-6 h-4 rounded-sm border border-black/5 shadow-sm" style={{ backgroundColor: chordColor }} />
                       <input 
                         id="chord-color-input" 
                         type="color" 
                         value={chordColor} 
                         onChange={(e) => setChordColor(e.target.value)} 
                         className="sr-only" 
                       />
                    </div>
                    <div 
                      className="flex items-center gap-2 cursor-pointer group"
                      onClick={() => document.getElementById('lyric-color-input')?.click()}
                    >
                       <span className="text-[9px] font-black uppercase text-zinc-400 group-hover:text-zinc-600 transition-colors">Letra</span>
                       <div className="w-6 h-4 rounded-sm border border-black/5 shadow-sm" style={{ backgroundColor: lyricColor }} />
                       <input 
                         id="lyric-color-input" 
                         type="color" 
                         value={lyricColor} 
                         onChange={(e) => setLyricColor(e.target.value)} 
                         className="sr-only" 
                       />
                    </div>
                  </div>
                </div>

                {isPreviewExpanded && (
                  <>
                    <div className="bg-white p-8 font-mono text-[10px] leading-relaxed shadow-inner">
                       <div className="mb-6 space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-black text-zinc-900 uppercase">{formData.title || 'Música Sem Nome'}</h4>
                            <span className="text-lg font-black" style={{ color: chordColor }}>({formData.key || '-'})</span>
                          </div>
                          <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                            {formData.artist || 'Artista'} <span className="font-medium lowercase">({formData.composition || 'Compositores'})</span>
                          </div>
                       </div>

                       <ChordProRenderer 
                        text={formData.chordPro} 
                        chordSize={chordSize}
                        lyricSize={lyricSize}
                        chordColor={chordColor}
                        lyricColor={lyricColor}
                      />
                    </div>

                    {/* Preview Bottom Actions */}
                    <div className="flex flex-col gap-2 p-3 bg-zinc-50/50 border-t border-zinc-200">
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={onCancel} 
                          className="h-10 bg-white border border-zinc-200 rounded-xl text-[11px] font-black uppercase text-zinc-600 hover:bg-zinc-50 transition-all"
                        >
                          Cancelar
                        </button>
                        <button 
                          onClick={() => isFormValid && onSave(formData)}
                          disabled={!isFormValid}
                          className={`h-10 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                            isFormValid ? 'bg-primary text-white shadow-lg' : 'bg-zinc-100 text-zinc-400'
                          }`}
                        >
                          <Save size={18} /> Salvar
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
