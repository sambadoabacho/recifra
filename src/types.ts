export interface Song {
  id?: string;
  title: string;
  artist: string;
  composition?: string;
  category: string;
  tempo: string; // Lento, Moderado, Rápido
  key: string;
  chordPro: string;
  createdBy: string;
  updatedAt: string;
  folderId?: string;
  pdfPages?: string[]; // URLs of images for each PDF page
  isGroup?: boolean;
  groupData?: any;
}

export interface Category {
  id?: string;
  name: string;
  createdBy: string;
}

export interface Folder {
  id?: string;
  name: string;
  createdBy: string;
  type?: 'song' | 'repertorio';
  order?: number;
}

export interface LabelShortcut {
  id?: string;
  name: string;
  color: string;
  createdBy: string;
}

export interface Setlist {
  id?: string;
  title: string;
  songIds: string[];
  songKeys?: Record<string, string>; // { [songId]: customKey }
  createdBy: string;
  updatedAt: string;
  date?: string;
  folderId?: string;
  songGroups?: { id: string; songIds: string[]; title?: string }[];
}

export interface Session {
  leaderId: string | null;
  leaderName: string | null;
  currentSongId: string | null;
  updatedAt: string;
}

export interface ChordBank {
  id?: string;
  note: string; // C, D, E, F, G, A, B
  chords: string[];
  createdBy: string;
}

export interface SongBlock {
  id?: string;
  title: string;
  totalSongs: number;
  profile: string;
  maxPerBlock: number;
  filters: string[];
  suggestions: {
    name: string;
    songIds: string[];
    reason?: string;
  }[];
  createdBy: string;
  createdAt: string;
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: 'maestro' | 'musician';
  status: 'active' | 'pending' | 'disabled';
  createdAt: string;
  theme?: 'light' | 'dark';
}
