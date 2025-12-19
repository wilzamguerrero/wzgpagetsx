import React, { useState, useEffect, useRef } from 'react';
import { NotionService, ROOT_PAGE_ID, NOTION_PORTFOLIO_KEY } from './services/notionService';
import { AppState, Board, MediaItem } from './types';
import { Sidebar } from './components/Sidebar';
import { MasonryGrid } from './components/MasonryGrid';
import { t } from './services/i18nService';

const SHOW_DATABASE_NAMES = false; 

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    isAuthenticated: true, 
    apiKey: NOTION_PORTFOLIO_KEY,
    rootPageId: ROOT_PAGE_ID,
    boards: [], 
    activeBoardId: null,
    media: [],
    isLoading: true,
    error: null,
    isDemoMode: false,
    language: 'es',
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [columnCount, setColumnCount] = useState(4);
  const notionServiceRef = useRef<NotionService | null>(null);
  
  const strings = t(state.language);

  const autoLoadDatabases = async (service: NotionService, currentBoards: Board[], forceRefresh = false) => {
    if (SHOW_DATABASE_NAMES) return currentBoards;
    const dbsToLoad = currentBoards.filter(b => b.type === 'database' && !b.isLoaded);
    if (dbsToLoad.length === 0) return currentBoards;
    try {
      const results = await Promise.all(dbsToLoad.map(db => service.queryDatabase(db.id, forceRefresh)));
      const newSubBoards = results.flat();
      const updatedExisting = currentBoards.map(b => 
        b.type === 'database' ? { ...b, isLoaded: true } : b
      );
      const allBoards = [...updatedExisting, ...newSubBoards];
      if (newSubBoards.some(b => b.type === 'database')) return autoLoadDatabases(service, allBoards, forceRefresh);
      return allBoards;
    } catch (e) {
      return currentBoards;
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) return;
      if (e.key.toLowerCase() === 'z') setIsSidebarOpen(prev => !prev);
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const createTitleCard = (title: string, id: string, parentTitle?: string): MediaItem => ({
    id: `title-${id}`,
    type: 'title',
    content: title,
    parentId: id,
    metadata: { parentTitle }
  });

  const loadRootContent = async (service: NotionService, forceRefresh = false) => {
    console.log(`[App] Loading root content, forceRefresh: ${forceRefresh}`);
    const blocks = await service.getBlockChildren(ROOT_PAGE_ID, forceRefresh);
    const expanded = await service.getDeepBlockChildren(blocks, forceRefresh);
    const extractedBoards = service.extractBoards(expanded);
    const finalBoards = await autoLoadDatabases(service, extractedBoards, forceRefresh);
    const media = service.extractMedia(expanded, ROOT_PAGE_ID);
    
    console.log(`[App] Loaded ${finalBoards.length} boards, ${media.length} media items`);
    
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
      if (!NOTION_PORTFOLIO_KEY) {
        setState(prev => ({ ...prev, isLoading: false, error: 'API Key missing.' }));
        return;
      }
      try {
        const service = new NotionService(NOTION_PORTFOLIO_KEY);
        notionServiceRef.current = service;
        const { boards, media } = await loadRootContent(service, true);
        setState(prev => ({ ...prev, boards, media, isLoading: false, error: null }));
      } catch (err: any) {
        console.error('[App] Init error:', err);
        setState(prev => ({ ...prev, isLoading: false, error: `Error: ${err.message}` }));
      }
    };
    initApp();
  }, []);

  const handleSelectBoard = async (boardId: string | null, forceRefresh = true) => {
    const targetId = boardId || state.rootPageId;
    const selectedBoard = state.boards.find(b => b.id === boardId);
    const boardTitle = selectedBoard?.title || "Galería";
    
    let parentTitle: string | undefined = undefined;
    if (selectedBoard && selectedBoard.parentId && selectedBoard.parentId !== state.rootPageId) {
        const parentBoard = state.boards.find(b => b.id === selectedBoard.parentId);
        if (parentBoard) {
            parentTitle = parentBoard.title;
        }
    }

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
        console.log(`[App] Got ${blocks.length} blocks for board ${boardTitle}`);
        const allBlocks = await service.getDeepBlockChildren(blocks, forceRefresh);
        newMedia = service.extractMedia(allBlocks, targetId);
        newSubBoards = service.extractBoards(allBlocks, targetId);
        console.log(`[App] Extracted ${newMedia.length} media items`);
      }
      
      const processedSubBoards = await autoLoadDatabases(service, newSubBoards, forceRefresh);
      
      const finalMedia = newMedia.length > 0 
        ? [createTitleCard(boardTitle, targetId, parentTitle), ...newMedia]
        : [];

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
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
    } catch (err: any) {
      console.error('[App] Select board error:', err);
      setState(prev => ({ ...prev, isLoading: false, error: 'Failed to load content.' }));
    }
  };

  const handleGoHome = async () => {
    setState(prev => ({ ...prev, activeBoardId: null, isLoading: true }));
    
    if (notionServiceRef.current) {
      try {
        const { boards, media } = await loadRootContent(notionServiceRef.current, true);
        setState(prev => ({ ...prev, boards, media, isLoading: false, error: null }));
      } catch (err: any) {
        setState(prev => ({ ...prev, isLoading: false, error: err.message }));
      }
    }
  };

  const handleReorder = (newMedia: MediaItem[]) => {
    setState(prev => ({ ...prev, media: newMedia }));
  };

  return (
    <div className="min-h-screen bg-background text-white flex overflow-x-hidden">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-30 transition-opacity" onClick={() => setIsSidebarOpen(false)} />
      )}
      <Sidebar
        boards={state.boards}
        activeBoardId={state.activeBoardId}
        onSelectBoard={handleSelectBoard}
        onGoHome={handleGoHome}
        onCreateBoard={async (p, title) => {
          const b = await notionServiceRef.current!.createBoard(p === 'root' ? state.rootPageId : p, title);
          setState(prev => ({ ...prev, boards: [...prev.boards, b] }));
          return b;
        }}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        columnCount={columnCount}
        onColumnChange={setColumnCount}
        language={state.language}
        onToggleLanguage={() => setState(prev => ({ ...prev, language: prev.language === 'es' ? 'en' : 'es' }))}
        showDatabaseNames={SHOW_DATABASE_NAMES}
      />
      <main className={`flex-1 transition-all duration-500 flex flex-col min-w-0 ${isSidebarOpen ? 'lg:blur-none blur-sm' : ''}`}>
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
          />
        </div>
      </main>
    </div>
  );
};

export default App;