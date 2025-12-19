import { NotionBlock, Board, MediaItem, NotionToggleBlock, NotionPageBlock, NotionDatabaseBlock } from '../types';

// Detectar entorno
const IS_BROWSER = typeof window !== 'undefined';
const IS_LOCALHOST = IS_BROWSER && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// En localhost usar nuestro proxy local, en producción usar la API de Vercel
const API_BASE = IS_LOCALHOST ? 'http://localhost:3001/api/notion' : '/api/notion';
const NOTION_VERSION = '2022-06-28';

// Variables de entorno (VITE_ prefix para el frontend)
export const ROOT_PAGE_ID = import.meta.env.VITE_ROOT_PAGE_ID || '';
export const NOTION_PORTFOLIO_KEY = import.meta.env.VITE_NOTION_PORTFOLIO_KEY || '';

export class NotionService {
  private apiKey: string;
  private cache: Map<string, { data: any, timestamp: number }> = new Map();
  private CACHE_TTL = 5000; // 5 segundos - muy corto para actualizaciones rápidas

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  clearCache(): void {
    this.cache.clear();
    console.log('[NotionService] Cache cleared');
  }

  invalidateBlock(blockId: string): void {
    const cleanId = NotionService.formatUUID(blockId);
    this.cache.delete(cleanId);
    this.cache.delete(`db_${cleanId}`);
    for (const key of this.cache.keys()) {
      if (key.includes(cleanId)) {
        this.cache.delete(key);
      }
    }
    console.log(`[NotionService] Invalidated ${cleanId}`);
  }

  static formatUUID(idOrUrl: string): string {
    if (!idOrUrl) return '';
    const clean = idOrUrl.replace(/-/g, '');
    const match = clean.match(/[a-fA-F0-9]{32}/);
    return match ? match[0] : idOrUrl;
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    };
  }

  // Método unificado para hacer requests - SIEMPRE usa nuestro proxy
  private async notionFetch(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const timestamp = Date.now();
    
    // Construir URL con parámetros
    const url = `${API_BASE}?endpoint=${encodeURIComponent(endpoint)}&method=${method}&_t=${timestamp}`;
    
    console.log(`[NotionService] Fetching: ${method} ${endpoint}`);
    
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[NotionService] Error ${response.status}:`, errorText);
      throw new Error(`Notion API error (${response.status})`);
    }
    
    return response.json();
  }

  async getBlockChildren(blockId: string, forceRefresh: boolean = false): Promise<NotionBlock[]> {
    const cleanId = NotionService.formatUUID(blockId);
    
    if (!forceRefresh) {
      const cached = this.cache.get(cleanId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        console.log(`[NotionService] Cache HIT for ${cleanId}`);
        return cached.data;
      }
    } else {
      this.cache.delete(cleanId);
    }

    console.log(`[NotionService] Fetching blocks for ${cleanId}`);

    let allResults: NotionBlock[] = [];
    let hasMore = true;
    let startCursor: string | undefined = undefined;

    while (hasMore) {
      let endpoint = `/blocks/${cleanId}/children?page_size=100`;
      if (startCursor) endpoint += `&start_cursor=${startCursor}`;
      
      const data = await this.notionFetch(endpoint, 'GET');
      
      console.log(`[NotionService] Got ${data.results?.length || 0} blocks`);
      allResults = [...allResults, ...data.results];
      hasMore = data.has_more;
      startCursor = data.next_cursor;
    }

    this.cache.set(cleanId, { data: allResults, timestamp: Date.now() });
    return allResults;
  }

  async queryDatabase(databaseId: string, forceRefresh: boolean = false): Promise<Board[]> {
    const cleanId = NotionService.formatUUID(databaseId);
    const cacheKey = `db_${cleanId}`;
    
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        console.log(`[NotionService] Cache HIT for database ${cleanId}`);
        return cached.data;
      }
    } else {
      this.cache.delete(cacheKey);
    }

    console.log(`[NotionService] Querying database ${cleanId}`);
    
    const data = await this.notionFetch(`/databases/${cleanId}/query`, 'POST', { page_size: 100 });

    const results = data.results.map((page: any) => {
      let title = 'Sin título';
      const titleProp = Object.values(page.properties).find((p: any) => p.type === 'title') as any;
      if (titleProp && titleProp.title.length > 0) {
        title = titleProp.title.map((t: any) => t.plain_text).join('');
      }

      return {
        id: page.id,
        title: title,
        parentId: databaseId,
        type: 'page' as const,
        hasChildren: true,
        isLoaded: false
      };
    });

    this.cache.set(cacheKey, { data: results, timestamp: Date.now() });
    return results;
  }

  async getDeepBlockChildren(blocks: NotionBlock[], forceRefresh: boolean = false): Promise<NotionBlock[]> {
    const expandedBlocks = [...blocks];
    const columnLists = blocks.filter(b => b.type === 'column_list');
    
    if (columnLists.length > 0) {
      const columns = await Promise.all(columnLists.map(cl => this.getBlockChildren(cl.id, forceRefresh)));
      const flatColumns = columns.flat();
      const columnContent = await Promise.all(flatColumns.map(col => this.getBlockChildren(col.id, forceRefresh)));
      expandedBlocks.push(...flatColumns, ...columnContent.flat());
    }
    return expandedBlocks;
  }

  extractBoards(blocks: NotionBlock[], parentId?: string): Board[] {
    return blocks
      .filter((block): block is NotionToggleBlock | NotionPageBlock | NotionDatabaseBlock => 
        block.type === 'toggle' || block.type === 'child_page' || block.type === 'child_database'
      )
      .map(block => {
        let title = 'Sin título';
        let type: 'toggle' | 'page' | 'database' = 'toggle';

        if (block.type === 'toggle') {
          title = block.toggle?.rich_text?.map((t: any) => t.plain_text).join('') || 'Sin título';
          type = 'toggle';
        } else if (block.type === 'child_page') {
          title = block.child_page?.title || 'Sin título';
          type = 'page';
        } else if (block.type === 'child_database') {
          title = block.child_database?.title || 'Sin título';
          type = 'database';
        }
        
        return {
          id: block.id,
          title: title,
          parentId: parentId,
          type: type,
          hasChildren: block.has_children || type === 'database',
          isLoaded: false
        };
      });
  }

  extractMedia(blocks: NotionBlock[], parentId: string): MediaItem[] {
    const seenIds = new Set<string>();
    console.log(`[NotionService] Extracting media from ${blocks.length} blocks`);
    
    const media = blocks.map((block): MediaItem | null => {
      if (seenIds.has(block.id)) return null;
      
      let type: MediaItem['type'] | null = null;
      let url = '';
      let caption = '';
      let content = '';
      let metadata: any = {};

      if (block.type === 'image') {
        type = 'image';
        url = block.image?.file?.url || block.image?.external?.url || '';
        caption = block.image?.caption?.map((t: any) => t.plain_text).join('') || '';
      } else if (block.type === 'video') {
        type = 'video';
        url = block.video?.file?.url || block.video?.external?.url || '';
        caption = block.video?.caption?.map((t: any) => t.plain_text).join('') || '';
      } else if (block.type === 'file') {
        type = 'file';
        url = block.file?.file?.url || block.file?.external?.url || '';
        const rawCaption = block.file?.caption?.map((t: any) => t.plain_text).join('') || '';
        const fileNameFromUrl = url.split('/').pop()?.split('?')[0] || 'Archivo';
        metadata = { fileName: rawCaption || fileNameFromUrl };
      } else if (block.type === 'paragraph') {
        content = block.paragraph?.rich_text?.map((t: any) => t.plain_text).join('') || '';
        if (content.trim()) type = 'text';
      } else if (block.type.startsWith('heading_')) {
        const level = parseInt(block.type.split('_')[1]);
        content = block[block.type]?.rich_text?.map((t: any) => t.plain_text).join('') || '';
        if (content.trim()) {
          type = 'heading';
          metadata = { level };
        }
      } else if (block.type === 'code') {
        content = block.code?.rich_text?.map((t: any) => t.plain_text).join('') || '';
        if (content.trim()) {
          type = 'code';
          metadata = { language: block.code?.language };
        }
      } else if (block.type === 'bookmark') {
        type = 'link';
        url = block.bookmark?.url || '';
        caption = block.bookmark?.caption?.map((t: any) => t.plain_text).join('') || '';
        content = url;
      }

      if (type && (url || content)) {
        seenIds.add(block.id);
        return { id: block.id, type, url, caption, content, metadata, parentId };
      }
      return null;
    }).filter((item): item is MediaItem => item !== null);

    console.log(`[NotionService] Extracted ${media.length} media items`);
    return media;
  }

  async createBoard(parentId: string, title: string): Promise<Board> {
    const cleanId = NotionService.formatUUID(parentId);
    const body = {
      children: [{ object: 'block', type: 'toggle', toggle: { rich_text: [{ text: { content: title } }] } }]
    };
    
    const data = await this.notionFetch(`/blocks/${cleanId}/children`, 'PATCH', body);
    
    this.invalidateBlock(parentId);
    return { id: data.results[0].id, title, parentId, type: 'toggle', hasChildren: false, isLoaded: true };
  }
}