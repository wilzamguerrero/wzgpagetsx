
import React, { useState, useEffect } from 'react';
import { Board, Language } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Folder, FileText, Database, ChevronRight, ChevronDown, ChevronLeft, 
    Maximize, Minimize, Circle, Home, UserRound
} from 'lucide-react';
import { t } from '../services/i18nService';

interface SidebarProps {
  boards: Board[];
  activeBoardId: string | null;
  onSelectBoard: (id: string | null) => void;
  onGoHome: () => void;
  onCreateBoard: (parentId: string, title: string) => Promise<Board>;
  isOpen: boolean;
  onToggle: () => void;
  columnCount: number;
  onColumnChange: (cols: number) => void;
  language: Language;
  onToggleLanguage: () => void;
  showDatabaseNames: boolean;
}

const MARKER_COLORS = [
    { name: 'None', class: 'bg-white/20 border-white/40', value: '' },
    { name: 'Red', class: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]', value: '#ef4444' },
    { name: 'Green', class: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]', value: '#10b981' },
    { name: 'Blue', class: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]', value: '#3b82f6' },
    { name: 'Amber', class: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]', value: '#fbbf24' },
    { name: 'Purple', class: 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]', value: '#a855f7' },
];

const BoardTreeItem: React.FC<{ 
    board: Board, 
    allBoards: Board[], 
    activeBoardId: string | null,
    onSelect: (id: string) => void, 
    depth: number,
    boardMarkers: Record<string, string>,
    onSetMarker: (id: string, color: string) => void,
    strings: any,
    showDatabaseNames: boolean
}> = ({ board, allBoards, activeBoardId, onSelect, depth, boardMarkers, onSetMarker, strings, showDatabaseNames }) => {
    const children = allBoards.filter(b => b.parentId === board.id);
    const hasKnownChildren = children.length > 0;
    const isActive = activeBoardId === board.id;
    const [isExpanded, setIsExpanded] = useState(false);
    const [isPickingColor, setIsPickingColor] = useState(false);
    
    if (!showDatabaseNames && board.type === 'database') {
        return (
            <>
                {children.map(child => (
                    <BoardTreeItem 
                        key={child.id} 
                        board={child} 
                        allBoards={allBoards} 
                        activeBoardId={activeBoardId} 
                        onSelect={onSelect} 
                        depth={depth} 
                        boardMarkers={boardMarkers} 
                        onSetMarker={onSetMarker}
                        strings={strings}
                        showDatabaseNames={showDatabaseNames}
                    />
                ))}
            </>
        );
    }

    // Solo mostrar chevron si YA tiene hijos cargados (no si potencialmente tiene)
    const showChevron = hasKnownChildren;
    const currentColor = boardMarkers[board.id] || '';
    const activeMarker = MARKER_COLORS.find(c => c.value === currentColor) || MARKER_COLORS[0];

    useEffect(() => {
        if (isActive && hasKnownChildren) {
            setIsExpanded(true);
        }
    }, [isActive, hasKnownChildren]);

    const handleRowClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(board.id);
        if (hasKnownChildren) setIsExpanded(!isExpanded);
    };

    const toggleExpandOnly = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (hasKnownChildren) setIsExpanded(!isExpanded);
    };

    const getIcon = () => {
      // Si tiene icono de Notion, mostrarlo con los colores de la app
      if (board.icon) {
        // Filtros para teñir los iconos
        const activeFilter = 'grayscale(1) brightness(1.2) sepia(1) hue-rotate(100deg) saturate(3)'; // Verde primary
        const inactiveFilter = 'grayscale(1) brightness(1.1) contrast(0.8)'; // Gris/Blanco
        
        // Si es emoji (string corto sin http)
        if (!board.icon.startsWith('http')) {
          return (
            <span 
              className={`text-sm w-4 h-4 flex items-center justify-center shrink-0 transition-all`}
              style={{ filter: isActive ? activeFilter : inactiveFilter }}
            >
              {board.icon}
            </span>
          );
        }
        // Si es URL de imagen
        return (
          <img 
            src={board.icon} 
            alt="" 
            className={`w-4 h-4 rounded shrink-0 object-cover transition-all`}
            style={{ filter: isActive ? activeFilter : inactiveFilter }}
          />
        );
      }
      // Iconos por defecto según tipo
      if (board.type === 'page') return <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'fill-current' : ''}`} />;
      if (board.type === 'database') return <Database className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'fill-current text-primary' : ''}`} />;
      return <Folder className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'fill-current' : ''}`} />;
    };

    return (
        <div className="select-none relative">
            {depth > 0 && (
                <div 
                    className="absolute left-0 top-0 bottom-0 w-[1px] bg-white/5" 
                    style={{ left: `${(depth - 1) * 12 + 18}px` }}
                />
            )}
            
            <div className={`group flex items-center justify-between p-1.5 my-0.5 rounded-lg cursor-pointer transition-all ${isActive ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={handleRowClick}>
                <div className="flex items-center gap-1.5 overflow-hidden flex-1">
                    {/* Solo mostrar chevron si tiene hijos cargados */}
                    {showChevron ? (
                        <button onClick={toggleExpandOnly} className="opacity-70 shrink-0 p-0.5 rounded transition-opacity hover:bg-white/10">
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                    ) : (
                        <div className="w-4.5 h-3.5 shrink-0" />
                    )}
                    {getIcon()}
                    <span className="text-[13px] font-medium truncate leading-none">{board.title}</span>
                </div>
                
                <div className="flex items-center gap-1 relative ml-1">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsPickingColor(!isPickingColor); }} 
                        className={`w-3.5 h-3.5 flex items-center justify-center transition-all ${isPickingColor ? 'opacity-100 scale-110' : (currentColor ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}`}
                    >
                        {currentColor ? <div className={`w-1.5 h-1.5 rounded-full ${activeMarker.class}`} /> : <Circle className="w-2.5 h-2.5 text-gray-600" />}
                    </button>
                    
                    <AnimatePresence>
                        {isPickingColor && (
                            <motion.div 
                                initial={{ opacity: 0, x: 5, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 5, scale: 0.9 }}
                                className="absolute right-full mr-2 z-50 bg-black/95 backdrop-blur-md border border-white/10 p-1 rounded-full flex gap-1 shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {MARKER_COLORS.map((c) => (
                                    <button key={c.name} onClick={() => { onSetMarker(board.id, c.value); setIsPickingColor(false); }}
                                        className={`w-3.5 h-3.5 rounded-full transition-transform hover:scale-125 ${c.class} ${currentColor === c.value ? 'ring-1 ring-white' : ''}`}
                                    />
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
            
            {isExpanded && (
                <div className="relative">
                    {children.map(child => (
                        <BoardTreeItem 
                            key={child.id} 
                            board={child} 
                            allBoards={allBoards} 
                            activeBoardId={activeBoardId} 
                            onSelect={onSelect} 
                            depth={depth + 1} 
                            boardMarkers={boardMarkers} 
                            onSetMarker={onSetMarker}
                            strings={strings}
                            showDatabaseNames={showDatabaseNames}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export const Sidebar: React.FC<SidebarProps> = ({ 
    boards, activeBoardId, onSelectBoard, onGoHome, isOpen, onToggle, 
    columnCount, onColumnChange, language, onToggleLanguage, showDatabaseNames 
}) => {
  const strings = t(language);
  const [boardMarkers, setBoardMarkers] = useState<Record<string, string>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCV, setShowCV] = useState(false);

  // URL del embed de Canva - formato correcto con ?embed
  const CANVA_EMBED_URL = "https://www.canva.com/design/DAG7-GUGdHQ/7AIMi6rsRZATfrWpT7JRAQ/view?embed";

  useEffect(() => {
    const savedMarkers = localStorage.getItem('notio_markers');
    if (savedMarkers) try { setBoardMarkers(JSON.parse(savedMarkers)); } catch (e) {}

    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleSetMarker = (id: string, color: string) => {
    const newMarkers = { ...boardMarkers, [id]: color };
    setBoardMarkers(newMarkers);
    localStorage.setItem('notio_markers', JSON.stringify(newMarkers));
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };

  const getActionBtnClass = (isActive: boolean) => `
    w-9 h-9 bg-white/5 rounded-lg flex items-center justify-center 
    transition-all border border-white/5 
    ${isActive 
      ? 'text-primary border-primary/20 bg-primary/5 shadow-[0_0_10px_rgba(0,255,203,0.1)]' 
      : 'text-gray-500 hover:text-primary hover:border-primary/10 hover:bg-white/10'
    }
  `;

  return (
    <>
      <button onClick={onToggle} className={`fixed top-10 z-50 w-6 h-12 bg-surface border-y border-r border-white/5 rounded-r-xl shadow-lg transition-all ${isOpen ? 'left-[17rem]' : 'left-0 text-primary'}`}>
        {isOpen ? <ChevronLeft className="w-4 h-4 mx-auto" /> : <div className="w-1 h-4 bg-primary mx-auto rounded-full" />}
      </button>
      <div className={`fixed top-4 bottom-4 w-64 bg-surface border border-white/5 flex flex-col z-40 transition-transform shadow-2xl rounded-2xl left-4 ${isOpen ? 'translate-x-0' : '-translate-x-[120%]'}`}>
        <div className="p-4 border-b border-white/5 flex flex-col gap-3">
          <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest px-1">{strings.columns}</span>
          <div className="flex gap-2 justify-center">
            {[1,2,3,4,5,6].map(n => (
              <button key={n} onClick={() => onColumnChange(n)} className={`w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-bold transition-all ${columnCount === n ? 'bg-primary text-black shadow-lg scale-110' : 'bg-white/5 text-gray-500 hover:text-white'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar py-4 px-2">
          <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest px-3 mb-2 block">{strings.boards}</span>
          {boards.filter(b => !b.parentId).map(b => (
            <BoardTreeItem 
                key={b.id} 
                board={b} 
                allBoards={boards} 
                activeBoardId={activeBoardId} 
                onSelect={onSelectBoard} 
                depth={0} 
                boardMarkers={boardMarkers} 
                onSetMarker={handleSetMarker} 
                strings={strings}
                showDatabaseNames={showDatabaseNames}
            />
          ))}
        </div>
        <div className="p-3 border-t border-white/5 bg-black/20">
          <div className="flex flex-wrap justify-center items-center gap-2">
            <button onClick={onToggleLanguage} title={strings.language} className="w-9 h-9 bg-white/5 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all group border border-white/5">
              <span className="text-[10px] font-black text-primary tracking-wider group-hover:scale-110">{language.toUpperCase()}</span>
            </button>

            <button onClick={toggleFullscreen} title="Fullscreen" className={getActionBtnClass(isFullscreen)}>
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>

            <button onClick={() => setShowCV(true)} title="CV" className={getActionBtnClass(showCV)}>
              <UserRound className="w-4 h-4" />
            </button>

            <button onClick={onGoHome} title="Home" className={getActionBtnClass(activeBoardId === null)}>
              <Home className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal CV */}
      <AnimatePresence>
        {showCV && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => setShowCV(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative h-[90vh] bg-black rounded-2xl overflow-hidden shadow-2xl"
              style={{ aspectRatio: '8.5/11' }} // Formato carta US Letter
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="absolute top-0 left-0 right-0 h-10 z-10 flex items-center gap-2 px-4">
                <button 
                  onClick={() => setShowCV(false)}
                  className="w-4 h-4 rounded flex items-center justify-center transition-all text-primary hover:text-primary/70 text-xs"
                >
                  ✕
                </button>
                <span className="text-[10px] text-primary font-black uppercase tracking-[0.2em]">Curriculum Vitae</span>
              </div>
              
              {/* Canva Embed */}
              <iframe
                src={CANVA_EMBED_URL}
                className="w-full h-full border-0 bg-black"
                allowFullScreen
                allow="fullscreen"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};


