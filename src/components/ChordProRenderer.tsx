import React from 'react';

interface ChordProRendererProps {
  text: string;
  chordSize?: number;
  lyricSize?: number;
  chordColor?: string;
  lyricColor?: string;
}

type ChordTextChunk = {
  chord: string | null;
  text: string;
  sourceStart?: number;
  chordSourceStart?: number;
};

export const ChordProRenderer: React.FC<ChordProRendererProps & { lineRange?: [number, number] }> = ({
  text,
  chordSize = 13,
  lyricSize = 14,
  chordColor = '#dc2626',
  lyricColor = 'inherit',
  lineRange
}) => {
  // Não usar trim(): os offsets precisam corresponder exatamente ao texto ChordPro original.
  const lines = text.split('\n');
  const lineOffsets: number[] = [];
  let runningOffset = 0;
  lines.forEach(line => {
    lineOffsets.push(runningOffset);
    runningOffset += line.length + 1;
  });

  let isChorus = false;
  let textFillColor: string | null = null;

  return (
    <div className="font-mono chordpro-responsive-content w-full max-w-full min-w-0" style={{ fontSize: `${lyricSize}px`, color: lyricColor, lineHeight: 1.1 }}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        const lineSourceStart = lineOffsets[i];

        let directiveResult: React.ReactNode = null;
        let isDirective = false;

        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          isDirective = true;
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
              directiveResult = (
                <div key={i} data-line-index={i} className="italic text-text-dim my-2 border-l-2 border-primary pl-2 music-line" style={{ fontSize: `${lyricSize * 0.9}px` }}>
                  {value}
                </div>
              );
            }
          }

          if (directive === 'textfill') {
            textFillColor = value === '' ? null : value === 'yellow' ? '#ffff00' : value;
          }
        }

        if (lineRange && (i < lineRange[0] || i > lineRange[1])) {
          return null;
        }

        if (isDirective) return directiveResult;

        const chunks: ChordTextChunk[] = [];
        const regex = /\[([^\]]+)\]/g;
        let match: RegExpExecArray | null;
        let lastLyricEnd = 0;

        while ((match = regex.exec(line)) !== null) {
          if (match.index > lastLyricEnd) {
            const lyricText = line.slice(lastLyricEnd, match.index);
            const lyricSourceStart = lineSourceStart + lastLyricEnd;

            if (chunks.length === 0) {
              chunks.push({ chord: null, text: lyricText, sourceStart: lyricSourceStart });
            } else if (chunks[chunks.length - 1].chord !== null && chunks[chunks.length - 1].text === '') {
              chunks[chunks.length - 1].text = lyricText;
              chunks[chunks.length - 1].sourceStart = lyricSourceStart;
            } else {
              chunks.push({ chord: null, text: lyricText, sourceStart: lyricSourceStart });
            }
          }

          chunks.push({
            chord: match[1],
            text: '',
            chordSourceStart: lineSourceStart + match.index
          });
          lastLyricEnd = regex.lastIndex;
        }

        if (lastLyricEnd < line.length) {
          const finalLyric = line.slice(lastLyricEnd);
          const finalSourceStart = lineSourceStart + lastLyricEnd;

          if (chunks.length > 0 && chunks[chunks.length - 1].text === '') {
            chunks[chunks.length - 1].text = finalLyric;
            chunks[chunks.length - 1].sourceStart = finalSourceStart;
          } else {
            chunks.push({ chord: null, text: finalLyric, sourceStart: finalSourceStart });
          }
        }

        if (chunks.length === 0 && trimmed === '') {
          return <div key={i} data-line-index={i} className="h-[1.1em] music-line" />;
        }

        const isLabel = trimmed === 'BIS' || trimmed === 'REFRÃO' || trimmed === 'TRANSIÇÃO' || trimmed === 'OBSERVAÇÃO' ||
          (textFillColor !== null && chunks.every(c => c.chord === null));
        const hasChords = chunks.some(c => c.chord !== null);
        const hasLyrics = chunks.some(c => c.text && c.text.trim().length > 0);

        return (
          <div
            key={i}
            data-line-index={i}
            className={`flex flex-nowrap whitespace-pre music-line chordpro-responsive-line ${isChorus ? 'font-black' : ''} ${isLabel ? 'font-bold uppercase tracking-wider' : 'mb-[0.1em]'}`}
            data-has-chords={hasChords}
            data-has-lyrics={hasLyrics}
            style={isLabel ? { fontSize: `${lyricSize * 0.9}px`, color: 'var(--color-primary)' } : {}}
          >
            {chunks.map((chunk, j) => {
              const chordLen = chunk.chord ? chunk.chord.length : 0;
              const textLen = chunk.text ? chunk.text.length : 0;
              const widthInChars = Math.max(chordLen, textLen);

              const isLastChunk = j === chunks.length - 1;
              const fullText = chunk.text || (isLastChunk ? '' : ' ');
              const textToHighlight = (textFillColor && !isLabel && isLastChunk) ? fullText.trimEnd() : fullText;
              const trailingSpaces = (textFillColor && !isLabel && isLastChunk) ? fullText.slice(textToHighlight.length) : '';

              return (
                <span key={j} className="inline-flex flex-col align-bottom chordpro-responsive-chunk" style={{ minWidth: widthInChars > 0 ? `${widthInChars}ch` : '0px' }}>
                  {hasChords && (
                    <span
                      className="h-[1.1em] font-black whitespace-pre leading-none"
                      data-source-kind="chord"
                      data-source-start={chunk.chord !== null && chunk.chordSourceStart !== undefined ? chunk.chordSourceStart : undefined}
                      data-source-end={chunk.chord !== null && chunk.chordSourceStart !== undefined ? chunk.chordSourceStart + (chunk.chord?.length || 0) + 2 : undefined}
                      style={{ fontSize: `${chordSize}px`, color: chordColor }}
                    >
                      {chunk.chord || ' '}
                    </span>
                  )}
                  <span
                    className={`whitespace-pre leading-[1.1] chordpro-responsive-lyric ${isLabel ? 'px-2 py-1 rounded font-black tracking-widest text-black' : ''} ${chunk.text ? 'music-lyric-segment' : ''}`}
                    data-source-kind="lyric"
                    data-source-start={chunk.text && chunk.sourceStart !== undefined ? chunk.sourceStart : undefined}
                    data-source-end={chunk.text && chunk.sourceStart !== undefined ? chunk.sourceStart + chunk.text.length : undefined}
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
                            ...((isLastChunk && trailingSpaces === '') || trailingSpaces.length > 0 ? { paddingRight: '4px', borderTopRightRadius: '4px', borderBottomRightRadius: '4px' } : {})
                          }}
                        >
                          {textToHighlight || (isLastChunk ? '' : ' ')}
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
