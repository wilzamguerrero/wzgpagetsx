
import React, { useRef, useState, useMemo } from 'react';
import { MediaItem, NotionProperty, Language } from '../types';
import { motion } from 'framer-motion';
import { Play, ExternalLink, Code, FileDown, Download, Calendar, Hash, CheckSquare, Tag, Link, Mail, Phone, User, Type, Clock, PenLine, Youtube } from 'lucide-react';
import { TRANSLATIONS } from '../services/i18nService';

// Mapeo de colores de Notion a clases de Tailwind
const notionColorMap: Record<string, string> = {
  default: 'bg-gray-500/20 text-gray-300',
  gray: 'bg-gray-500/20 text-gray-300',
  brown: 'bg-amber-900/30 text-amber-300',
  orange: 'bg-orange-500/20 text-orange-300',
  yellow: 'bg-yellow-500/20 text-yellow-300',
  green: 'bg-emerald-500/20 text-emerald-300',
  blue: 'bg-blue-500/20 text-blue-300',
  purple: 'bg-purple-500/20 text-purple-300',
  pink: 'bg-pink-500/20 text-pink-300',
  red: 'bg-red-500/20 text-red-300',
};

const getPropertyIcon = (type: string) => {
  switch (type) {
    case 'date': return <Calendar className="w-3.5 h-3.5" />;
    case 'created_time': return <Calendar className="w-3.5 h-3.5" />;
    case 'last_edited_time': return <PenLine className="w-3.5 h-3.5" />;
    case 'number': return <Hash className="w-3.5 h-3.5" />;
    case 'checkbox': return <CheckSquare className="w-3.5 h-3.5" />;
    case 'select':
    case 'multi_select': return <Tag className="w-3.5 h-3.5" />;
    case 'status': return <div className="w-2 h-2 rounded-full bg-current" />;
    case 'url': return <Link className="w-3.5 h-3.5" />;
    case 'email': return <Mail className="w-3.5 h-3.5" />;
    case 'phone_number': return <Phone className="w-3.5 h-3.5" />;
    case 'people': return <User className="w-3.5 h-3.5" />;
    case 'rich_text': return <Type className="w-3.5 h-3.5" />;
    default: return <Tag className="w-3.5 h-3.5" />;
  }
};

// Traducir nombre de propiedad según tipo
const getPropertyLabel = (prop: NotionProperty, lang: Language): string => {
  const t = TRANSLATIONS[lang];
  // Para created_time y last_edited_time usamos traducciones específicas
  if (prop.type === 'created_time') return t.propCreated;
  if (prop.type === 'last_edited_time') return t.propEdited;
  // Para otras propiedades, usamos el nombre original de Notion
  return prop.name;
};

const formatDate = (dateStr: string, lang: Language) => {
  try {
    const date = new Date(dateStr);
    const locale = lang === 'es' ? 'es-ES' : 'en-US';
    return date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

const formatDateTime = (dateStr: string, lang: Language) => {
  try {
    const date = new Date(dateStr);
    const locale = lang === 'es' ? 'es-ES' : 'en-US';
    return date.toLocaleDateString(locale, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
};

const PropertiesCard: React.FC<{ properties: NotionProperty[], language: Language }> = ({ properties, language }) => {
  if (!properties || properties.length === 0) return null;
  const t = TRANSLATIONS[language];
  
  return (
    <div className="p-6 bg-gradient-to-br from-surface to-black/40 border-l-4 border-l-primary space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] text-primary font-black uppercase tracking-[0.2em] opacity-80">{t.propDetails}</span>
      </div>
      {properties.map((prop, idx) => (
        <div key={idx} className="flex items-start gap-3">
          <div className="flex items-center gap-2 min-w-[100px] shrink-0">
            <span className="text-primary/70">{getPropertyIcon(prop.type)}</span>
            <span className="text-[11px] text-gray-400 font-medium truncate">{getPropertyLabel(prop, language)}</span>
          </div>
          <div className="flex-1 flex flex-wrap gap-1.5">
            {prop.type === 'multi_select' && Array.isArray(prop.value) ? (
              prop.value.map((tag: { name: string; color: string }, i: number) => (
                <span 
                  key={i} 
                  className={`px-2 py-0.5 rounded text-[11px] font-medium ${notionColorMap[tag.color] || notionColorMap.default}`}
                >
                  {tag.name}
                </span>
              ))
            ) : prop.type === 'select' || prop.type === 'status' ? (
              <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${notionColorMap[prop.color || 'default']}`}>
                {prop.value}
              </span>
            ) : prop.type === 'date' ? (
              <span className="text-[13px] text-white font-medium">{formatDate(prop.value, language)}</span>
            ) : prop.type === 'created_time' || prop.type === 'last_edited_time' ? (
              <span className="text-[12px] text-gray-300 font-medium">{formatDateTime(prop.value, language)}</span>
            ) : prop.type === 'checkbox' ? (
              <span className={`text-[13px] font-medium ${prop.value ? 'text-emerald-400' : 'text-gray-500'}`}>
                {prop.value ? '✓' : '✗'}
              </span>
            ) : prop.type === 'url' ? (
              <a href={prop.value} target="_blank" rel="noopener noreferrer" className="text-[13px] text-primary hover:underline truncate max-w-[200px]">
                {prop.value}
              </a>
            ) : (
              <span className="text-[13px] text-white font-medium">{String(prop.value)}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

interface MediaCardProps {
  item: MediaItem;
  onDragEnd?: (id: string, info: any) => void;
  index?: number;
  language?: Language;
}

export const MediaCard: React.FC<MediaCardProps> = ({ item, onDragEnd, language = 'es' }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const handleMouseEnter = () => {
    if (!isInteracting && videoRef.current && item.type === 'video') {
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    if (!isInteracting && videoRef.current && item.type === 'video') {
      videoRef.current.pause();
      videoRef.current.currentTime = 0; 
    }
  };

  const handleVideoClick = (e: React.MouseEvent) => {
      if (isDragging) return;
      e.stopPropagation();
      e.preventDefault();
      if (videoRef.current) {
          setIsInteracting(true);
          videoRef.current.controls = true;
          videoRef.current.muted = true; 
          videoRef.current.play().catch(() => {});
      }
  };

  const cardWrapperClasses = "group relative w-full rounded-2xl overflow-hidden bg-surface shadow-md border border-black cursor-grab active:cursor-grabbing select-none touch-none transition-colors duration-300 hover:border-white/10";

  const dragConfig = useMemo(() => ({
    drag: true as const,
    dragSnapToOrigin: true,
    dragElastic: 0, 
    dragMomentum: false,
    onDragStart: () => setIsDragging(true),
    onDragEnd: (id: any, info: any) => {
      setTimeout(() => setIsDragging(false), 30);
      if (onDragEnd) onDragEnd(item.id, info);
    },
    whileDrag: { 
      scale: 1.02,
      zIndex: 100,
      boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.8)",
      opacity: 0.98
    },
    transition: { type: "spring" as const, stiffness: 800, damping: 50, mass: 0.3 }
  }), [item.id, onDragEnd]);

  const preventNativeDrag = (e: React.DragEvent | React.MouseEvent) => {
    e.preventDefault();
  };

  const renderContent = () => {
    switch (item.type) {
      case 'title':
        return (
          <div className="p-8 bg-gradient-to-br from-surface to-black/40 border-l-4 border-l-primary flex flex-col justify-end min-h-[160px]">
            {item.metadata?.parentTitle && (
              <span className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mb-2 opacity-80 truncate">
                {item.metadata.parentTitle}
              </span>
            )}
            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight tracking-tighter">
              {item.content}
            </h1>
          </div>
        );
      case 'video':
        return (
          <div className="relative w-full bg-black overflow-hidden flex items-center justify-center min-h-[100px]">
            <div 
                className={`w-full h-auto ${isDragging ? 'pointer-events-none' : ''}`}
                onClick={handleVideoClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {!isLoaded && <div className="absolute inset-0 bg-white/5 animate-pulse z-10" />}
                <video 
                    ref={videoRef}
                    src={item.url} 
                    className={`w-full h-auto object-contain transition-opacity duration-500 block ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoadedData={() => setIsLoaded(true)}
                    muted={true}
                    loop={true}
                    playsInline
                    controls={isInteracting}
                    draggable="false"
                />
                {!isInteracting && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                         <div className={`bg-black/50 p-3 rounded-full backdrop-blur-sm border border-white/10 transition-all duration-300 ${isLoaded ? 'opacity-100 group-hover:scale-110' : 'opacity-0'}`}>
                            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                        </div>
                    </div>
                )}
            </div>
            <div className="absolute bottom-0 left-0 w-full h-1.5 bg-primary transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left z-20" />
            {item.caption && (
                <div className="absolute bottom-0 left-0 w-full p-4 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-gradient-to-t from-black/80 to-transparent pointer-events-none pb-6">
                    <p className="text-white text-xs font-medium line-clamp-2">{item.caption}</p>
                </div>
            )}
          </div>
        );
      case 'youtube':
        const videoId = item.metadata?.videoId || '';
        return (
          <div className="relative w-full bg-black overflow-hidden">
            <div className="relative w-full aspect-video">
              {!isLoaded && (
                <div className="absolute inset-0 bg-zinc-900 animate-pulse flex items-center justify-center">
                  <Youtube className="w-12 h-12 text-red-600/50" />
                </div>
              )}
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?rel=0`}
                title={item.caption || 'YouTube video'}
                className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                onLoad={() => setIsLoaded(true)}
              />
            </div>
            <div className="absolute bottom-0 left-0 w-full h-1.5 bg-red-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left z-20" />
            {item.caption && (
              <div className="p-3 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-red-600 shrink-0" />
                  <p className="text-white text-xs font-medium line-clamp-1">{item.caption}</p>
                </div>
              </div>
            )}
          </div>
        );
      case 'image':
        return (
          <div 
            className={`gallery-item block relative bg-black min-h-[150px] w-full cursor-zoom-in overflow-hidden ${isDragging ? 'pointer-events-none' : ''}`}
            data-src={item.url}
            data-sub-html={item.caption ? `<h4>${item.caption}</h4>` : ''}
            onDragStart={preventNativeDrag}
          >
            {!isLoaded && <div className="absolute inset-0 bg-zinc-900 animate-pulse z-0" />}
            <img
                src={item.url}
                alt={item.caption || ''} 
                onLoad={() => setIsLoaded(true)}
                draggable="false" 
                onDragStart={preventNativeDrag}
                className={`w-full h-auto object-cover transition-all duration-500 ease-in-out select-none ${
                  isLoaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm scale-105'
                }`}
            />
            <div className="absolute bottom-0 left-0 w-full h-1.5 bg-primary transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left z-20" />
            <div className="absolute bottom-0 left-0 w-full p-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 pointer-events-none z-10 mb-1">
                {item.caption && (
                  <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-md inline-block">
                    <p className="text-white text-[10px] font-bold uppercase tracking-wider">{item.caption}</p>
                  </div>
                )}
            </div>
          </div>
        );
      case 'text':
        return <p className="text-gray-200 text-[15px] leading-relaxed whitespace-pre-wrap font-medium p-6">{item.content}</p>;
      case 'file':
        return (
          <div className="p-5 flex items-center gap-4 hover:bg-white/5" onClick={() => !isDragging && window.open(item.url, '_blank')}>
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <FileDown className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm truncate uppercase tracking-tight">{item.metadata?.fileName || 'Archivo'}</p>
              <p className="text-[10px] text-gray-500 font-medium">Click para descargar</p>
            </div>
            <Download className="w-4 h-4 text-gray-500 group-hover:text-primary transition-colors" />
          </div>
        );
      case 'heading':
        const isMain = item.metadata?.level === 1;
        return (
          <div className="p-6 border-l-4 border-l-primary/40">
            <h2 className={`font-bold text-white tracking-tight ${isMain ? 'text-2xl' : 'text-xl'}`}>{item.content}</h2>
          </div>
        );
      case 'code':
        return (
          <>
            <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Code className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">{item.metadata?.language || 'code'}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); if(!isDragging) navigator.clipboard.writeText(item.content || ''); }} className="text-[10px] text-gray-500 hover:text-primary transition-colors uppercase font-bold relative z-10">Copy</button>
            </div>
            <div className="p-4 bg-black/40 overflow-hidden">
                <pre className="text-[13px] font-mono text-emerald-400/90 whitespace-pre-wrap break-words"><code>{item.content}</code></pre>
            </div>
          </>
        );
      case 'link':
        return (
          <div className="p-5 flex flex-col gap-2" onClick={() => !isDragging && window.open(item.url, '_blank')}>
              <div className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-primary group-hover/link:scale-110 transition-transform" />
                  <span className="text-[11px] text-primary/70 font-bold uppercase tracking-widest truncate">Enlace</span>
              </div>
              <p className="text-white font-medium text-[15px] line-clamp-2 leading-snug group-hover/link:text-primary transition-colors">{item.caption || item.url}</p>
              <div className="h-1 w-0 bg-primary group-hover:w-full transition-all duration-500 mt-2" />
          </div>
        );
      case 'properties':
        return <PropertiesCard properties={item.metadata?.properties || []} language={language} />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      layout
      {...dragConfig}
      className={cardWrapperClasses}
    >
      {renderContent()}
    </motion.div>
  );
};
