/**
 * Utility functions for song processing, casing, and transposition.
 */

export const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function transposeNote(note: string, semitones: number): string {
  const map: Record<string, string> = {
    'Cb': 'B', 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#',
    'B#': 'C', 'E#': 'F'
  };
  const normalized = map[note] || note;
  const index = CHROMATIC_SCALE.indexOf(normalized);
  if (index === -1) return note;
  const newIndex = (index + semitones + 12) % 12;
  return CHROMATIC_SCALE[newIndex];
}

export function transposeChord(chord: string, semitones: number): string {
  let [base, bass] = chord.split('/');
  base = base.replace(/^([A-G][b#]?)/, (match) => transposeNote(match, semitones));
  if (bass) {
    bass = bass.replace(/^([A-G][b#]?)/, (match) => transposeNote(match, semitones));
    return `${base}/${bass}`;
  }
  return base;
}

export function transposeChordPro(text: string, semitones: number): string {
  if (semitones === 0) return text;
  return text.replace(/\[([^\]]+)\]/g, (match, chord) => {
    return `[${transposeChord(chord, semitones)}]`;
  });
}

export function getSemitones(oldKey: string, newKey: string): number {
  const map: Record<string, string> = {
    'Cb': 'B', 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#',
    'B#': 'C', 'E#': 'F'
  };
  const getNote = (k: string) => k.replace(/m$/, '');
  const oldNote = getNote(oldKey);
  const newNote = getNote(newKey);
  
  const normalizedOld = map[oldNote] || oldNote;
  const normalizedNew = map[newNote] || newNote;
  
  const oldIdx = CHROMATIC_SCALE.indexOf(normalizedOld);
  const newIdx = CHROMATIC_SCALE.indexOf(normalizedNew);
  if (oldIdx === -1 || newIdx === -1) return 0;
  return (newIdx - oldIdx + 12) % 12;
}

export function detectKey(text: string): string {
  // Look for the first chord in brackets [G], [Am7], [C#m/E] etc.
  const match = text.match(/\[([A-G][b#]?)([^\]\/]*)(\/[^\]]*)?\]/);
  if (match) {
    const note = match[1];
    const suffix = match[2];
    // Check if it's explicitly minor. Maj7, etc should be Major detection.
    const isMinor = /^(m|min|minor)(?![aj])/.test(suffix.toLowerCase());
    return note + (isMinor ? 'm' : '');
  }
  return '';
}

export function smartUppercase(text: string): string {
  // Phase 1 & 2: Identify and convert ChordOver format internally
  const lines = text.split('\n');
  const processedLines: string[] = [];

  const isChordLineFunc = (l: string) => {
    const w = l.trim().split(/\s+/).filter(word => word.length > 0);
    if (w.length === 0) return false;
    return w.every(word => 
      /^[A-G][b#]?(m|min|maj|dim|aug|sus|add|v|i|iv|vii|alt|maj7|maj9|min7|min9|dim7|7|9|11|13|2|4|5|6)?(\/[A-G][b#]?)?(\d+)?$/.test(word.replace(/[()]/g, ''))
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];

    // If current line is chord line and doesn't have brackets already
    if (isChordLineFunc(line) && !line.includes('[') && !line.includes('{')) {
      const chordMatches: { chord: string; index: number }[] = [];
      const regex = /\S+/g;
      let m;
      while ((m = regex.exec(line)) !== null) {
        chordMatches.push({ chord: m[0], index: m.index });
      }

      if (nextLine !== undefined && !isChordLineFunc(nextLine) && nextLine.trim().length > 0 && !nextLine.includes('[') && !nextLine.includes('{')) {
        let merged = nextLine;
        let offset = 0;
        chordMatches.forEach(cm => {
          const pos = cm.index + offset;
          const chordTag = `[${cm.chord}]`;
          if (pos >= merged.length) {
            merged += ' '.repeat(pos - merged.length) + chordTag;
          } else {
            merged = merged.slice(0, pos) + chordTag + merged.slice(pos);
            offset += chordTag.length;
          }
        });
        processedLines.push(merged);
        i++; // Skip next line
      } else {
        const wrapped = line.replace(/\S+/g, '[$&]');
        processedLines.push(wrapped);
      }
    } else {
      processedLines.push(line);
    }
  }

  return processedLines.map(line => {
    if (line.includes('[') || line.includes('{')) {
      const regex = /([^\[\{]+)|(\[[^\]]*\]|\{[^\}]*\})|(\[[^\]]*$|\{[^\}]*$)/g;
      return line.replace(regex, (match, normal, escape, unclosed) => {
        // We no longer force uppercase here to preserve chord casing
        return normal || escape || unclosed; 
      });
    }
    return line;
  }).join('\n');
}
