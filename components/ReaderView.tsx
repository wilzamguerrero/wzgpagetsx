import React, { useMemo } from 'react';
import { MediaItem, NotionProperty, Language } from '../types';
import { ExternalLink, FileDown, Quote as QuoteIcon, MessageSquare } from 'lucide-react';

interface ReaderViewProps {
  items: MediaItem[];
  language: Language;
  accentColor: string;
}

// El color de acento se lee de la variable CSS animada por App, para que el modo
// lector cambie de color con la misma transición suave que el resto de la app.
const ACCENT_VAR = 'var(--reader-accent, #00ffcb)';

// Devuelve el acento con opacidad usando color-mix sobre la variable animada.
// (Ignora el primer argumento; se mantiene la firma para no tocar las llamadas.)
const withAlpha = (_accent: string, alpha: number): string =>
  `color-mix(in srgb, ${ACCENT_VAR} ${Math.round(alpha * 100)}%, transparent)`;

export const ReaderView: React.FC<ReaderViewProps> = ({ items, language }) => {
  const accent = ACCENT_VAR;

  // Numerar las secciones (headings) al estilo motion.dev: 01, 02, 03...
  const rows = useMemo(() => {
    let section = 0;
    return items
      .filter((it) => !(it.type === 'text' && (!it.content || !it.content.trim())))
      .map((it) => {
        if (it.type === 'heading') {
          section += 1;
          return { it, no: section };
        }
        return { it, no: undefined as number | undefined };
      });
  }, [items]);

  const pad = (n: number) => String(n).padStart(2, '0');

  const renderItem = (item: MediaItem, no?: number) => {
    switch (item.type) {
      case 'title':
        return (
          <header className="mb-16">
            <div
              className="font-mono text-[11px] tracking-[0.35em] uppercase mb-5"
              style={{ color: accent }}
            >
              {`// ${item.metadata?.parentTitle || 'index'}`}
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-[1.02] text-white">
              {item.content}
            </h1>
            <div
              className="mt-8 h-px w-full"
              style={{ background: `linear-gradient(90deg, ${accent}, ${withAlpha(accent, 0)})` }}
            />
          </header>
        );

      case 'heading':
        return (
          <div className="mt-16 mb-6 flex items-baseline gap-4">
            {no !== undefined && (
              <span className="font-mono text-sm font-bold shrink-0 tabular-nums" style={{ color: accent }}>
                {pad(no)}
              </span>
            )}
            <h2 className="text-2xl md:text-[28px] font-bold text-white tracking-tight leading-snug">
              {item.content}
            </h2>
          </div>
        );

      case 'text':
        return (
          <p className="text-[17px] md:text-[18px] leading-[1.85] text-gray-300/90 font-light mb-7 max-w-[65ch]">
            {item.content}
          </p>
        );

      case 'bulleted_list':
        return (
          <div className="flex items-start gap-4 mb-3 pl-1">
            <span
              className="mt-[11px] w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: accent }}
            />
            <p className="text-[17px] leading-[1.8] text-gray-300/90 font-light">{item.content}</p>
          </div>
        );

      case 'numbered_list':
        return (
          <div className="flex items-start gap-4 mb-3 pl-1">
            <span
              className="font-mono text-sm font-bold shrink-0 mt-1 tabular-nums"
              style={{ color: accent }}
            >
              {item.metadata?.number ?? '•'}
            </span>
            <p className="text-[17px] leading-[1.8] text-gray-300/90 font-light">{item.content}</p>
          </div>
        );

      case 'todo':
        return (
          <div className="flex items-start gap-4 mb-3 pl-1">
            <span
              className="mt-1 w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 text-[10px] font-bold"
              style={
                item.metadata?.checked
                  ? { backgroundColor: accent, borderColor: accent, color: '#000' }
                  : { borderColor: withAlpha(accent, 0.5), color: 'transparent' }
              }
            >
              {item.metadata?.checked ? '✓' : ''}
            </span>
            <p
              className={`text-[17px] leading-[1.8] font-light ${
                item.metadata?.checked ? 'text-gray-500 line-through' : 'text-gray-300/90'
              }`}
            >
              {item.content}
            </p>
          </div>
        );

      case 'quote':
        return (
          <blockquote
            className="my-8 pl-6 py-1 border-l-2"
            style={{ borderColor: accent }}
          >
            <QuoteIcon className="w-5 h-5 mb-3" style={{ color: accent }} />
            <p className="text-xl md:text-2xl leading-relaxed text-white/90 font-light italic">
              {item.content}
            </p>
          </blockquote>
        );

      case 'callout':
        return (
          <div
            className="my-6 p-5 rounded-xl border-l-2 flex items-start gap-3"
            style={{ borderColor: accent, backgroundColor: withAlpha(accent, 0.06) }}
          >
            {item.metadata?.icon ? (
              item.metadata.icon.startsWith('http') ? (
                <img src={item.metadata.icon} alt="" className="w-6 h-6 shrink-0" />
              ) : (
                <span className="text-xl shrink-0 leading-none">{item.metadata.icon}</span>
              )
            ) : (
              <MessageSquare className="w-5 h-5 shrink-0" style={{ color: accent }} />
            )}
            <p className="text-[16px] leading-[1.7] text-gray-200 font-light">{item.content}</p>
          </div>
        );

      case 'code':
        return (
          <div className="my-8 rounded-xl overflow-hidden border border-white/10 bg-black/50">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
              <span
                className="font-mono text-[10px] uppercase tracking-[0.2em]"
                style={{ color: accent }}
              >
                {item.metadata?.language || 'code'}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(item.content || '')}
                className="font-mono text-[10px] uppercase tracking-wider text-gray-500 hover:text-white transition-colors"
              >
                copy
              </button>
            </div>
            <pre className="p-5 overflow-x-auto text-[13.5px] leading-relaxed font-mono text-gray-200 whitespace-pre-wrap break-words">
              <code>{item.content}</code>
            </pre>
          </div>
        );

      case 'image':
        return (
          <figure className="my-10 -mx-2 md:-mx-8">
            <div
              className="gallery-item block relative overflow-hidden rounded-2xl cursor-zoom-in bg-black"
              data-src={item.url}
              data-sub-html={item.caption ? `<h4>${item.caption}</h4>` : ''}
            >
              <img
                src={item.url}
                alt={item.caption || ''}
                loading="lazy"
                className="w-full h-auto object-contain"
              />
            </div>
            {item.caption && (
              <figcaption className="mt-3 px-1 font-mono text-[11px] tracking-wide text-gray-500 uppercase">
                {item.caption}
              </figcaption>
            )}
          </figure>
        );

      case 'video':
        return (
          <figure className="my-10 -mx-2 md:-mx-8">
            <div className="relative overflow-hidden rounded-2xl bg-black">
              <video src={item.url} controls playsInline className="w-full h-auto" />
            </div>
            {item.caption && (
              <figcaption className="mt-3 px-1 font-mono text-[11px] tracking-wide text-gray-500 uppercase">
                {item.caption}
              </figcaption>
            )}
          </figure>
        );

      case 'youtube':
        return (
          <div className="my-10 -mx-2 md:-mx-8 relative overflow-hidden rounded-2xl bg-black aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${item.metadata?.videoId || ''}?rel=0`}
              title={item.caption || 'YouTube'}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        );

      case 'loom':
        return (
          <div className="my-10 -mx-2 md:-mx-8 relative overflow-hidden rounded-2xl bg-black aspect-video">
            <iframe
              src={`https://www.loom.com/embed/${item.metadata?.videoId || ''}`}
              title={item.caption || 'Loom'}
              className="absolute inset-0 w-full h-full"
              allowFullScreen
            />
          </div>
        );

      case 'canva':
        return (
          <div className="my-10 -mx-2 md:-mx-8 relative overflow-hidden rounded-2xl bg-black aspect-square">
            <iframe
              src={item.url || ''}
              title={item.caption || 'Canva'}
              className="absolute inset-0 w-full h-full"
              allowFullScreen
              allow="fullscreen"
            />
          </div>
        );

      case 'file':
        return (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="my-5 flex items-center gap-4 p-4 rounded-xl border border-white/10 hover:border-white/20 transition-colors group"
          >
            <span
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: withAlpha(accent, 0.12), color: accent }}
            >
              <FileDown className="w-5 h-5" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-white truncate">
                {item.metadata?.fileName || 'Archivo'}
              </span>
              <span className="block font-mono text-[10px] uppercase tracking-wider text-gray-500">
                download
              </span>
            </span>
          </a>
        );

      case 'link':
        return (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="my-4 flex items-center gap-2 text-[16px] font-light group"
            style={{ color: accent }}
          >
            <ExternalLink className="w-4 h-4 shrink-0" />
            <span className="border-b border-transparent group-hover:border-current transition-colors">
              {item.caption || item.url}
            </span>
          </a>
        );

      case 'properties':
        return <ReaderProperties properties={item.metadata?.properties || []} accent={accent} />;

      default:
        return null;
    }
  };

  return (
    <article className="w-full max-w-[760px] mx-auto px-6 md:px-10 py-14 md:py-20">
      {/* Barra superior tipo motion.dev */}
      <div
        className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] mb-12"
        style={{ color: accent }}
      >
        <span>// reader mode</span>
        <span className="flex-1 h-px" style={{ backgroundColor: withAlpha(accent, 0.25) }} />
        <span className="text-gray-600">{pad(rows.length)}</span>
      </div>

      {rows.map(({ it, no }) => (
        <div key={it.id}>{renderItem(it, no)}</div>
      ))}

      {/* Pie decorativo estilo motion.dev */}
      <div
        className="mt-20 pt-6 font-mono text-[10px] tracking-[0.3em] flex items-center gap-3 overflow-hidden"
        style={{ color: withAlpha(accent, 0.5) }}
      >
        <span>+</span>
        <span className="flex-1 truncate select-none">{'/'.repeat(120)}</span>
        <span>+</span>
      </div>
    </article>
  );
};

// Propiedades de página (metadatos) en formato lista mono, sobrio para lectura.
const ReaderProperties: React.FC<{ properties: NotionProperty[]; accent: string }> = ({
  properties,
  accent,
}) => {
  if (!properties || properties.length === 0) return null;

  const render = (prop: NotionProperty) => {
    if (prop.type === 'multi_select' && Array.isArray(prop.value)) {
      return (
        <span className="flex flex-wrap gap-1.5">
          {prop.value.map((tag: { name: string }, i: number) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded text-[11px]"
              style={{ backgroundColor: withAlpha(accent, 0.12), color: accent }}
            >
              {tag.name}
            </span>
          ))}
        </span>
      );
    }
    if (Array.isArray(prop.value)) return <span>{prop.value.map((v: any) => v?.name ?? v).join(', ')}</span>;
    if (typeof prop.value === 'boolean') return <span>{prop.value ? '✓' : '✗'}</span>;
    return <span>{String(prop.value ?? '')}</span>;
  };

  return (
    <div className="my-8 border-y border-white/10 divide-y divide-white/5">
      {properties.map((prop, idx) => (
        <div key={idx} className="flex items-baseline gap-4 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 w-32 shrink-0">
            {prop.name}
          </span>
          <span className="text-[14px] text-gray-200 font-light flex-1">{render(prop)}</span>
        </div>
      ))}
    </div>
  );
};
