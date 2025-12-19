

export interface NotionBlock {
  id: string;
  type: string;
  has_children: boolean;
  [key: string]: any;
}

// Added missing NotionToggleBlock interface to satisfy services/notionService.ts imports
export interface NotionToggleBlock extends NotionBlock {
  type: 'toggle';
  toggle: {
    rich_text: { plain_text: string }[];
  };
}

// Added missing NotionPageBlock interface to satisfy services/notionService.ts imports
export interface NotionPageBlock extends NotionBlock {
  type: 'child_page';
  child_page: {
    title: string;
  };
}

// Added missing NotionDatabaseBlock interface to satisfy services/notionService.ts imports
export interface NotionDatabaseBlock extends NotionBlock {
  type: 'child_database';
  child_database: {
    title: string;
  };
}

export interface NotionImageBlock extends NotionBlock {
  type: 'image';
  image: {
    type: 'file' | 'external';
    file?: { url: string; expiry_time: string };
    external?: { url: string };
    caption: { plain_text: string }[];
  };
}

export interface Board {
  id: string;
  title: string;
  parentId?: string;
  markerColor?: string;
  type: 'toggle' | 'page' | 'database';
  hasChildren: boolean;
  isLoaded?: boolean;
}

export type MediaItemType = 'image' | 'video' | 'text' | 'heading' | 'code' | 'link' | 'title' | 'file';

export interface MediaItem {
  id: string;
  url?: string;
  type: MediaItemType;
  caption?: string;
  content?: string;
  metadata?: {
    language?: string;
    level?: number;
    url?: string;
    fileName?: string;
    fileSize?: string;
    // Fix: Added parentTitle to metadata to support hierarchical context in title cards
    parentTitle?: string;
  };
  parentId: string;
}

export type Language = 'es' | 'en';

export interface AppState {
  isAuthenticated: boolean;
  apiKey: string;
  rootPageId: string;
  boards: Board[];
  activeBoardId: string | null;
  media: MediaItem[];
  isLoading: boolean;
  error: string | null;
  isDemoMode: boolean;
  language: Language;
}