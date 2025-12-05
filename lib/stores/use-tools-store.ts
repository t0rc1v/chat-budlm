// lib/stores/use-tools-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WritingStyle = 'normal' | 'learning' | 'formal' | 'concise' | 'explanatory';

interface ToolsState {
  // Guided Learning
  guidedLearningEnabled: boolean;
  toggleGuidedLearning: () => void;
  
  // Writing Style
  writingStyle: WritingStyle;
  setWritingStyle: (style: WritingStyle) => void;
  
  // Image Generation
  imageGenerationEnabled: boolean;
  toggleImageGeneration: () => void;
  
  // Reset all tools
  resetTools: () => void;
}

export const useToolsStore = create<ToolsState>()(
  persist(
    (set) => ({
      // Guided Learning state
      guidedLearningEnabled: false,
      toggleGuidedLearning: () =>
        set((state) => ({ guidedLearningEnabled: !state.guidedLearningEnabled })),
      
      // Writing Style state
      writingStyle: 'normal',
      setWritingStyle: (style) => set({ writingStyle: style }),
      
      // Image Generation state
      imageGenerationEnabled: false,
      toggleImageGeneration: () =>
        set((state) => ({ imageGenerationEnabled: !state.imageGenerationEnabled })),
      
      // Reset function
      resetTools: () =>
        set({
          guidedLearningEnabled: false,
          writingStyle: 'normal',
          imageGenerationEnabled: false,
        }),
    }),
    {
      name: 'tools-storage',
    }
  )
);