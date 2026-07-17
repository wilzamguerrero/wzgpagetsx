
import React, { useEffect, useRef, useMemo, useState, useLayoutEffect, Suspense, lazy } from 'react';
import Muuri from 'muuri';
import { MediaItem, Language } from '../types';
import { MediaCard, GroupedCard } from './MediaCard';
import { motion, AnimatePresence } from 'framer-motion';

// Fondo WebGL "Dither" (carga diferida).
const Dither = lazy(() => import('./Dither'));

// Convierte un color hex (#rrggbb) a triple normalizado [0..1] para el Dither.
const hexToRgb01 = (hex: string): [number, number, number] => {
  const m = (hex || '').replace('#', '');
  if (m.length !== 6) return [0.5, 0.5, 0.5];
  return [parseInt(m.slice(0, 2), 16) / 255, parseInt(m.slice(2, 4), 16) / 255, parseInt(m.slice(4, 6), 16) / 255];
};
import { t } from '../services/i18nService';
import { groupContentForReading, GroupedMediaItem, numberListItems } from '../services/contentGrouper';
import { ReaderView } from './ReaderView';
import { Plus, Minus } from 'lucide-react';

// @ts-ignore
import lightGallery from 'lightgallery';
// @ts-ignore
import lgZoom from 'lightgallery/plugins/zoom';
// @ts-ignore
import lgVideo from 'lightgallery/plugins/video';
// @ts-ignore
import lgThumbnail from 'lightgallery/plugins/thumbnail';
// @ts-ignore
import lgAutoplay from 'lightgallery/plugins/autoplay';
// @ts-ignore
import lgFullscreen from 'lightgallery/plugins/fullscreen';
// @ts-ignore
import lgRotate from 'lightgallery/plugins/rotate';

interface MasonryGridProps {
  items: MediaItem[];
  isLoading: boolean;
  columnCount: number;
  scaleResetVersion?: number;
  language: Language;
  onReorder?: (items: MediaItem[]) => void;
  isSidebarOpen?: boolean;
  isMenuOpen?: boolean;
  effectsEnabled?: boolean;
  accentColor?: string;
}

// Convierte el orden visual de grupos de vuelta a los MediaItem originales.
// Los separadores tienen IDs deterministas para no recrear Muuri después de
// cada drag por culpa de Date.now().
const expandGroupedOrder = (orderedGroups: GroupedMediaItem[]): MediaItem[] => {
  const result: MediaItem[] = [];
  for (let i = 0; i < orderedGroups.length; i++) {
    const group = orderedGroups[i];
    if (i > 0) {
      const previous = orderedGroups[i - 1];
      if (group.isGroup || previous.isGroup) {
        result.push({
          id: `separator-${previous.id}-${group.id}`,
          type: 'text',
          content: '',
          parentId: group.parentId,
        });
      }
    }
    if (group.isGroup && group.groupItems) result.push(...group.groupItems);
    else result.push(group as MediaItem);
  }
  return result;
};

export const MasonryGrid: React.FC<MasonryGridProps> = ({ items, isLoading, columnCount, scaleResetVersion = 0, language, onReorder, isSidebarOpen = false, isMenuOpen = false, effectsEnabled = true, accentColor = '#00ffcb' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const galleryInstanceRef = useRef<any>(null);
  
  const strings = t(language);
  const [currentPhrase, setCurrentPhrase] = useState(strings.phrases[0]);
  const [isTextVisible, setIsTextVisible] = useState(true);
  const [isPulsing, setIsPulsing] = useState(false);
  // Centro del logo (para anclar ahí la interacción del fondo Dither).
  const logoBoxRef = useRef<HTMLDivElement>(null);
  const [logoFocus, setLogoFocus] = useState<{ x: number; y: number } | null>(null);
  
  // Chaotic shuffle state for glitch effect
  const [shuffledOrder, setShuffledOrder] = useState<string[]>([]);
  const [isShuffling, setIsShuffling] = useState(false);
  const shuffleTimeoutRef = useRef<number>();
  const shuffleIntervalRef = useRef<number>();
  
  // Guardar el orden original de Notion (solo se establece una vez por página)
  const originalOrderRef = useRef<Map<string, number>>(new Map());
  const lastParentIdRef = useRef<string | null>(null);

  // Agrupar items para mejor orden de lectura y numerar listas
  const groupedItems = useMemo(() => {
    const numbered = numberListItems(items);
    return groupContentForReading(numbered);
  }, [items]);
  
  // Detectar si es una nueva página (basado en parentId del primer item)
  const currentParentId = items.length > 0 ? items[0].parentId : null;
  
  // Establecer el orden original solo cuando cambia la página (no cuando se reordenan items)
  useEffect(() => {
    if (currentParentId && currentParentId !== lastParentIdRef.current) {
      // Nueva página - guardar el orden original
      const map = new Map<string, number>();
      groupedItems.forEach((groupedItem, idx) => {
        map.set(groupedItem.id, idx + 1);
      });
      originalOrderRef.current = map;
      lastParentIdRef.current = currentParentId;
    }
  }, [currentParentId, groupedItems]);

  // Reset shuffle order when items change (navigating to another page)
  useEffect(() => {
    setShuffledOrder([]);
    setIsShuffling(false);
  }, [items]);

  // Chaotic shuffle effect when sidebar is open AND effects are enabled
  useEffect(() => {
    if (isSidebarOpen && effectsEnabled && items.length > 1) {
      // Start shuffling after 10 seconds
      shuffleTimeoutRef.current = window.setTimeout(() => {
        setIsShuffling(true);
        
        // Shuffle every 2-4 seconds randomly
        const doShuffle = () => {
          // Use current shuffledOrder if exists, otherwise use groupedItems order
          const currentIds = shuffledOrder.length > 0 
            ? [...shuffledOrder] 
            : groupedItems.map(item => item.id);
          
          // Fisher-Yates shuffle
          for (let i = currentIds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [currentIds[i], currentIds[j]] = [currentIds[j], currentIds[i]];
          }
          setShuffledOrder(currentIds);
          
          // Schedule next shuffle with random delay
          const nextDelay = 8000 + Math.random() * 2000;
          shuffleIntervalRef.current = window.setTimeout(doShuffle, nextDelay);
        };
        
        doShuffle();
      }, 8000);
    } else {
      // Stop shuffling when sidebar closes or effects disabled, but KEEP the current order
      setIsShuffling(false);
      // Don't reset shuffledOrder - keep the cards where they are!
      if (shuffleTimeoutRef.current) {
        clearTimeout(shuffleTimeoutRef.current);
      }
      if (shuffleIntervalRef.current) {
        clearTimeout(shuffleIntervalRef.current);
      }
    }
    
    return () => {
      if (shuffleTimeoutRef.current) clearTimeout(shuffleTimeoutRef.current);
      if (shuffleIntervalRef.current) clearTimeout(shuffleIntervalRef.current);
    };
  }, [isSidebarOpen, effectsEnabled, items.length]);

  // Get items in shuffled order if we have a shuffle order
  const displayItems = useMemo(() => {
    if (shuffledOrder.length === 0) {
      return groupedItems;
    }
    
    const itemMap = new Map(groupedItems.map(item => [item.id, item]));
    const ordered = shuffledOrder
      .map(id => itemMap.get(id))
      .filter((item): item is GroupedMediaItem => item !== undefined);
    
    // If items changed (new items added), append them at the end
    if (ordered.length < groupedItems.length) {
      const orderedIds = new Set(shuffledOrder);
      const newItems = groupedItems.filter(item => !orderedIds.has(item.id));
      return [...ordered, ...newItems];
    }
    
    return ordered;
  }, [groupedItems, shuffledOrder]);

  useEffect(() => {
    setCurrentPhrase(strings.phrases[Math.floor(Math.random() * strings.phrases.length)]);
  }, [language]);

  // Medir el centro del logo (normalizado 0..1) para anclar ahí el "hueco" del Dither.
  useEffect(() => {
    let raf = 0;
    let count = 0;
    const measure = () => {
      const el = logoBoxRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0) {
          setLogoFocus({
            x: (r.left + r.width / 2) / window.innerWidth,
            y: (r.top + r.height / 2) / window.innerHeight,
          });
        }
      }
      count++;
      if (count < 45) raf = requestAnimationFrame(measure); // re-mide ~0.7s (tras fuentes/animación)
    };
    measure();
    const onResize = () => {
      const el = logoBoxRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setLogoFocus({
        x: (r.left + r.width / 2) / window.innerWidth,
        y: (r.top + r.height / 2) / window.innerHeight,
      });
    };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, [items.length, isLoading]);

  useEffect(() => {
    if (items.length === 0 && !isLoading) {
      let timeoutId: number;
      const runCycle = () => {
        setIsTextVisible(true);
        setIsPulsing(false);
        timeoutId = window.setTimeout(() => {
          setIsTextVisible(false);
          timeoutId = window.setTimeout(() => {
            setIsPulsing(true);
            timeoutId = window.setTimeout(() => {
              const randomIndex = Math.floor(Math.random() * strings.phrases.length);
              setCurrentPhrase(strings.phrases[randomIndex]);
              runCycle();
            }, 3000);
          }, 7000);
        }, 5000);
      };
      runCycle();
      return () => clearTimeout(timeoutId);
    }
  }, [items.length, isLoading, language]);

  // Usar el orden original guardado en el ref (no cambia con reordenamientos)
  const orderIndexMap = originalOrderRef.current;

  // ===== Tamaño (span de columnas) por tarjeta, persistente =====
  // Permite hacer una tarjeta (p.ej. un video) más grande; las demás se
  // reacomodan dinámicamente gracias al empaquetado de Muuri.
  // Resolución de la cuadrícula: cada columna se divide en 2 "unidades", así una
  // tarjeta puede medir media columna (más pequeña que lo normal), una columna
  // (tamaño por defecto) o varias.
  const UNITS_PER_COL = 2;
  const DEFAULT_SPAN = UNITS_PER_COL;            // tamaño normal = 1 columna
  const safeColumnCount = Math.max(1, columnCount);
  const totalTracks = safeColumnCount * UNITS_PER_COL;

  const [cardSpans, setCardSpans] = useState<Record<string, number>>({});
  useEffect(() => {
    try {
      const saved = localStorage.getItem('notio_card_spans_v2');
      if (saved) setCardSpans(JSON.parse(saved));
    } catch { /* noop */ }
  }, []);

  // El botón de reset del menú incrementa esta señal. Se borran tanto el
  // estado actual como la persistencia para devolver todas las tarjetas al
  // tamaño normal de una columna, sin recargar la página.
  useEffect(() => {
    if (scaleResetVersion <= 0) return;
    try { localStorage.removeItem('notio_card_spans_v2'); } catch { /* noop */ }
    setCardSpans({});
  }, [scaleResetVersion]);

  const setSpan = (id: string, span: number) => {
    setCardSpans(prev => {
      const next = { ...prev };
      const maxUnits = safeColumnCount * UNITS_PER_COL;
      const clamped = Math.max(1, Math.min(span, maxUnits));
      if (clamped === DEFAULT_SPAN) delete next[id]; else next[id] = clamped;
      try { localStorage.setItem('notio_card_spans_v2', JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };

  // ===== Layout profesional con Muuri =====================================
  // Muuri mide el DOM real y empaqueta las tarjetas sin solapes. `fillGaps`
  // permite aprovechar cualquier hueco disponible cuando conviven tarjetas de
  // distintos tamaños; el movimiento queda animado y nunca altera los datos.
  const GRID_GAP = 20;
  const muuriRef = useRef<Muuri | null>(null);
  const layoutFrameRef = useRef<number>();
  const pendingInstantLayoutRef = useRef(false);
  const draggingIdRef = useRef<string | null>(null);
  const pendingDragOrderRef = useRef<string[] | null>(null);
  const groupedItemsRef = useRef(groupedItems);
  const onReorderRef = useRef(onReorder);
  groupedItemsRef.current = groupedItems;
  onReorderRef.current = onReorder;

  // Orden actual de tarjetas (sensible al orden): sincroniza cambios externos.
  const layoutKey = displayItems.map(item => item.id).join('|');
  // Conjunto de tarjetas (independiente del orden): solo cambia al navegar de
  // página o al añadir/quitar tarjetas. Sirve para decidir cuándo recrear Muuri.
  const itemsSignature = useMemo(
    () => displayItems.map(item => item.id).slice().sort().join('|'),
    [displayItems]
  );
  // Solo se usa Muuri en modo cuadrícula (columnCount >= 1). El modo lector
  // (columnCount === 0) y el home vacío tienen su propio render.
  const useMuuri = columnCount >= 1 && items.length > 0;

  // Agrupa todas las peticiones de layout en un solo frame. Mientras se
  // arrastra una tarjeta se difieren las mediciones para que Muuri no cambie
  // las coordenadas debajo de Framer Motion.
  const requestLayout = (instant = false) => {
    pendingInstantLayoutRef.current ||= instant;

    if (draggingIdRef.current) return;
    if (layoutFrameRef.current !== undefined) return;

    layoutFrameRef.current = requestAnimationFrame(() => {
      layoutFrameRef.current = undefined;
      // El drag pudo empezar después de programar este frame.
      if (draggingIdRef.current) return;

      const grid = muuriRef.current;
      const shouldBeInstant = pendingInstantLayoutRef.current;
      pendingInstantLayoutRef.current = false;
      if (!grid) return;
      grid.refreshItems().layout(shouldBeInstant);
    });
  };

  // Una sola instancia de Muuri controla layout, drag, live sorting y release.
  // React recibe únicamente el orden final cuando termina la liberación.
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!useMuuri || !element || displayItems.length === 0) return;

    const grid = new Muuri(element, {
      items: '.muuri-grid-item',
      layout: {
        fillGaps: true,
        horizontal: false,
        alignRight: false,
        alignBottom: false,
        rounding: true,
      },
      layoutOnResize: 100,
      layoutDuration: 300,
      layoutEasing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      dragEnabled: true,
      dragAxis: 'xy',
      dragSort: true,
      dragStartPredicate: (item, event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('[data-no-drag], button, a, input, textarea, select, option, video, iframe, [contenteditable="true"]')) {
          return false;
        }
        return Muuri.ItemDrag.defaultStartPredicate(item, event, {
          distance: event.pointerType === 'touch' ? 8 : 4,
          delay: event.pointerType === 'touch' ? 140 : 0,
        });
      },
      dragSortHeuristics: {
        sortInterval: 40,
        minDragDistance: 8,
        minBounceBackAngle: 1,
      },
      dragSortPredicate: { threshold: 55, action: 'move' },
      dragRelease: {
        duration: 260,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        useDragContainer: false,
      },
      dragAutoScroll: {
        targets: [window],
        threshold: 80,
        safeZone: 0.2,
        speed: 1000,
        sortDuringScroll: true,
        smoothStop: true,
      },
    });
    muuriRef.current = grid;

    const getId = (muuriItem: Muuri.Item): string | null =>
      muuriItem.getElement()?.dataset.cardId || null;

    const handleNativeDragStart = (muuriItem: Muuri.Item) => {
      draggingIdRef.current = getId(muuriItem);
      pendingDragOrderRef.current = null;
    };

    const handleNativeDragEnd = () => {
      pendingDragOrderRef.current = grid
        .getItems()
        .map(getId)
        .filter((id): id is string => !!id);
    };

    const handleNativeReleaseEnd = () => {
      const orderedIds = pendingDragOrderRef.current;
      pendingDragOrderRef.current = null;
      draggingIdRef.current = null;

      if (orderedIds?.length && onReorderRef.current) {
        const currentGroups = groupedItemsRef.current;
        const byId = new Map(currentGroups.map(group => [group.id, group]));
        const orderedGroups = orderedIds
          .map(id => byId.get(id))
          .filter((group): group is GroupedMediaItem => !!group);
        const included = new Set(orderedGroups.map(group => group.id));
        currentGroups.forEach(group => {
          if (!included.has(group.id)) orderedGroups.push(group);
        });

        const changed = orderedGroups.some((group, index) => group.id !== currentGroups[index]?.id);
        if (changed) onReorderRef.current(expandGroupedOrder(orderedGroups));
      }

      // Procesa cualquier cambio de altura diferido mientras se arrastraba.
      requestLayout(false);
    };

    grid.on('dragStart', handleNativeDragStart);
    grid.on('dragEnd', handleNativeDragEnd);
    grid.on('dragReleaseEnd', handleNativeReleaseEnd);

    grid.refreshItems().layout(true);
    const settleFrame = requestAnimationFrame(() => {
      if (muuriRef.current === grid) grid.refreshItems().layout(true);
    });

    return () => {
      cancelAnimationFrame(settleFrame);
      grid.off('dragStart', handleNativeDragStart);
      grid.off('dragEnd', handleNativeDragEnd);
      grid.off('dragReleaseEnd', handleNativeReleaseEnd);
      if (layoutFrameRef.current !== undefined) {
        cancelAnimationFrame(layoutFrameRef.current);
        layoutFrameRef.current = undefined;
      }
      draggingIdRef.current = null;
      pendingDragOrderRef.current = null;
      pendingInstantLayoutRef.current = false;
      if (muuriRef.current === grid) muuriRef.current = null;
      grid.destroy(false);
    };
  }, [itemsSignature, useMuuri]);

  // Reordenamiento suave: cuando cambia el ORDEN (pero no el conjunto), se le
  // indica a Muuri el nuevo orden leyéndolo del DOM ya reordenado por React y se
  // anima el desplazamiento. Muuri es el único que anima, así no hay conflicto
  // con transforms de Framer ni residuos que dejen tarjetas pegadas.
  useLayoutEffect(() => {
    if (!useMuuri) return;
    const grid = muuriRef.current;
    const container = containerRef.current;
    if (!grid || !container || draggingIdRef.current) return;

    const orderedItems = Array
      .from(container.querySelectorAll<HTMLElement>(':scope > .muuri-grid-item'))
      .map(el => grid.getItem(el))
      .filter((it): it is NonNullable<typeof it> => !!it);

    // layout: true => Muuri recoloca con animación (el deslizamiento suave).
    if (orderedItems.length) grid.sort(orderedItems, { layout: true });
  }, [layoutKey, useMuuri]);

  // Un cambio de span (+/-) o de columnas modifica el ancho y la altura del
  // contenido. Las mediciones se agrupan en el siguiente frame y, si existe un
  // drag activo, quedan pendientes hasta que Muuri termine la liberación.
  // El segundo pase cubre videos, iframes y fuentes de carga tardía.
  useLayoutEffect(() => {
    if (!useMuuri) return;

    requestLayout(true);
    const settleTimer = window.setTimeout(() => requestLayout(true), 380);
    return () => window.clearTimeout(settleTimer);
  }, [cardSpans, columnCount, useMuuri]);

  // Imágenes, videos, iframes, fuentes y texto pueden cambiar de alto tras
  // renderizar. Se ignoran notificaciones sin cambio geométrico y se hace un
  // pase instantáneo para que nunca quede visible una posición ya obsoleta.
  useEffect(() => {
    const container = containerRef.current;
    if (!useMuuri || !container || typeof ResizeObserver === 'undefined') return;

    const sizes = new WeakMap<Element, { width: number; height: number }>();
    const observer = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const next = { width: entry.contentRect.width, height: entry.contentRect.height };
        const prev = sizes.get(entry.target);
        sizes.set(entry.target, next);
        if (!prev || Math.abs(prev.width - next.width) > 0.5 || Math.abs(prev.height - next.height) > 0.5) {
          changed = true;
        }
      }
      if (changed) requestLayout(true);
    });
    // Observar el wrapper exterior: es exactamente la caja que Muuri mide con
    // getBoundingClientRect(), incluidos los cambios de alto por reflow.
    container.querySelectorAll<HTMLElement>('.muuri-grid-item').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [itemsSignature, useMuuri]);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!galleryInstanceRef.current && items.length > 0) {
      // Silenciar console.log globalmente para evitar warnings de librerías
      const originalLog = console.log;
      const originalWarn = console.warn;
      const originalError = console.error;
      console.log = () => {};
      console.warn = () => {};
      console.error = () => {};
      
      galleryInstanceRef.current = lightGallery(containerRef.current, {
          selector: '.gallery-item', 
          mode: 'lg-fade',
          plugins: [lgZoom, lgVideo, lgThumbnail, lgAutoplay, lgFullscreen, lgRotate], 
          speed: 300,
          download: false,
          zoomFromOrigin: true,
          mobileSettings: { controls: false, showCloseIcon: true, download: false }
      });
      
      // Restaurar console
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    } else if (galleryInstanceRef.current) {
      galleryInstanceRef.current.refresh();
    }
  }, [items, columnCount]);

  useEffect(() => {
    return () => {
      if (galleryInstanceRef.current) {
        galleryInstanceRef.current.destroy();
        galleryInstanceRef.current = null;
      }
    };
  }, []);

  if (isLoading && items.length === 0) {
    // Solo fondo negro mientras carga (sin loader); el contenido entra con fade.
    return <div className="fixed inset-0 z-50 bg-black" />;
  }

  // Modo lector (columna 0): una sola columna con estilo de lectura y color de acento.
  if (columnCount === 0 && items.length > 0) {
    return (
      <div ref={containerRef} className="w-full flex justify-center">
        <ReaderView items={numberListItems(items)} language={language} accentColor={accentColor} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="relative flex flex-col items-center justify-start min-h-screen w-full pt-[30vh] md:pt-[35vh] p-4 bg-black">
        {/* Fondo animado Dither (WebGL): aparece primero. Se desmonta al abrir el
            menú (ahorra recursos y evita partículas dobles). */}
        <AnimatePresence>
          {!isMenuOpen && effectsEnabled && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              className="fixed inset-0 z-0 pointer-events-none"
            >
              <Suspense fallback={null}>
                <Dither
                  waveColor={hexToRgb01(accentColor)}
                  waveSpeed={0.05}
                  waveFrequency={3}
                  waveAmplitude={0.3}
                  colorNum={4}
                  pixelSize={2}
                  enableMouseInteraction={false}
                  focusUV={logoFocus ? [logoFocus.x, logoFocus.y] : [0.5, 0.38]}
                  mouseRadius={0.35}
                />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div initial={false} animate={{ opacity: isMenuOpen ? 0 : 1 }} transition={{ duration: 0.5, ease: 'easeOut' }} className="relative z-10 flex flex-col items-center text-center w-full" style={{ maxWidth: '200px' }}>
          <motion.div ref={logoBoxRef} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, delay: 0.8, ease: 'easeOut' }} className="relative w-52 h-52 md:w-60 md:h-60 bg-transparent rounded-[32px] flex items-center justify-center overflow-hidden z-10 mb-8">
              <AnimatePresence>
                {isPulsing && (
                  <motion.svg initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 w-full h-full pointer-events-none z-20" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <motion.rect x="0.5" y="0.5" width="99" height="99" rx="14" fill="none" stroke="#00ffcc" strokeWidth="1" strokeDasharray="4 2" animate={{ strokeDashoffset: [0, -6] }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                  </motion.svg>
                )}
              </AnimatePresence>
              <img src="https://iili.io/fc6Elv2.gif" alt="Logo" className="w-42 h-42 md:w-52 md:h-52 object-contain pointer-events-none select-none z-10" style={{ filter: 'brightness(0.82) contrast(1.18)' }} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.6, ease: 'easeOut' }}
            className="h-28 flex flex-col items-center justify-start mx-auto relative"
          >
            <AnimatePresence mode="wait">
              {isTextVisible ? (
                <motion.p key={currentPhrase} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 1 }} className="text-primary text-[10px] md:text-xs font-medium opacity-80">{currentPhrase}</motion.p>
              ) : isPulsing ? (
                <motion.div key="dots" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-3 pt-6 items-center justify-center">
                   {[0, 0.2, 0.4].map(d => <div key={d} className="w-1 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${d}s` }}></div>)}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // ===== Modo cuadrícula con Muuri + escalado por tarjeta =====
  return (
    <div
      ref={containerRef}
      className={`relative w-full ${isShuffling ? 'shuffling-active' : ''}`}
      style={{ minHeight: 1 }}
    >
      {displayItems.map((item) => {
        const span = Math.max(1, Math.min(cardSpans[item.id] || DEFAULT_SPAN, totalTracks));
        // El ancho exterior incluye márgenes laterales. Así Muuri mide
        // exactamente una fracción del grid y el espacio visible siempre es 20px.
        const widthPercent = (span / totalTracks) * 100;
        return (
          <div
            key={item.id}
            data-card-id={item.id}
            className="muuri-grid-item absolute"
            style={{
              width: `calc(${widthPercent}% - ${GRID_GAP}px)`,
              margin: `0 ${GRID_GAP / 2}px ${GRID_GAP}px`,
              willChange: 'transform',
            }}
          >
            <div className="muuri-item-content relative group/size w-full">
              {/* Controles de tamaño: agrandar/achicar la tarjeta. */}
              <div
                data-no-drag
                className="absolute top-2 right-2 z-[60] flex items-center gap-1 opacity-0 group-hover/size:opacity-100 transition-opacity"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); setSpan(item.id, span - 1); }}
                  disabled={span <= 1}
                  title="Más pequeño"
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-black/70 text-white backdrop-blur border border-white/10 hover:bg-black/90 transition-all disabled:opacity-30"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setSpan(item.id, span + 1); }}
                  disabled={span >= totalTracks}
                  title="Más grande"
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-black/70 text-white backdrop-blur border border-white/10 hover:bg-black/90 transition-all disabled:opacity-30"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {item.isGroup && item.groupItems ? (
                <GroupedCard
                  items={item.groupItems}
                  language={language}
                  groupId={item.id}
                  orderIndex={orderIndexMap.get(item.id)}
                />
              ) : (
                <MediaCard
                  item={item}
                  orderIndex={orderIndexMap.get(item.id)}
                  language={language}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
