
import { Language } from '../types';

export const TRANSLATIONS = {
  es: {
    connecting: "Conectando con Notion...",
    refresh: "Actualizar contenido",
    language: "Idioma: ES",
    errorTitle: "Error de Conexión",
    retry: "Reintentar",
    columns: "Columnas",
    boards: "Tableros",
    newBoardPlaceholder: "Nombre del tablero...",
    videoLabel: "Vídeo",
    loadingMore: "Cargando más...",
    loading: "Cargando...",
    noContent: "No hay contenido disponible",
    showDatabases: "Mostrar bases de datos",
    hideDatabases: "Ocultar bases de datos (Bypass)",
    phrases: [
      "La vida es lo que pasa mientras estás ocupado haciendo otros planes.",
      "El único modo de hacer un gran trabajo es amar lo que haces.",
      "La innovación distingue entre un líder y un seguidor.",
      "No cuentes los días, haz que los días cuenten.",
      "El futuro pertenece a quienes creen en la belleza de sus sueños.",
      "La creatividad es la inteligencia divirtiéndose.",
      "El éxito es ir de fracaso en fracaso sin perder el entusiasmo.",
      "La única forma de hacer algo bien es hacerlo con pasión.",
      "Los sueños no tienen fecha de caducidad.",
      "La vida comienza al final de tu zona de confort."
    ]
  },
  en: {
    connecting: "Connecting to Notion...",
    refresh: "Refresh content",
    language: "Language: EN",
    errorTitle: "Connection Error",
    retry: "Retry",
    columns: "Columns",
    boards: "Boards",
    newBoardPlaceholder: "Board name...",
    videoLabel: "Video",
    loadingMore: "Loading more...",
    loading: "Loading...",
    noContent: "No content available",
    showDatabases: "Show databases",
    hideDatabases: "Hide databases (Bypass)",
    phrases: [
      "Life is what happens while you're busy making other plans.",
      "The only way to do great work is to love what you do.",
      "Innovation distinguishes between a leader and a follower.",
      "Don't count the days, make the days count.",
      "The future belongs to those who believe in the beauty of their dreams.",
      "Creativity is intelligence having fun.",
      "Success is going from failure to failure without losing enthusiasm.",
      "The only way to do something well is to do it with passion.",
      "Dreams don't have an expiration date.",
      "Life begins at the end of your comfort zone."
    ]
  }
};

export type TranslationKeys = keyof typeof TRANSLATIONS.en;

export const t = (lang: Language): typeof TRANSLATIONS.en => {
  return TRANSLATIONS[lang] || TRANSLATIONS.en;
};
