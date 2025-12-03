// lib/stores/use-source-store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SourceState {
  // Selected file IDs for new chats (before chat is created)
  selectedFileIds: string[];
  
  // Actions
  toggleFile: (fileId: string) => void;
  selectFile: (fileId: string) => void;
  deselectFile: (fileId: string) => void;
  selectMultiple: (fileIds: string[]) => void;
  deselectMultiple: (fileIds: string[]) => void;
  selectAll: (fileIds: string[]) => void;
  deselectAll: () => void;
  setSelectedFiles: (fileIds: string[]) => void;
  isFileSelected: (fileId: string) => boolean;
  getSelectedCount: () => number;
  
  // Reset store (useful when chat is created or navigating away)
  reset: () => void;
}

const initialState = {
  selectedFileIds: [],
};

export const useSourceStore = create<SourceState>()(
  persist(
    (set, get) => ({
      ...initialState,

      toggleFile: (fileId: string) => {
        set((state) => ({
          selectedFileIds: state.selectedFileIds.includes(fileId)
            ? state.selectedFileIds.filter((id) => id !== fileId)
            : [...state.selectedFileIds, fileId],
        }));
      },

      selectFile: (fileId: string) => {
        set((state) => ({
          selectedFileIds: state.selectedFileIds.includes(fileId)
            ? state.selectedFileIds
            : [...state.selectedFileIds, fileId],
        }));
      },

      deselectFile: (fileId: string) => {
        set((state) => ({
          selectedFileIds: state.selectedFileIds.filter((id) => id !== fileId),
        }));
      },

      selectMultiple: (fileIds: string[]) => {
        set((state) => {
          const uniqueIds = new Set([...state.selectedFileIds, ...fileIds]);
          return { selectedFileIds: Array.from(uniqueIds) };
        });
      },

      deselectMultiple: (fileIds: string[]) => {
        set((state) => ({
          selectedFileIds: state.selectedFileIds.filter(
            (id) => !fileIds.includes(id)
          ),
        }));
      },

      selectAll: (fileIds: string[]) => {
        set({ selectedFileIds: fileIds });
      },

      deselectAll: () => {
        set({ selectedFileIds: [] });
      },

      setSelectedFiles: (fileIds: string[]) => {
        set({ selectedFileIds: fileIds });
      },

      isFileSelected: (fileId: string) => {
        return get().selectedFileIds.includes(fileId);
      },

      getSelectedCount: () => {
        return get().selectedFileIds.length;
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'source-storage',
      storage: createJSONStorage(() => sessionStorage),
      // Only persist selectedFileIds
      partialize: (state) => ({ selectedFileIds: state.selectedFileIds }),
    }
  )
);