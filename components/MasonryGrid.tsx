
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { MediaItem, Language } from '../types';
import { MediaCard, GroupedCard } from './MediaCard';
import { motion, AnimatePresence } from 'framer-motion';
import { t } from '../services/i18nService';
import { groupContentForReading, GroupedMediaItem, numberListItems } from '../services/contentGrouper';

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
  language: Language;
  onReorder?: (items: MediaItem[]) => void;
}

export const MasonryGrid: React.FC<MasonryGridProps> = ({ items, isLoading, columnCount, language, onReorder }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const galleryInstanceRef = useRef<any>(null);
  
  const strings = t(language);
  const [currentPhrase, setCurrentPhrase] = useState(strings.phrases[0]);
  const [isTextVisible, setIsTextVisible] = useState(true);
  const [isPulsing, setIsPulsing] = useState(false);

  // Agrupar items para mejor orden de lectura y numerar listas
  const groupedItems = useMemo(() => {
    const numbered = numberListItems(items);
    return groupContentForReading(numbered);
  }, [items]);

  useEffect(() => {
    setCurrentPhrase(strings.phrases[Math.floor(Math.random() * strings.phrases.length)]);
  }, [language]);

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

  const columns = useMemo(() => {
    const cols: GroupedMediaItem[][] = Array.from({ length: columnCount }, () => []);
    groupedItems.forEach((item, index) => {
      cols[index % columnCount].push(item);
    });
    return cols;
  }, [groupedItems, columnCount]);

  const handleDragEnd = (draggedId: string, info: any) => {
    if (!onReorder || !containerRef.current) return;

    const point = info.point;
    const cards = containerRef.current.querySelectorAll('[data-card-id]');
    
    let closestId: string | null = null;
    let minDistance = Infinity;

    cards.forEach((cardEl: any) => {
      const id = cardEl.getAttribute('data-card-id');
      if (id === draggedId) return;

      const rect = cardEl.getBoundingClientRect();
      const cardCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };

      const dx = point.x - cardCenter.x;
      const dy = point.y - cardCenter.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Umbral más estricto para que solo se mueva cuando realmente estás "encima" de otra tarjeta
      if (distance < minDistance && distance < rect.width * 1.2) {
        minDistance = distance;
        closestId = id;
      }
    });

    if (closestId) {
      // Encontrar los índices en groupedItems
      const oldGroupIndex = groupedItems.findIndex(item => item.id === draggedId);
      const targetGroupIndex = groupedItems.findIndex(item => item.id === closestId);
      
      if (oldGroupIndex !== -1 && targetGroupIndex !== -1 && oldGroupIndex !== targetGroupIndex) {
        // Reordenar los groupedItems
        const newGroupedItems = [...groupedItems];
        const [movedItem] = newGroupedItems.splice(oldGroupIndex, 1);
        newGroupedItems.splice(targetGroupIndex, 0, movedItem);
        
        // Expandir los grupos a items originales para pasar a onReorder
        const newItems: MediaItem[] = [];
        for (const groupedItem of newGroupedItems) {
          if (groupedItem.isGroup && groupedItem.groupItems) {
            // Es un grupo - añadir todos sus items
            newItems.push(...groupedItem.groupItems);
          } else {
            // Es un item individual
            newItems.push(groupedItem as MediaItem);
          }
        }
        
        onReorder(newItems);
      }
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    if (!galleryInstanceRef.current && items.length > 0) {
      // Temporalmente silenciar console.log para evitar el warning de licencia de lightGallery
      const originalLog = console.log;
      console.log = () => {};
      
      galleryInstanceRef.current = lightGallery(containerRef.current, {
          selector: '.gallery-item', 
          mode: 'lg-fade',
          plugins: [lgZoom, lgVideo, lgThumbnail, lgAutoplay, lgFullscreen, lgRotate], 
          speed: 300,
          download: false,
          zoomFromOrigin: true,
          mobileSettings: { controls: false, showCloseIcon: true, download: false }
      });
      
      // Restaurar console.log
      console.log = originalLog;
    } else if (galleryInstanceRef.current) {
      galleryInstanceRef.current.refresh();
    }
  }, [items]);

  useEffect(() => {
    return () => {
      if (galleryInstanceRef.current) {
        galleryInstanceRef.current.destroy();
        galleryInstanceRef.current = null;
      }
    };
  }, []);

  if (isLoading && items.length === 0) {
    return <div className="flex flex-col items-center justify-center min-h-[100vh] w-full p-4"><div className="loader"></div></div>;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-start min-h-screen w-full pt-[30vh] md:pt-[35vh] p-4">
        <div className="flex flex-col items-center text-center w-full max-w-lg">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative w-52 h-52 md:w-60 md:h-60 bg-[#191919] border border-[#191919] rounded-[32px] flex items-center justify-center overflow-hidden z-10 mb-8">
              <AnimatePresence>
                {isPulsing && (
                  <motion.svg initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 w-full h-full pointer-events-none z-20" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <motion.rect x="0.5" y="0.5" width="99" height="99" rx="14" fill="none" stroke="#00ffcc" strokeWidth="1" strokeDasharray="4 2" animate={{ strokeDashoffset: [0, -6] }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                  </motion.svg>
                )}
              </AnimatePresence>
              <img src="https://iili.io/fc6Elv2.gif" alt="Logo" className="w-42 h-42 md:w-52 md:h-52 object-contain pointer-events-none select-none z-10" />
          </motion.div>
          <div className="h-28 flex flex-col items-center justify-start mx-auto relative">
            <AnimatePresence mode="wait">
              {isTextVisible ? (
                <motion.p key={currentPhrase} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 1 }} className="text-gray-400 text-[10px] md:text-xs font-medium opacity-80">{currentPhrase}</motion.p>
              ) : isPulsing ? (
                <motion.div key="dots" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-3 pt-6 items-center justify-center">
                   {[0, 0.2, 0.4].map(d => <div key={d} className="w-1 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${d}s` }}></div>)}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex gap-3 lg:gap-5 w-full justify-center items-start">
      {columns.map((colItems, colIndex) => (
        <div key={colIndex} className="flex flex-col gap-3 lg:gap-5 flex-1 min-w-0">
            {colItems.map((item) => (
              <div key={item.id} data-card-id={item.id} className="w-full">
                {item.isGroup && item.groupItems ? (
                  <GroupedCard 
                    items={item.groupItems} 
                    language={language} 
                    groupId={item.id}
                    onDragEnd={handleDragEnd}
                  />
                ) : (
                  <MediaCard item={item} onDragEnd={handleDragEnd} language={language} />
                )}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
};
