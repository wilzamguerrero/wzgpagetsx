import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NotionService, ROOT_PAGE_ID, SHOW_LOGS } from './services/notionService';
import { extractAccentColor, getCachedAccent, setCachedAccent } from './services/accentColor';
import { AppState, Board, MediaItem, NotionProperty } from './types';
import { MasonryGrid } from './components/MasonryGrid';
import { ContactPanel } from './components/ContactPanel';
import { FullScreenMenu } from './components/FullScreenMenu';
import { BackgroundParticles } from './components/BackgroundParticles';
import { t } from './services/i18nService';

const SHOW_DATABASE_NAMES = false; 

// Helpers para animar el color de acento (transición suave de los canales RGB).
const hexToRgbTriple = (hex: string): [number, number, number] => {
  const m = hex.replace('#', '');
  if (m.length !== 6) return [0, 255, 203];
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
};
const toHex2 = (v: number) => Math.round(v).toString(16).padStart(2, '0');
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// Invierte el orden del contenido dejando arriba las tarjetas de cabecera
// (título y propiedades). Sirve para alternar ascendente/descendente.
const reverseContent = (media: MediaItem[]): MediaItem[] => {
  const head: MediaItem[] = [];
  const body: MediaItem[] = [];
  for (const m of media) {
    if ((m.type === 'title' || m.type === 'properties') && body.length === 0) head.push(m);
    else body.push(m);
  }
  return [...head, ...body.reverse()];
};

// Reconstruye un UUID con guiones (8-4-4-4-12) a partir de 32 hex sin guiones.
const toDashedId = (hex: string): string => {
  const c = hex.replace(/-/g, '');
  if (c.length !== 32) return hex;
  return `${c.slice(0, 8)}-${c.slice(8, 12)}-${c.slice(12, 16)}-${c.slice(16, 20)}-${c.slice(20)}`;
};

// Lee el ID de tablero desde el path actual (/<32hex>), o null si no hay.
const readBoardIdFromPath = (): string | null => {
  const raw = window.location.pathname.replace(/^\/+/, '').split(/[/?#]/)[0];
  const clean = raw.replace(/-/g, '');
  return /^[a-f0-9]{32}$/i.test(clean) ? toDashedId(clean) : null;
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    isAuthenticated: true, 
    apiKey: '',
    rootPageId: ROOT_PAGE_ID,
    boards: [], 
    activeBoardId: null, // Siempre empezar en home al hacer refresh
    media: [],
    isLoading: true,
    error: null,
    isDemoMode: false,
    language: 'es',
  });
  
  // Flag para evitar pushState cuando navegamos con popstate
  const isNavigatingRef = useRef(false);
  // ID de tablero pendiente de abrir por deep-link (una vez cargados los tableros)
  const pendingDeepLinkRef = useRef<string | null>(null);

  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // Detectar si es móvil para columnas por defecto
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  // Por defecto: modo lectura (columna 0).
  const [columnCount, setColumnCount] = useState(0);
  const [effectsEnabled, setEffectsEnabled] = useState(true);
  const [accentColor, setAccentColor] = useState('#00ffcb');
  // Orden del contenido. false = orden natural de Notion (por defecto, como estaba);
  // true = recientes primero (invertido).
  const [descending, setDescending] = useState(false);
  const notionServiceRef = useRef<NotionService | null>(null);
  const hasPreloadedRef = useRef(false);
  const accentRafRef = useRef<number | undefined>(undefined);
  const currentAccentRgbRef = useRef<[number, number, number]>([0, 255, 203]);
  
  const strings = t(state.language);

  // Anima el color de acento desde el actual hasta el objetivo (rápido pero suave).
  const animateAccentTo = (targetHex: string) => {
    const [tr, tg, tb] = hexToRgbTriple(targetHex);
    const [sr, sg, sb] = currentAccentRgbRef.current;
    const startTime = performance.now();
    const dur = 320;
    if (accentRafRef.current) cancelAnimationFrame(accentRafRef.current);
    const tick = (now: number) => {
      const e = easeOutCubic(Math.min(1, (now - startTime) / dur));
      const R = Math.round(sr + (tr - sr) * e);
      const G = Math.round(sg + (tg - sg) * e);
      const B = Math.round(sb + (tb - sb) * e);
      currentAccentRgbRef.current = [R, G, B];
      const root = document.documentElement.style;
      root.setProperty('--accent-rgb', `${R} ${G} ${B}`);
      root.setProperty('--reader-accent', `#${toHex2(R)}${toHex2(G)}${toHex2(B)}`);
      if (e < 1) accentRafRef.current = requestAnimationFrame(tick);
    };
    accentRafRef.current = requestAnimationFrame(tick);
  };

  // Actualizar URL sin recargar la página.
  // Ruta limpia: /<id-sin-guiones> para un tablero, o / para el home.
  const updateUrl = useCallback((boardId: string | null) => {
    if (isNavigatingRef.current) return;

    const path = boardId ? `/${NotionService.formatUUID(boardId)}` : '/';
    const selectedBoard = state.boards.find(b => b.id === boardId);
    const title = selectedBoard?.title || 'Portfolio';

    window.history.pushState({ boardId }, title, path);
  }, [state.boards]);

  const autoLoadDatabases = async (service: NotionService, currentBoards: Board[], forceRefresh = false) => {
    if (SHOW_DATABASE_NAMES) return currentBoards;
    // Solo auto-cargar DBs que NO empiezan con * (las starred se muestran en sidebar)
    const dbsToLoad = currentBoards.filter(b => 
      b.type === 'database' && !b.isLoaded && !b.title.startsWith('*')
    );
    if (dbsToLoad.length === 0) return currentBoards;
    try {
      const results = await Promise.all(dbsToLoad.map(db => service.queryDatabase(db.id, forceRefresh)));
      const newSubBoards = results.flat();
      const updatedExisting = currentBoards.map(b => 
        (b.type === 'database' && !b.title.startsWith('*')) ? { ...b, isLoaded: true } : b
      );
      const allBoards = [...updatedExisting, ...newSubBoards];
      // Continuar recursivamente solo con DBs no-starred
      if (newSubBoards.some(b => b.type === 'database' && !b.title.startsWith('*'))) {
        return autoLoadDatabases(service, allBoards, forceRefresh);
      }
      return allBoards;
    } catch (e) {
      return currentBoards;
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignorar si estamos en un input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) return;
      
      // Menú a pantalla completa con 'Z' o 'M'
      if (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'm') {
        setIsMenuOpen(prev => !prev);
        return;
      }
      
      // Toggle effects con 'F'
      if (e.key.toLowerCase() === 'f') {
        setEffectsEnabled(prev => !prev);
        return;
      }
      
      // Cambiar columnas con teclas 0-6 (0 = modo lector)
      const key = e.key;
      if (['0', '1', '2', '3', '4', '5', '6'].includes(key)) {
        e.preventDefault();
        setColumnCount(parseInt(key));
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Color de acento tomado del icono de la página activa en Notion.
  useEffect(() => {
    const id = state.activeBoardId;

    const applyAccent = (color: string) => {
      setAccentColor(color);
      // Recolorea toda la app (clase primary + modo lector) con transición suave.
      animateAccentTo(color);
    };

    // 1) Aplicar al instante el color cacheado (evita el parpadeo al recargar).
    if (id) {
      const cached = getCachedAccent(id);
      if (cached) applyAccent(cached);
    } else {
      applyAccent('#00ffcb');
    }

    // 2) Si hay una página activa pero su board aún no está cargado, NO recalcular
    //    (evita sobrescribir con el verde por defecto mientras carga).
    const activeBoard = state.boards.find(b => b.id === id);
    if (id && !activeBoard) return;

    // 3) Recalcular desde el icono real y guardar en cache.
    let cancelled = false;
    extractAccentColor(activeBoard?.icon).then(color => {
      if (cancelled) return;
      applyAccent(color);
      if (id) setCachedAccent(id, color);
    });
    return () => { cancelled = true; };
  }, [state.activeBoardId, state.boards]);

  const createTitleCard = (title: string, id: string, parentTitle?: string): MediaItem => ({
    id: `title-${id}`,
    type: 'title',
    content: title,
    parentId: id,
    metadata: { parentTitle }
  });

  // Card de propiedades para páginas de base de datos
  const createPropertiesCard = (id: string, properties: NotionProperty[]): MediaItem => ({
    id: `props-${id}`,
    type: 'properties',
    parentId: id,
    metadata: { properties }
  });

  const loadRootContent = async (service: NotionService, forceRefresh = false) => {
    if (SHOW_LOGS) console.log(`[App] Loading root content, forceRefresh: ${forceRefresh}`);
    const blocks = await service.getBlockChildren(ROOT_PAGE_ID, forceRefresh);
    const expanded = await service.getDeepBlockChildren(blocks, forceRefresh);
    const extractedBoards = service.extractBoards(expanded);
    
    // Enriquecer boards con iconos de Notion
    const boardsWithIcons = await service.enrichBoardsWithIcons(extractedBoards);
    
    const finalBoards = await autoLoadDatabases(service, boardsWithIcons, forceRefresh);
    const media = service.extractMedia(expanded, ROOT_PAGE_ID);
    
    if (SHOW_LOGS) console.log(`[App] Loaded ${finalBoards.length} boards, ${media.length} media items`);
    
    const finalMedia = media.length > 0 
      ? [createTitleCard("Galería", ROOT_PAGE_ID), ...media]
      : [];

    return {
      boards: finalBoards,
      media: finalMedia
    };
  };

  useEffect(() => {
    const initApp = async () => {
      if (!ROOT_PAGE_ID) {
        setState(prev => ({ ...prev, isLoading: false, error: 'ROOT_PAGE_ID missing.' }));
        return;
      }
      try {
        const service = new NotionService();
        notionServiceRef.current = service;
        
        // Cargar boards cacheados de localStorage para sidebar instantáneo
        const cachedBoards = localStorage.getItem('cached_sidebar_boards');
        if (cachedBoards) {
          try {
            const parsed = JSON.parse(cachedBoards) as Board[];
            if (parsed.length > 0) {
              setState(prev => ({ ...prev, boards: parsed }));
              if (SHOW_LOGS) console.log(`[App] Loaded ${parsed.length} cached boards for instant sidebar`);
            }
          } catch (e) { /* cache corrupto, ignorar */ }
        }
        
        const { boards } = await loadRootContent(service, true);

        // Fusionar con lo ya presente (cache): conservamos las ramas profundas ya
        // cargadas para que el árbol desplegado NO se pierda al recargar, y
        // actualizamos/incorporamos los tableros de la raíz recién cargados.
        setState(prev => {
          const freshIds = new Set(boards.map(b => b.id));
          const preservedDeep = prev.boards.filter(b => !freshIds.has(b.id));
          const merged = [...boards, ...preservedDeep];
          try { localStorage.setItem('cached_sidebar_boards', JSON.stringify(merged)); } catch (e) {}
          return { ...prev, boards: merged, media: [], isLoading: false, error: null };
        });
        
        // Deep link: si la URL trae un ID de tablero en el path (/<id>), abrirlo.
        // Se difiere a un efecto para que los tableros ya estén en el estado y
        // el título/padre se resuelvan correctamente.
        const deepLinkId = readBoardIdFromPath();
        if (deepLinkId) {
          const clean = NotionService.formatUUID(deepLinkId);
          window.history.replaceState({ boardId: deepLinkId }, '', `/${clean}`);
          pendingDeepLinkRef.current = deepLinkId;
        } else {
          window.history.replaceState({ boardId: null }, 'Portfolio', '/');
        }
        
      } catch (err: any) {
        setState(prev => ({ ...prev, isLoading: false, error: `Error: ${err.message}` }));
      }
    };
    initApp();
  }, []);

  // Precargar todos los sub-boards en background para que el sidebar sea instantáneo
  useEffect(() => {
    if (hasPreloadedRef.current || state.isLoading || state.boards.length === 0 || !notionServiceRef.current) return;
    hasPreloadedRef.current = true;

    const preloadAllBoards = async () => {
      const service = notionServiceRef.current!;
      let allBoards = [...state.boards];
      let maxIterations = 10; // Límite de seguridad

      while (maxIterations-- > 0) {
        const unloaded = allBoards.filter(b => b.hasChildren && !b.isLoaded);
        if (unloaded.length === 0) break;

        try {
          const results = await Promise.allSettled(
            unloaded.map(async (board) => {
              let children: Board[];
              if (board.type === 'database') {
                children = await service.queryDatabase(board.id);
              } else {
                const blocks = await service.getBlockChildren(board.id);
                const deepBlocks = await service.getDeepBlockChildren(blocks);
                children = service.extractBoards(deepBlocks, board.id);
                children = await service.enrichBoardsWithIcons(children);
              }
              return { parentId: board.id, children };
            })
          );

          let newChildren: Board[] = [];
          const loadedParentIds = new Set<string>();

          for (const result of results) {
            if (result.status === 'fulfilled') {
              loadedParentIds.add(result.value.parentId);
              newChildren.push(...result.value.children);
            }
          }

          // Marcar padres como cargados
          allBoards = allBoards.map(b => loadedParentIds.has(b.id) ? { ...b, isLoaded: true } : b);

          // Agregar hijos nuevos (evitar duplicados)
          const existingIds = new Set(allBoards.map(b => b.id));
          const uniqueNew = newChildren.filter(b => !existingIds.has(b.id));
          allBoards = [...allBoards, ...uniqueNew];

          // Auto-cargar databases
          allBoards = await autoLoadDatabases(service, allBoards);

          if (uniqueNew.length === 0) break;
        } catch (e) {
          if (SHOW_LOGS) console.log('[App] Preload error:', e);
          break;
        }
      }

      // Actualizar estado con todos los boards precargados
      setState(prev => {
        const existingIds = new Set(prev.boards.map(b => b.id));
        const newOnes = allBoards.filter(b => !existingIds.has(b.id));
        const loadedMap = new Map(allBoards.filter(b => b.isLoaded).map(b => [b.id, true]));
        const updatedExisting = prev.boards.map(b => loadedMap.has(b.id) ? { ...b, isLoaded: true } : b);
        const finalBoards = [...updatedExisting, ...newOnes];
        
        // Actualizar cache de localStorage con el árbol completo
        try { localStorage.setItem('cached_sidebar_boards', JSON.stringify(finalBoards)); } catch (e) {}
        
        if (SHOW_LOGS) console.log(`[App] Preloaded complete tree: ${finalBoards.length} total boards`);
        return { ...prev, boards: finalBoards };
      });
    };

    preloadAllBoards();
  }, [state.isLoading, state.boards.length]);

  // Escuchar navegación con flechas del navegador (back/forward)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const boardId = event.state?.boardId ?? null;
      isNavigatingRef.current = true;
      
      if (boardId === null) {
        // Ir a home
        handleGoHome();
        isNavigatingRef.current = false;
      } else {
        // Ir al board específico
        handleSelectBoard(boardId, false).finally(() => {
          isNavigatingRef.current = false;
        });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [state.boards]);

  // Ejecuta el deep-link pendiente una vez que los tableros están cargados.
  useEffect(() => {
    if (pendingDeepLinkRef.current && state.boards.length > 0) {
      const id = pendingDeepLinkRef.current;
      pendingDeepLinkRef.current = null;
      isNavigatingRef.current = true; // no volver a hacer pushState
      handleSelectBoard(id, true).finally(() => { isNavigatingRef.current = false; });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.boards]);

  const handleSelectBoard = async (boardId: string | null, forceRefresh = true) => {
    const targetId = boardId || state.rootPageId;
    const selectedBoard = state.boards.find(b => b.id === boardId);
    const boardTitle = selectedBoard?.title || "Galería";
    
    // Función para encontrar el padre visible (saltando databases si SHOW_DATABASE_NAMES = false, excepto las que empiezan con *)
    const findVisibleParent = (board: Board | undefined): string | undefined => {
      if (!board || !board.parentId || board.parentId === state.rootPageId) {
        return undefined;
      }
      const parentBoard = state.boards.find(b => b.id === board.parentId);
      if (!parentBoard) return undefined;
      
      // Las DBs que empiezan con * siempre son visibles
      const isStarredDatabase = parentBoard.type === 'database' && parentBoard.title.startsWith('*');
      
      // Si no mostramos nombres de DB y el padre es una database (y no es starred), buscar el abuelo
      if (!SHOW_DATABASE_NAMES && parentBoard.type === 'database' && !isStarredDatabase) {
        return findVisibleParent(parentBoard);
      }
      
      // Quitar el asterisco del título si es una starred database
      return isStarredDatabase ? parentBoard.title.slice(1) : parentBoard.title;
    };
    
    const parentTitle = findVisibleParent(selectedBoard);

    setState(prev => ({ ...prev, activeBoardId: boardId, isLoading: true, error: null }));
    if (!notionServiceRef.current) return;
    
    try {
      const service = notionServiceRef.current;
      
      if (forceRefresh) {
        service.invalidateBlock(targetId);
      }
      
      let newMedia: MediaItem[] = [];
      let newSubBoards: Board[] = [];

      if (selectedBoard?.type === 'database') {
        newSubBoards = await service.queryDatabase(targetId, forceRefresh);
        newMedia = [];
      } else {
        const blocks = await service.getBlockChildren(targetId, forceRefresh);
        if (SHOW_LOGS) console.log(`[App] Got ${blocks.length} blocks for board ${boardTitle}`);
        const allBlocks = await service.getDeepBlockChildren(blocks, forceRefresh);
        newMedia = service.extractMedia(allBlocks, targetId);
        newSubBoards = service.extractBoards(allBlocks, targetId);
        if (SHOW_LOGS) console.log(`[App] Extracted ${newMedia.length} media items`);
      }
      
      const processedSubBoards = await autoLoadDatabases(service, newSubBoards, forceRefresh);
      
      // Construir media final con título y propiedades si es página de DB
      const mediaItems: MediaItem[] = [];
      
      // Solo mostrar título y contenido si hay media real (imágenes, videos, texto CON contenido, etc.)
      // Filtrar elementos vacíos (párrafos vacíos de Notion)
      const realMedia = newMedia.filter(m => {
        // Si es texto, debe tener contenido no vacío
        if (m.type === 'text') return m.content && m.content.trim().length > 0;
        // Otros tipos (imagen, video, etc.) siempre cuentan
        return true;
      });
      
      const hasRealContent = realMedia.length > 0;
      
      if (hasRealContent) {
        mediaItems.push(createTitleCard(boardTitle, targetId, parentTitle));
        // Agregar card de propiedades si la página tiene propiedades (viene de DB)
        if (selectedBoard?.properties && selectedBoard.properties.length > 0) {
          mediaItems.push(createPropertiesCard(targetId, selectedBoard.properties));
        }
        mediaItems.push(...newMedia);
      }
      // Si no hay media real, mediaItems queda vacío y MasonryGrid mostrará el home
      // Notion devuelve el contenido en orden ascendente (más antiguo primero);
      // si el modo es descendente, invertimos (recientes arriba).
      const finalMedia = descending ? reverseContent(mediaItems) : mediaItems;

      setState(prev => {
          const existingIds = new Set(prev.boards.map(b => b.id));
          const filteredNewBoards = processedSubBoards.filter(b => !existingIds.has(b.id));
          const updatedBoards = prev.boards.map(b => 
            b.id === targetId ? { ...b, isLoaded: true } : b
          );

          return {
              ...prev,
              boards: [...updatedBoards, ...filteredNewBoards],
              media: finalMedia,
              isLoading: false
          };
      });
      
      // Actualizar URL para navegación con historial
      updateUrl(boardId);
    } catch (err: any) {
      setState(prev => ({ ...prev, isLoading: false, error: 'Failed to load content.' }));
    }
  };

  const handleGoHome = async () => {
    // Home muestra el logo y frases, sin media
    setState(prev => ({ ...prev, activeBoardId: null, media: [], isLoading: false }));
    
    // Actualizar URL para navegación con historial
    updateUrl(null);
  };

  const handleReorder = (newMedia: MediaItem[]) => {
    setState(prev => ({ ...prev, media: newMedia }));
  };

  // Alterna orden ascendente/descendente sin recargar: invierte el contenido actual.
  const handleToggleOrder = () => {
    setDescending(prev => !prev);
    setState(prev => ({ ...prev, media: reverseContent(prev.media) }));
  };

  // Icono de la página activa para las partículas de fondo.
  const activeIcon = state.boards.find(b => b.id === state.activeBoardId)?.icon;

  return (
    <div className="min-h-screen bg-background text-white flex overflow-x-hidden">
      {/* Iconos flotantes de fondo (usa el icono de la página actual), fondo plano */}
      <BackgroundParticles icon={activeIcon} />

      {/* Botón flotante para abrir el menú a pantalla completa */}
      <div className="fixed top-10 left-0 z-50 group/menu-toggle">
        <button onClick={() => setIsMenuOpen(true)} className="w-6 h-12 bg-surface border-y border-r border-white/5 rounded-r-xl shadow-lg transition-all text-primary flex items-center justify-center">
          <div className="w-1 h-4 bg-primary mx-auto rounded-full" />
        </button>
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-surface border border-white/10 rounded-lg opacity-0 group-hover/menu-toggle:opacity-100 transition-opacity pointer-events-none whitespace-nowrap flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400">Menu</span>
          <span className="text-[9px] text-primary font-bold bg-white/10 px-1.5 py-0.5 rounded">Z</span>
        </div>
      </div>

      <main className="relative z-10 flex-1 flex flex-col min-w-0">
        {state.error && (
            <div className="mx-auto mt-10 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 max-w-2xl text-center">
                <p className="font-bold">{strings.errorTitle}</p>
                <p className="text-sm">{state.error}</p>
                <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg text-xs font-bold">{strings.retry}</button>
            </div>
        )}
        <div className="w-full p-2 lg:p-4">
          <MasonryGrid 
            items={state.media} 
            isLoading={state.isLoading} 
            columnCount={columnCount} 
            language={state.language} 
            onReorder={handleReorder}
            isSidebarOpen={false}
            isMenuOpen={isMenuOpen}
            effectsEnabled={effectsEnabled}
            accentColor={accentColor}
          />
        </div>
      </main>

      {isContactOpen && (
        <ContactPanel onClose={() => setIsContactOpen(false)} accentColor={accentColor} />
      )}

      <FullScreenMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        boards={state.boards}
        activeBoardId={state.activeBoardId}
        onSelectBoard={handleSelectBoard}
        onGoHome={handleGoHome}
        showDatabaseNames={SHOW_DATABASE_NAMES}
        accentColor={accentColor}
        columnCount={columnCount}
        onColumnChange={setColumnCount}
        language={state.language}
        onToggleLanguage={() => setState(prev => ({ ...prev, language: prev.language === 'es' ? 'en' : 'es' }))}
        effectsEnabled={effectsEnabled}
        onToggleEffects={() => setEffectsEnabled(prev => !prev)}
        descending={descending}
        onToggleOrder={handleToggleOrder}
        onOpenContact={() => setIsContactOpen(true)}
      />
    </div>
  );
};

export default App;
