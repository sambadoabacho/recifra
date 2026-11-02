import React from 'react';

interface ChordProRendererProps {
  text: string;
  chordSize?: number;
  lyricSize?: number;
  chordColor?: string;
  lyricColor?: string;
}

export const ChordProRenderer: React.FC<ChordProRendererProps & { lineRange?: [number, number] }> = ({ 
  text, 
  chordSize = 13, 
  lyricSize = 14, 
  chordColor = '#dc2626', // red-600
  lyricColor = 'inherit',
  lineRange
}) => {
  const lines = text.trim().split('\n');
  
  // State for block directives
  let isChorus = false;
  let textFillColor: string | null = null;

  return (
    <div className="font-mono" style={{ fontSize: `${lyricSize}px`, color: lyricColor, lineHeight: 1.1 }}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        
        let directiveResult: React.ReactNode = null;
        let isDirective = false;

        // Handle Directives
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          isDirective = true;
          const content = trimmed.slice(1, -1);
          const [key, ...valueParts] = content.split(':');
          const directive = key.trim().toLowerCase();
          const value = valueParts.join(':').trim();

          // Chorus
          if (directive === 'c' || directive === 'comment') {
            if (value.toLowerCase() === 'chorus') {
              isChorus = true;
            } else if (value === '') {
              isChorus = false;
            } else {
              // Regular comment if not empty/chorus
              directiveResult = (
                <div key={i} data-line-index={i} className="italic text-text-dim my-2 border-l-2 border-primary pl-2 music-line" style={{ fontSize: `${lyricSize * 0.9}px` }}>
                  {value}
                </div>
              );
            }
          }

          // TextFill
          if (directive === 'textfill') {
            if (value === '') {
              textFillColor = null;
            } else {
              textFillColor = value === 'yellow' ? '#ffff00' : value;
            }
          }
        }

        // Check if we should skip rendering this line but we still processed it for state above
        if (lineRange && (i < lineRange[0] || i > lineRange[1])) {
          return null;
        }

        if (isDirective) return directiveResult;

        // Process line segments into [Chord, Text] pairs
        const chunks: { chord: string | null, text: string }[] = [];
        // ... (rest of the chunks logic remains the same)
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
        
        // Final text
        if (lastLyricEnd < line.length) {
          const finalLyric = line.slice(lastLyricEnd);
          if (chunks.length > 0 && chunks[chunks.length - 1].text === "") {
            chunks[chunks.length - 1].text = finalLyric;
          } else {
            chunks.push({ chord: null, text: finalLyric });
          }
        }

        if (chunks.length === 0 && trimmed === '') {
          return <div key={i} data-line-index={i} className="h-[1.1em] music-line" />;
        }

        const isLabel = trimmed === 'BIS' || trimmed === 'REFRÃO' || trimmed === 'TRANSIÇÃO' || trimmed === 'OBSERVAÇÃO' || (textFillColor !== null && chunks.every(c => c.chord === null));
        const hasChords = chunks.some(c => c.chord !== null);
        const hasLyrics = chunks.some(c => c.text && c.text.trim().length > 0);

        return (
          <div 
            key={i} 
            data-line-index={i}
            className={`flex flex-nowrap music-line ${isChorus ? 'font-black' : ''} ${isLabel ? 'font-bold uppercase tracking-wider' : 'mb-[0.1em]'}`}
            data-has-chords={hasChords}
            data-has-lyrics={hasLyrics}
            style={isLabel ? { fontSize: `${lyricSize * 0.9}px`, color: 'var(--color-primary)' } : {}}
          >
            {chunks.map((chunk, j) => {
               const chordLen = chunk.chord ? chunk.chord.length : 0;
               const textLen = chunk.text ? chunk.text.length : 0;
               const widthInChars = Math.max(chordLen, textLen);
               
               const isLastChunk = j === chunks.length - 1;
               const fullText = chunk.text || (isLastChunk ? "" : " ");
               
               // Logic to stop highlight before trailing spaces on the last chunk
               const textToHighlight = (textFillColor && !isLabel && isLastChunk) ? fullText.trimEnd() : fullText;
               const trailingSpaces = (textFillColor && !isLabel && isLastChunk) ? fullText.slice(textToHighlight.length) : "";

               return (
                  <span key={j} className="inline-flex flex-col align-bottom" style={{ minWidth: widthInChars > 0 ? `${widthInChars}ch` : '0px' }}>
                    {hasChords && (
                       <span 
                         className="h-[1.1em] font-black whitespace-pre leading-none"
                         style={{ fontSize: `${chordSize}px`, color: chordColor }}
                       >
                         {chunk.chord || " "}
                       </span>
                    )}
                    <span 
                        className={`whitespace-pre leading-[1.1] ${isLabel ? 'px-2 py-1 rounded font-black tracking-widest text-black' : ''}`}
                        style={isLabel ? { backgroundColor: textFillColor || '#e5e5e5' } : {}}
                    >
                      {textFillColor && !isLabel ? (
                        <span className="inline-flex">
                          <span 
                            style={{ 
                              backgroundColor: textFillColor, 
                              color: 'black',
                              paddingTop: '1px',
                              paddingBottom: '1px',
                              ...(j === 0 ? { paddingLeft: '4px', borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px' } : {}),
                              ...( (isLastChunk && trailingSpaces === "") || (trailingSpaces.length > 0) ? { paddingRight: '4px', borderTopRightRadius: '4px', borderBottomRightRadius: '4px' } : {})
                            }}
                          >
                            {textToHighlight || (isLastChunk ? "" : " ")}
                          </span>
                          {trailingSpaces}
                        </span>
                      ) : (
                        fullText
                      )}
                    </span>
                  </span>
               );
            })}
          </div>
        );
      })}
    </div>
  );
};
