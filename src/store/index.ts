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
  sharpness: number
  colorMode: number
  tintHue: number
  paletteColors: string[]
  
  isExporting: boolean
  
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
  setSharpness: (sharpness: number) => void
  setColorMode: (mode: number) => void
  setTintHue: (hue: number) => void
  setPaletteColors: (colors: string[]) => void
  setIsExporting: (isExporting: boolean) => void
}

export const useStore = create<AppState>((set) => ({
  currentTool: 'MENU',
  imageURL: null,
  imageDimensions: { width: 0, height: 0 },
  
  ditherStrength: 0.5,
  ditherScale: 1.0,
  ditherAlgorithm: 2,
  brightness: 50,
  contrast: 50,
  saturation: 50,
  gamma: 50,
  vibrance: 50,
  sharpness: 50,
  colorMode: 0,
  tintHue: 20.0,
  paletteColors: ['#0d080d', '#4f2b24', '#825b31', '#c59154'],
  
  isExporting: false,

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
  setSharpness: (sharpness) => set({ sharpness }),
  setColorMode: (mode) => set({ colorMode: mode }),
  setTintHue: (hue) => set({ tintHue: hue }),
  setPaletteColors: (colors) => set({ paletteColors: colors }),
  setIsExporting: (isExporting) => set({ isExporting }),
}))
