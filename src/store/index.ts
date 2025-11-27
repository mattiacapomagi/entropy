import { create } from 'zustand'

type Tool = 'MENU' | 'DITHER'

interface AppState {
  currentTool: Tool
  imageURL: string | null
  imageDimensions: { width: number; height: number }
  
  // Dither Tool Parameters
  ditherStrength: number
  ditherScale: number
  ditherAlgorithm: number
  brightness: number
  contrast: number
  saturation: number
  gamma: number
  vibrance: number
  colorMode: number
  tintHue: number
  paletteColors: string[]
  
  isExporting: boolean
  isFullscreen: boolean
  
  setCurrentTool: (tool: Tool) => void
  setImage: (url: string | null, width: number, height: number) => void
  setDitherStrength: (strength: number) => void
  setDitherScale: (scale: number) => void
  setDitherAlgorithm: (algorithm: number) => void
  setBrightness: (brightness: number) => void
  setContrast: (contrast: number) => void
  setSaturation: (saturation: number) => void
  setGamma: (gamma: number) => void
  setVibrance: (vibrance: number) => void
  setColorMode: (mode: number) => void
  setTintHue: (hue: number) => void
  setPaletteColors: (colors: string[]) => void
  setIsExporting: (isExporting: boolean) => void
  setIsFullscreen: (isFullscreen: boolean) => void
  // History
  past: AppState[],
  future: AppState[],
  
  undo: () => void
  redo: () => void
  pushToHistory: () => void
}

// Helper to get relevant state for history
const getHistoryState = (state: AppState): Partial<AppState> => ({
  ditherStrength: state.ditherStrength,
  ditherScale: state.ditherScale,
  ditherAlgorithm: state.ditherAlgorithm,
  brightness: state.brightness,
  contrast: state.contrast,
  saturation: state.saturation,
  gamma: state.gamma,
  vibrance: state.vibrance,
  colorMode: state.colorMode,
  tintHue: state.tintHue,
  paletteColors: [...state.paletteColors],
})

export const useStore = create<AppState>((set, get) => ({
  currentTool: 'MENU',
  imageURL: null,
  imageDimensions: { width: 0, height: 0 },
  
  ditherStrength: 0.5,
  ditherScale: 1.0,
  ditherAlgorithm: 2,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  gamma: 100,
  vibrance: 100,
  colorMode: 0,
  tintHue: 20.0,
  paletteColors: ['#0d080d', '#4f2b24', '#825b31', '#c59154'],
  
  isExporting: false,
  isFullscreen: false,
  
  past: [],
  future: [],

  pushToHistory: () => {
    const currentState = get()
    const historyEntry = getHistoryState(currentState) as AppState
    set((state) => ({
      past: [...state.past, historyEntry],
      future: []
    }))
  },

  undo: () => {
    const { past, future } = get()
    if (past.length === 0) return

    const previous = past[past.length - 1]
    const newPast = past.slice(0, past.length - 1)
    const current = getHistoryState(get()) as AppState

    set({
      ...previous,
      past: newPast,
      future: [current, ...future]
    })
  },

  redo: () => {
    const { past, future } = get()
    if (future.length === 0) return

    const next = future[0]
    const newFuture = future.slice(1)
    const current = getHistoryState(get()) as AppState

    set({
      ...next,
      past: [...past, current],
      future: newFuture
    })
  },

  setCurrentTool: (tool) => set({ currentTool: tool }),
  setImage: (url, width, height) => set({ imageURL: url, imageDimensions: { width, height } }),
  
  setDitherStrength: (strength) => { get().pushToHistory(); set({ ditherStrength: strength }) },
  setDitherScale: (scale) => { get().pushToHistory(); set({ ditherScale: scale }) },
  setDitherAlgorithm: (algorithm) => { get().pushToHistory(); set({ ditherAlgorithm: algorithm }) },
  setBrightness: (brightness) => { get().pushToHistory(); set({ brightness }) },
  setContrast: (contrast) => { get().pushToHistory(); set({ contrast }) },
  setSaturation: (saturation) => { get().pushToHistory(); set({ saturation }) },
  setGamma: (gamma) => { get().pushToHistory(); set({ gamma }) },
  setVibrance: (vibrance) => { get().pushToHistory(); set({ vibrance }) },
  setColorMode: (mode) => { get().pushToHistory(); set({ colorMode: mode }) },
  setTintHue: (hue) => { get().pushToHistory(); set({ tintHue: hue }) },
  setPaletteColors: (colors) => { get().pushToHistory(); set({ paletteColors: colors }) },
  
  setIsExporting: (isExporting) => set({ isExporting }),
  setIsFullscreen: (isFullscreen) => set({ isFullscreen }),
}))
