import { create } from 'zustand';
import { Language, UserRecord, ChatMessage } from './types';

interface AppState {
  // Auth
  isAuthenticated: boolean;
  user: UserRecord | null;
  setUser: (user: UserRecord | null) => void;
  setAuthenticated: (auth: boolean) => void;
  logout: () => void;

  // Language
  language: Language;
  setLanguage: (lang: Language) => void;

  // Chat
  chatMessages: ChatMessage[];
  chatSessionId: string;
  addChatMessage: (msg: ChatMessage) => void;
  clearChat: () => void;

  // Offline
  isOnline: boolean;
  setOnline: (online: boolean) => void;
  draftCount: number;
  setDraftCount: (count: number) => void;

  // UI
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Auth
  isAuthenticated: false,
  user: null,
  setUser: (user) => set({ user }),
  setAuthenticated: (auth) => set({ isAuthenticated: auth }),
  logout: () => set({ isAuthenticated: false, user: null, chatMessages: [] }),

  // Language
  language: 'en',
  setLanguage: (lang) => set({ language: lang }),

  // Chat
  chatMessages: [],
  chatSessionId: 'session_' + Math.random().toString(36).substring(2, 10),
  addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  clearChat: () => set({ chatMessages: [], chatSessionId: 'session_' + Math.random().toString(36).substring(2, 10) }),

  // Offline
  isOnline: true,
  setOnline: (online) => set({ isOnline: online }),
  draftCount: 0,
  setDraftCount: (count) => set({ draftCount: count }),

  // UI
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
