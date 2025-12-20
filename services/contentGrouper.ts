import { MediaItem } from '../types';

/**
 * Tipos de contenido que se pueden agrupar en una sección de lectura
 */
const GROUPABLE_TYPES: MediaItem['type'][] = [
  'text',
  'bulleted_list',
  'numbered_list',
  'todo',
  'quote',
  'callout'
];

/**
 * Tipos de contenido que inician una nueva sección
 */
const SECTION_STARTERS: MediaItem['type'][] = ['heading'];

/**
 * Tipos de contenido que siempre se muestran como card individual
 */
const STANDALONE_TYPES: MediaItem['type'][] = [
  'image',
  'video',
  'youtube',
  'code',
  'link',
  'file',
  'properties',
  'title'
];

export interface GroupedMediaItem extends MediaItem {
  isGroup?: boolean;
  groupItems?: MediaItem[];
}

/**
 * Agrupa los items de contenido para mejorar el orden de lectura.
 * 
 * Estrategia:
 * - Los headings inician una nueva sección
 * - El texto, listas y otros contenidos "leíbles" se agrupan con el heading anterior
 * - Imágenes, videos, código, links se mantienen como cards independientes
 * - Si hay contenido sin heading previo, se agrupa solo
 */
export function groupContentForReading(items: MediaItem[]): GroupedMediaItem[] {
  if (items.length === 0) return [];
  
  const result: GroupedMediaItem[] = [];
  let currentGroup: MediaItem[] = [];
  let currentHeading: MediaItem | null = null;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Tipos standalone siempre van solos
    if (STANDALONE_TYPES.includes(item.type)) {
      // Si hay grupo pendiente, finalizarlo primero
      if (currentGroup.length > 0 || currentHeading) {
        result.push(createGroup(currentHeading, currentGroup));
        currentGroup = [];
        currentHeading = null;
      }
      // Añadir el item standalone
      result.push({ ...item, isGroup: false });
      continue;
    }
    
    // Si es un heading, inicia nueva sección
    if (SECTION_STARTERS.includes(item.type)) {
      // Finalizar grupo anterior si existe
      if (currentGroup.length > 0 || currentHeading) {
        result.push(createGroup(currentHeading, currentGroup));
        currentGroup = [];
      }
      currentHeading = item;
      continue;
    }
    
    // Contenido agrupable - añadir al grupo actual
    if (GROUPABLE_TYPES.includes(item.type)) {
      currentGroup.push(item);
      continue;
    }
    
    // Cualquier otro tipo - añadir solo
    if (currentGroup.length > 0 || currentHeading) {
      result.push(createGroup(currentHeading, currentGroup));
      currentGroup = [];
      currentHeading = null;
    }
    result.push({ ...item, isGroup: false });
  }
  
  // Finalizar último grupo si existe
  if (currentGroup.length > 0 || currentHeading) {
    result.push(createGroup(currentHeading, currentGroup));
  }
  
  return result;
}

function createGroup(heading: MediaItem | null, items: MediaItem[]): GroupedMediaItem {
  // Si solo hay un item y no hay heading, devolver como item simple
  if (!heading && items.length === 1) {
    return { ...items[0], isGroup: false };
  }
  
  // Si solo hay heading sin contenido, devolver el heading como item simple
  if (heading && items.length === 0) {
    return { ...heading, isGroup: false };
  }
  
  // Crear grupo combinado
  const allItems = heading ? [heading, ...items] : items;
  const groupId = allItems.map(i => i.id).join('-');
  
  return {
    id: groupId,
    type: 'text', // Tipo base para el grupo
    content: heading?.content || items[0]?.content || '',
    parentId: items[0]?.parentId || heading?.parentId || '',
    isGroup: true,
    groupItems: allItems,
    metadata: {
      level: heading?.metadata?.level
    }
  };
}

/**
 * Numerar items de listas numeradas dentro de grupos
 */
export function numberListItems(items: MediaItem[]): MediaItem[] {
  let currentNumber = 0;
  let prevWasNumberedList = false;
  
  return items.map(item => {
    const isNumberedList = item.type === 'numbered_list';
    
    if (isNumberedList) {
      currentNumber++;
      prevWasNumberedList = true;
      return {
        ...item,
        metadata: { ...item.metadata, number: currentNumber }
      };
    }
    
    // Resetear contador si encontramos algo que no es lista numerada
    if (prevWasNumberedList) {
      currentNumber = 0;
      prevWasNumberedList = false;
    }
    
    return item;
  });
}
