import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Tool = 'MENU' | 'DITHER' | 'DATAMOSH'

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
  shadows: number
  highlights: number
  blacks: number
  whites: number
  colorMode: number
  tintHue: number
  paletteColors: string[]
  
  // Datamosh Tool Parameters
  dm_strength: number
  dm_scale: number
  dm_contrast: number
  dm_color_noise: number
  dm_edge_blur: number
  dm_seed: string
  dm_size_variation: number
  
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
  setShadows: (shadows: number) => void
  setHighlights: (highlights: number) => void
  setBlacks: (blacks: number) => void
  setWhites: (whites: number) => void
  setColorMode: (mode: number) => void
  setTintHue: (hue: number) => void
  setPaletteColors: (colors: string[]) => void
  setDmStrength: (strength: number) => void
  setDmScale: (scale: number) => void
  setDmContrast: (contrast: number) => void
  setDmColorNoise: (noise: number) => void
  setDmEdgeBlur: (blur: number) => void
  setDmSeed: (seed: string) => void
  setDmSizeVariation: (variation: number) => void
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
  shadows: state.shadows,
  highlights: state.highlights,
  blacks: state.blacks,
  whites: state.whites,
  colorMode: state.colorMode,
  tintHue: state.tintHue,
  paletteColors: [...state.paletteColors],
  dm_strength: state.dm_strength,
  dm_scale: state.dm_scale,
  dm_contrast: state.dm_contrast,
  dm_color_noise: state.dm_color_noise,
  dm_edge_blur: state.dm_edge_blur,
  dm_seed: state.dm_seed,
  dm_size_variation: state.dm_size_variation,
})

export const useStore = create<AppState>()(persist((set, get) => ({
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
  shadows: 100,
  highlights: 100,
  blacks: 100,
  whites: 100,
  colorMode: 0,
  tintHue: 20.0,
  paletteColors: ['#0d080d', '#4f2b24', '#825b31', '#c59154'],
  
  dm_strength: 0.5,
  dm_scale: 1.0,
  dm_contrast: 1.0,
  dm_color_noise: 0.0,
  dm_edge_blur: 0.0,
  dm_seed: 'ENTROPY',
  dm_size_variation: 0.0,
  
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
  
  setDitherStrength: (strength) => set({ ditherStrength: strength }),
  setDitherScale: (scale) => set({ ditherScale: scale }),
  setDitherAlgorithm: (algorithm) => set({ ditherAlgorithm: algorithm }),
  setBrightness: (brightness) => set({ brightness }),
  setContrast: (contrast) => set({ contrast }),
  setSaturation: (saturation) => set({ saturation }),
  setGamma: (gamma) => set({ gamma }),
  setVibrance: (vibrance) => set({ vibrance }),
  setShadows: (shadows) => set({ shadows }),
  setHighlights: (highlights) => set({ highlights }),
  setBlacks: (blacks) => set({ blacks }),
  setWhites: (whites) => set({ whites }),
  setColorMode: (mode) => set({ colorMode: mode }),
  setTintHue: (hue) => set({ tintHue: hue }),
  setPaletteColors: (colors) => set({ paletteColors: colors }),
  setDmStrength: (strength) => set({ dm_strength: strength }),
  setDmScale: (scale) => set({ dm_scale: scale }),
  setDmContrast: (contrast) => set({ dm_contrast: contrast }),
  setDmColorNoise: (noise) => set({ dm_color_noise: noise }),
  setDmEdgeBlur: (blur) => set({ dm_edge_blur: blur }),
  setDmSeed: (seed) => set({ dm_seed: seed }),
  setDmSizeVariation: (variation) => set({ dm_size_variation: variation }),
  
  setIsExporting: (isExporting) => set({ isExporting }),
  setIsFullscreen: (isFullscreen) => set({ isFullscreen }),
}), {
  name: 'entropy-storage',
  partialize: (state) => ({
    currentTool: state.currentTool,
    ditherStrength: state.ditherStrength,
    ditherScale: state.ditherScale,
    ditherAlgorithm: state.ditherAlgorithm,
    brightness: state.brightness,
    contrast: state.contrast,
    saturation: state.saturation,
    gamma: state.gamma,
    vibrance: state.vibrance,
    shadows: state.shadows,
    highlights: state.highlights,
    blacks: state.blacks,
    whites: state.whites,
    colorMode: state.colorMode,
    tintHue: state.tintHue,
    paletteColors: state.paletteColors,
    dm_strength: state.dm_strength,
    dm_scale: state.dm_scale,
    dm_contrast: state.dm_contrast,
    dm_color_noise: state.dm_color_noise,
    dm_edge_blur: state.dm_edge_blur,
    dm_seed: state.dm_seed,
    dm_size_variation: state.dm_size_variation,
  })
}))
