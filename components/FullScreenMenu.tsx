import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Home, UserRound, Sparkles, BookOpen, ChevronRight, ArrowLeft,
  ArrowDownWideNarrow, ArrowUpWideNarrow, Send, Maximize, Minimize
} from 'lucide-react';
import { Board, Language } from '../types';
import { extractAccentColor, getCachedAccent } from '../services/accentColor';
import { t } from '../services/i18nService';

interface FullScreenMenuProps {
  isOpen: boolean;
  onClose: () => void;
  boards: Board[];
  activeBoardId: string | null;
  onSelectBoard: (id: string | null) => void;
  onGoHome: () => void;
  showDatabaseNames: boolean;
  accentColor?: string;
  columnCount: number;
  onColumnChange: (cols: number) => void;
  language: Language;
  onToggleLanguage: () => void;
  effectsEnabled: boolean;
  onToggleEffects: () => void;
  descending: boolean;
  onToggleOrder: () => void;
  onOpenContact: () => void;
}

const MONO = "'Space Grotesk', sans-serif";
const ROOT_KEY = '__root__';
const CANVA_EMBED_URL = "https://www.canva.com/design/DAG7-GUGdHQ/7AIMi6rsRZATfrWpT7JRAQ/view?embed";

const isVisibleBoard = (b: Board, showDatabaseNames: boolean): boolean => {
  const starred = b.type === 'database' && b.title.startsWith('*');
  if (b.type === 'database' && !starred && !showDatabaseNames) return false;
  return !!b.title && b.title.trim().length > 0;
};

const cleanTitle = (b: Board): string =>
  b.type === 'database' && b.title.startsWith('*') ? b.title.slice(1) : b.title;

export const FullScreenMenu: React.FC<FullScreenMenuProps> = ({
  isOpen, onClose, boards, activeBoardId, onSelectBoard, onGoHome,
  showDatabaseNames, accentColor = '#00ffcb',
  columnCount, onColumnChange, language, onToggleLanguage,
  effectsEnabled, onToggleEffects, descending, onToggleOrder, onOpenContact,
}) => {
  const strings = t(language);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [accents, setAccents] = useState<Record<string, string>>({});
  const [showCV, setShowCV] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Ruta de navegación (drill-down). Vacío = nivel superior.
  const [path, setPath] = useState<Board[]>([]);
  const menuRestoredRef = useRef(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };

  // Al abrir, limpiar solo el hover (la ruta se conserva para recordar dónde estabas).
  useEffect(() => {
    if (isOpen) setHoveredId(null);
  }, [isOpen]);

  // Restaurar la ruta guardada una vez que los tableros están disponibles.
  useEffect(() => {
    if (menuRestoredRef.current || boards.length === 0) return;
    menuRestoredRef.current = true;
    try {
      const ids: string[] = JSON.parse(localStorage.getItem('menu_path') || '[]');
      if (ids.length) {
        const byId = new Map(boards.map(b => [b.id, b]));
        const restored: Board[] = [];
        for (const id of ids) {
          const b = byId.get(id);
          if (!b) break; // rama ya inexistente: cortar aquí
          restored.push(b);
        }
        if (restored.length) setPath(restored);
      }
    } catch { /* ignorar */ }
  }, [boards]);

  // Persistir la ruta (por IDs) para recordarla al cerrar/reabrir o recargar.
  useEffect(() => {
    try { localStorage.setItem('menu_path', JSON.stringify(path.map(b => b.id))); } catch { /* ignorar */ }
  }, [path]);

  // Escape: retrocede un nivel o cierra; sincroniza pantalla completa.
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setPath(prev => (prev.length > 0 ? prev.slice(0, -1) : (onClose(), prev)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  // Mapa de hijos por parentId (los de nivel superior bajo ROOT_KEY).
  const childrenMap = useMemo(() => {
    const map = new Map<string, Board[]>();
    for (const b of boards) {
      const k = b.parentId || ROOT_KEY;
      const arr = map.get(k) || [];
      arr.push(b);
      map.set(k, arr);
    }
    return map;
  }, [boards]);

  // Hijos visibles de un nivel: aplana las bases de datos ocultas (no starred).
  const visibleChildrenOf = useCallback((parentKey: string): Board[] => {
    const res: Board[] = [];
    for (const c of childrenMap.get(parentKey) || []) {
      const starred = c.type === 'database' && c.title.startsWith('*');
      if (c.type === 'database' && !starred && !showDatabaseNames) {
        res.push(...visibleChildrenOf(c.id));
      } else if (isVisibleBoard(c, showDatabaseNames)) {
        res.push(c);
      }
    }
    return res;
  }, [childrenMap, showDatabaseNames]);

  const hasChildren = useCallback(
    (board: Board): boolean => visibleChildrenOf(board.id).length > 0,
    [visibleChildrenOf]
  );

  const currentParent = path.length > 0 ? path[path.length - 1] : null;
  const currentItems = useMemo(
    () => visibleChildrenOf(currentParent ? currentParent.id : ROOT_KEY),
    [visibleChildrenOf, currentParent]
  );

  // Precalcula los colores de acento de los items visibles del nivel actual.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        currentItems.map(async (b) => {
          const cached = getCachedAccent(b.id);
          if (cached) return [b.id, cached] as const;
          const c = await extractAccentColor(b.icon);
          return [b.id, c] as const;
        })
      );
      if (!cancelled) setAccents(prev => ({ ...prev, ...Object.fromEntries(entries) }));
    })();
    return () => { cancelled = true; };
  }, [isOpen, currentItems]);

  const hoveredBoard = hoveredId ? currentItems.find(b => b.id === hoveredId) : null;
  const hoveredAccent = (hoveredId && accents[hoveredId]) || accentColor;

  const renderIcon = (board: Board, size: number, accent: string) => {
    if (board.icon) {
      if (board.icon.startsWith('http')) {
        return <img src={board.icon} alt="" style={{ width: size, height: size, objectFit: 'contain' }} />;
      }
      return <span style={{ fontSize: size * 0.9, lineHeight: 1 }}>{board.icon}</span>;
    }
    return <span style={{ width: size * 0.35, height: size * 0.35, borderRadius: '50%', background: accent, display: 'inline-block' }} />;
  };

  // Click en una fila: si tiene hijos, entra un nivel; si no, abre su contenido.
  const handleRowClick = (board: Board) => {
    if (hasChildren(board)) {
      setPath(prev => [...prev, board]);
      setHoveredId(null);
    } else {
      onSelectBoard(board.id);
      onClose();
    }
  };

  const goBack = () => setPath(prev => prev.slice(0, -1));

  const actionBtn = (active: boolean) =>
    `w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
      active ? 'text-primary bg-primary/10' : 'text-white/50 hover:text-white hover:bg-white/5'
    }`;

  const levelTitle = currentParent ? cleanTitle(currentParent) : 'Menú';

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[120] text-white flex flex-col"
            style={{
              fontFamily: MONO,
              backgroundColor: 'rgba(16, 16, 16, 0.88)',
            }}
          >
            {/* Preview a pantalla completa: icono grande con el color de acento */}
            <AnimatePresence>
              {hoveredBoard && (
                <motion.div
                  key={hoveredBoard.id}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="pointer-events-none fixed inset-0 flex items-center justify-center"
                >
                  <div
                    className="absolute inset-0"
                    style={{ background: `radial-gradient(circle at 72% 45%, ${hoveredAccent}22, transparent 60%)` }}
                  />
                  <div
                    className="relative flex items-center justify-center rounded-3xl"
                    style={{ width: 340, height: 340, boxShadow: `0 0 120px ${hoveredAccent}55` }}
                  >
                    {renderIcon(hoveredBoard, 200, hoveredAccent)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Barra superior: columnas (izq) + cerrar (der), sin fondo ni borde */}
            <div className="relative z-10 flex items-center justify-between gap-3 px-6 sm:px-10 pt-6">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onColumnChange(0)}
                  title="Modo lectura"
                  className={`h-9 px-3 flex items-center justify-center gap-1.5 rounded-lg text-[11px] font-bold transition-all border ${columnCount === 0 ? 'text-black border-transparent' : 'bg-white/5 text-gray-400 border-white/5 hover:text-white'}`}
                  style={columnCount === 0 ? { backgroundColor: accentColor, boxShadow: `0 4px 16px ${accentColor}55` } : undefined}
                >
                  <BookOpen className="w-3.5 h-3.5" /><span>0</span>
                </button>
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <button
                    key={n}
                    onClick={() => onColumnChange(n)}
                    className={`h-9 w-9 flex items-center justify-center rounded-lg text-[11px] font-bold transition-all ${columnCount === n ? 'bg-primary text-black shadow-lg' : 'bg-white/5 text-gray-500 hover:text-white'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 shrink-0 min-w-0">
                {/* Flecha de retroceso ANTES del breadcrumb */}
                {path.length > 0 && (
                  <button
                    onClick={goBack}
                    className="flex items-center justify-center text-white/70 hover:text-white transition-all shrink-0"
                    aria-label="Volver"
                  >
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                )}
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/40 truncate max-w-[45vw]">
                  <button onClick={() => setPath([])} className="hover:text-white transition-colors">Menú</button>
                  {path.map((p, i) => (
                    <React.Fragment key={p.id}>
                      <ChevronRight className="w-3 h-3 opacity-50 shrink-0" />
                      <button
                        onClick={() => setPath(prev => prev.slice(0, i + 1))}
                        className="hover:text-white transition-colors truncate"
                        style={i === path.length - 1 ? { color: accentColor } : undefined}
                      >
                        {cleanTitle(p)}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
                {/* Espacio extra para no confundir con la X */}
                <button
                  onClick={onClose}
                  className="flex items-center justify-center text-white/70 hover:text-white transition-all ml-8 shrink-0"
                  aria-label="Cerrar menú"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Lista de tableros del nivel actual */}
            <div
              className="relative z-10 flex-1 overflow-y-auto no-scrollbar px-6 sm:px-10 py-6 flex flex-col"
              onMouseLeave={() => setHoveredId(null)}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentParent ? currentParent.id : ROOT_KEY}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full max-w-3xl mx-auto my-auto"
                >
                  {currentItems.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-white/30 text-sm uppercase tracking-widest">
                      Sin elementos
                    </div>
                  ) : (
                    currentItems.map((board) => {
                      const isHovered = hoveredId === board.id;
                      const dimmed = hoveredId !== null && !isHovered;
                      const isActive = activeBoardId === board.id;
                      const accent = accents[board.id] || accentColor;
                      const folder = hasChildren(board);
                      return (
                        <button
                          key={board.id}
                          onClick={() => handleRowClick(board)}
                          onMouseEnter={() => setHoveredId(board.id)}
                          className="group w-full flex items-center gap-3 sm:gap-4 py-3 border-b border-white/10 text-left transition-all duration-300"
                          style={{
                            opacity: dimmed ? 0.25 : 1,
                            color: isHovered || isActive ? accent : '#ffffff',
                          }}
                        >
                          <span className="shrink-0 w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center">
                            {renderIcon(board, 24, accent)}
                          </span>
                          <span
                            className="flex-1 font-bold uppercase leading-none tracking-tight truncate transition-transform duration-300 group-hover:translate-x-2"
                            style={{ fontSize: 'clamp(0.95rem, 2vw, 1.4rem)', letterSpacing: '-0.01em' }}
                          >
                            {cleanTitle(board)}
                          </span>
                          {folder && (
                            <ChevronRight
                              className="shrink-0 w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 group-hover:translate-x-1"
                              style={{ color: isHovered ? accent : 'rgba(255,255,255,0.35)' }}
                            />
                          )}
                        </button>
                      );
                    })
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Barra inferior: acciones (izq) + copyright vertical (der), sin fondo ni borde */}
            <div className="relative z-10 flex items-end justify-between gap-3 px-6 sm:px-10 pb-6">
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={onToggleLanguage} className={actionBtn(false)} title={strings.language}>
                  <span className="text-[10px] font-black text-primary tracking-wider">{language.toUpperCase()}</span>
                </button>
                <button onClick={onToggleEffects} className={actionBtn(effectsEnabled)} title={effectsEnabled ? 'FX On' : 'FX Off'}>
                  <Sparkles className="w-4 h-4" />
                </button>
                <button onClick={onToggleOrder} className={actionBtn(descending)} title={descending ? 'Recientes primero' : 'Antiguos primero'}>
                  {descending ? <ArrowDownWideNarrow className="w-4 h-4" /> : <ArrowUpWideNarrow className="w-4 h-4" />}
                </button>
                <button onClick={toggleFullscreen} className={actionBtn(isFullscreen)} title="Fullscreen">
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
                <button onClick={() => setShowCV(true)} className={actionBtn(showCV)} title="CV">
                  <UserRound className="w-4 h-4" />
                </button>
                <button onClick={() => { onOpenContact(); onClose(); }} className={actionBtn(false)} title="Contacto">
                  <Send className="w-4 h-4" />
                </button>
                <button onClick={() => { onGoHome(); onClose(); }} className={actionBtn(activeBoardId === null)} title="Home">
                  <Home className="w-4 h-4" />
                </button>
              </div>

              {/* Copyright vertical (estilo referencia), base alineada con los botones */}
              <div className="flex gap-1.5 select-none items-end">
                <span
                  className="text-[9px] uppercase tracking-[0.25em] text-white font-medium whitespace-nowrap leading-none"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  WilZamGuerrero Portfolio
                </span>
                <span
                  className="text-[9px] uppercase tracking-[0.25em] text-white font-medium whitespace-nowrap leading-none"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  All Rights Reserved
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal CV */}
      <AnimatePresence>
        {showCV && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => setShowCV(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative h-[90vh] bg-black rounded-2xl overflow-hidden shadow-2xl"
              style={{ aspectRatio: '8.5/11' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 right-0 h-10 z-10 flex items-center gap-2 px-4">
                <button onClick={() => setShowCV(false)} className="w-4 h-4 rounded flex items-center justify-center transition-all text-primary hover:text-primary/70 text-xs">✕</button>
                <span className="text-[10px] text-primary font-black uppercase tracking-[0.2em]">Curriculum Vitae</span>
              </div>
              <iframe src={CANVA_EMBED_URL} className="w-full h-full border-0 bg-black" allowFullScreen allow="fullscreen" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
