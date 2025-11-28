import { useStore } from '../store'
import { useRef, useCallback, useState } from 'react'
import { Stage } from './Stage'

const DITHER_ALGORITHMS = [
  { id: 0, name: 'BAYER 2X2' },
  { id: 1, name: 'BAYER 4X4' },
  { id: 2, name: 'BAYER 8X8' },
  { id: 3, name: 'HALFTONE 45°' },
  { id: 4, name: 'HALFTONE 22°' }
]

const COLOR_MODES = [
  { id: 0, name: 'FULL COLOR' },
  { id: 1, name: 'GRAYSCALE' },
  { id: 2, name: 'TINT' },
  { id: 3, name: 'MULTICOLOR' }
]

const PALETTE_PRESETS = [
  { name: 'CUSTOM', colors: [] },
  { name: 'COFFEE', colors: ['#0d080d', '#4f2b24', '#825b31', '#c59154'] },
  { name: 'GAMEBOY', colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'] },
  { name: 'CGA', colors: ['#000000', '#55ffff', '#ff55ff', '#ffffff'] },
  { name: 'CYBER', colors: ['#0d0221', '#261447', '#ff005c', '#00f0ff'] },
  { name: 'VAPOR', colors: ['#2c2137', '#76448a', '#b967ff', '#62f6ff'] },
  { name: 'MATRIX', colors: ['#000000', '#003b00', '#008f11', '#00ff41'] },
  { name: 'SEPIA', colors: ['#2e1d0e', '#6b4826', '#b08d55', '#e8dcb5'] },
  { name: 'B&W', colors: ['#000000', '#555555', '#aaaaaa', '#ffffff'] },
  { name: 'CRIMSON', colors: ['#1a0000', '#4d0000', '#990000', '#ff0000', '#ff6666'] },
  { name: 'OCEAN', colors: ['#001a33', '#003366', '#0066cc', '#3399ff', '#66ccff'] },
  { name: 'FOREST', colors: ['#0d1f0d', '#1a3d1a', '#2d5c2d', '#408040', '#66b366'] },
  { name: 'SUNSET', colors: ['#1a0a00', '#ff4500', '#ff8c00', '#ffd700'] },
  { name: 'PURPLE HAZE', colors: ['#1a001a', '#4d004d', '#800080', '#b366b3', '#e6b3e6'] },
  { name: 'ELECTRIC', colors: ['#000d1a', '#001a33', '#00ffff', '#ffff00', '#ff00ff'] },
  { name: 'RUST', colors: ['#2b1100', '#5c2200', '#b54500', '#ff6600', '#ff9933'] },
  { name: 'NORD', colors: ['#2e3440', '#3b4252', '#88c0d0', '#ebcb8b', '#d8dee9'] },
  { name: 'DRACULA', colors: ['#282a36', '#44475a', '#ff79c6', '#8be9fd', '#f8f8f2'] },
  { name: 'GRUVBOX', colors: ['#282828', '#cc241d', '#98971a', '#d79921', '#fbf1c7'] },
  { name: 'TOKYO NIGHT', colors: ['#1a1b26', '#7aa2f7', '#bb9af7', '#f7768e', '#c0caf5'] },
  { name: 'MONOKAI', colors: ['#272822', '#f92672', '#a6e22e', '#f4bf75', '#f8f8f2'] },
  { name: 'PASTEL', colors: ['#ffe4e1', '#ffd1dc', '#c5d8f7', '#d4f1f4', '#b0e0e6'] },
  { name: 'NEON', colors: ['#000000', '#ff006e', '#00f5ff', '#ffbe0b', '#ffffff'] },
  { name: 'EARTH', colors: ['#3d2314', '#6b4423', '#9c6644', '#c19a6b', '#e5c29f'] },
  { name: 'ICE', colors: ['#0a1828', '#1e3a5f', '#4a90a4', '#7fc8d6', '#e0f7fa'] },
  { name: 'FIRE', colors: ['#1a0000', '#660000', '#cc0000', '#ff3300', '#ff9900', '#ffcc00'] },
  { name: 'RETRO', colors: ['#2d1b00', '#d2691e', '#f4a460', '#ffdead'] },
  { name: 'VAPORWAVE', colors: ['#ff71ce', '#01cdfe', '#05ffa1', '#b967ff', '#fffb96'] },
  { name: 'OUTRUN', colors: ['#2b0f54', '#ab20fd', '#ff0055', '#ff6c11', '#ffee00'] },
  { name: 'ACID', colors: ['#000000', '#39ff14', '#ff10f0', '#fff000', '#00ffff'] },
  { name: 'COPPER', colors: ['#1a0f00', '#3d2817', '#6b4423', '#b87333', '#d4a574', '#f0d9b5'] },
  { name: 'SLATE', colors: ['#1e293b', '#334155', '#64748b', '#94a3b8', '#cbd5e1'] },
  { name: 'AMBER', colors: ['#1a0f00', '#78350f', '#b45309', '#f59e0b', '#fbbf24', '#fde68a'] },
  { name: 'EMERALD', colors: ['#022c22', '#064e3b', '#059669', '#10b981', '#6ee7b7'] },
  { name: 'ROSE', colors: ['#1a0000', '#881337', '#e11d48', '#fb7185', '#fda4af', '#ffe4e6'] },
  { name: 'CORAL REEF', colors: ['#ff6b6b', '#f4a261', '#e76f51', '#2a9d8f', '#264653'] },
  { name: 'LAVENDER', colors: ['#230338', '#511281', '#9d4edd', '#c77dff', '#e0aaff'] },
  { name: 'TROPICAL', colors: ['#003d5b', '#00a8e8', '#00c9ff', '#ffd60a', '#ff6700'] },
  { name: 'CANDY', colors: ['#ff0a54', '#ff477e', '#ff5c8a', '#ff8fab', '#ffc2d1'] },
  { name: 'COSMIC', colors: ['#1a0033', '#5d00a6', '#a200e6', '#ff00ff', '#00ffff'] },
  { name: 'AUTUMN', colors: ['#441100', '#8b3a00', '#cd5c00', '#e67e22', '#f39c12'] },
  { name: 'MINT', colors: ['#0d3b3b', '#1a7070', '#26a69a', '#4db6ac', '#80cbc4'] },
  { name: 'CHERRY', colors: ['#350000', '#6b0000', '#c1121f', '#ee4266', '#ff6b9d'] },
  { name: 'SAPPHIRE', colors: ['#001233', '#0353a4', '#023e7d', '#0466c8', '#4cc9f0'] },
  { name: 'LEMON', colors: ['#443300', '#997700', '#ffb700', '#ffe066', '#fff5cc'] },
  { name: 'BUBBLE GUM', colors: ['#ff006e', '#fb5607', '#ffbe0b', '#8338ec', '#3a86ff'] },
  { name: 'MIDNIGHT', colors: ['#0a0a0a', '#1a1a2e', '#16213e', '#0f3460', '#533483'] },
  { name: 'PEACH', colors: ['#4a1c1c', '#b85042', '#e09f7d', '#f7d6bf', '#fff4e6'] },
  { name: 'JUNGLE', colors: ['#0a1f0a', '#1e4620', '#2d6a2d', '#40993e', '#6bc96a'] },
  { name: 'MAGMA', colors: ['#1a0000', '#8b0000', '#ff4500', '#ff6347', '#ffa07a'] },
  { name: 'ARCTIC', colors: ['#001f3f', '#003d5b', '#005f73', '#0a9396', '#94d2bd'] },
]

export function LabOverlay() {
  const currentTool = useStore((state) => state.currentTool)
  const setCurrentTool = useStore((state) => state.setCurrentTool)
  
  const ditherStrength = useStore((state) => state.ditherStrength)
  const ditherScale = useStore((state) => state.ditherScale)
  const ditherAlgorithm = useStore((state) => state.ditherAlgorithm)
  const brightness = useStore((state) => state.brightness)
  const contrast = useStore((state) => state.contrast)
  const saturation = useStore((state) => state.saturation)
  const gamma = useStore((state) => state.gamma)
  const vibrance = useStore((state) => state.vibrance)
  const shadows = useStore((state) => state.shadows)
  const highlights = useStore((state) => state.highlights)
  const blacks = useStore((state) => state.blacks)
  const whites = useStore((state) => state.whites)
  const colorMode = useStore((state) => state.colorMode)
  const tintHue = useStore((state) => state.tintHue)
  const paletteColors = useStore((state) => state.paletteColors)
  
  const dm_strength = useStore((state) => state.dm_strength)
  const dm_scale = useStore((state) => state.dm_scale)
  const dm_contrast = useStore((state) => state.dm_contrast)
  const dm_color_noise = useStore((state) => state.dm_color_noise)
  const dm_seed = useStore((state) => state.dm_seed)
  const dm_size_variation = useStore((state) => state.dm_size_variation)
  
  const asciiDensity = useStore((state) => state.asciiDensity)
  const asciiColor = useStore((state) => state.asciiColor)
  
  const setDitherStrength = useStore((state) => state.setDitherStrength)
  const setDitherScale = useStore((state) => state.setDitherScale)
  const setDitherAlgorithm = useStore((state) => state.setDitherAlgorithm)
  const setBrightness = useStore((state) => state.setBrightness)
  const setContrast = useStore((state) => state.setContrast)
  const setSaturation = useStore((state) => state.setSaturation)
  const setGamma = useStore((state) => state.setGamma)
  const setVibrance = useStore((state) => state.setVibrance)
  const setShadows = useStore((state) => state.setShadows)
  const setHighlights = useStore((state) => state.setHighlights)
  const setBlacks = useStore((state) => state.setBlacks)
  const setWhites = useStore((state) => state.setWhites)
  const setColorMode = useStore((state) => state.setColorMode)
  const setTintHue = useStore((state) => state.setTintHue)
  const setPaletteColors = useStore((state) => state.setPaletteColors)
  const setDmStrength = useStore((state) => state.setDmStrength)
  const setDmScale = useStore((state) => state.setDmScale)
  const setDmContrast = useStore((state) => state.setDmContrast)
  const setDmColorNoise = useStore((state) => state.setDmColorNoise)
  const setDmSeed = useStore((state) => state.setDmSeed)
  const setDmSizeVariation = useStore((state) => state.setDmSizeVariation)
  
  const setAsciiDensity = useStore((state) => state.setAsciiDensity)
  const setAsciiColor = useStore((state) => state.setAsciiColor)
  
  const setIsExporting = useStore((state) => state.setIsExporting)
  const isFullscreen = useStore((state) => state.isFullscreen)
  const setIsFullscreen = useStore((state) => state.setIsFullscreen)
  const setImage = useStore((state) => state.setImage)
  const imageURL = useStore((state) => state.imageURL)
  const pushToHistory = useStore((state) => state.pushToHistory)
  
  const [customColorCount, setCustomColorCount] = useState(4)
  const [selectedPreset, setSelectedPreset] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = useCallback(() => {
    console.log('[UI] SAVE button clicked, calling setIsExporting(true)')
    console.log('[UI] Current imageURL:', imageURL)
    setIsExporting(true)
  }, [setIsExporting, imageURL])
  const handleFileClick = useCallback(() => fileInputRef.current?.click(), [])

  const loadImageFile = useCallback((file: File) => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => setImage(url, img.width, img.height)
      img.src = url
    }
  }, [setImage])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadImageFile(file)
  }, [loadImageFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files[0]
    if (file) loadImageFile(file)
  }, [loadImageFile])


  const updatePaletteColor = useCallback((index: number, color: string) => {
    const newPalette = [...paletteColors]
    newPalette[index] = color
    setPaletteColors(newPalette)
  }, [paletteColors, setPaletteColors])

  const handleCustomColorCountChange = useCallback((count: number) => {
    setCustomColorCount(count)
    const newColors = Array(count).fill('#000000').map((_, i) => {
      if (i < paletteColors.length) return paletteColors[i]
      return `#${Math.floor(Math.random()*16777215).toString(16).padStart(6,'0')}`
    })
    setPaletteColors(newColors)
  }, [paletteColors, setPaletteColors])

  const handleClearImage = useCallback(() => setImage(null, 0, 0), [setImage])

  // MAIN MENU
  if (currentTool === 'MENU') {
    return (
      <div className="absolute inset-0 bg-black flex items-center justify-center text-white p-4">
        <div className="border-[4px] md:border-[8px] border-white p-6 md:p-10 max-w-xl w-full">
          <h1 className="text-4xl md:text-6xl font-black mb-8 tracking-tight uppercase text-center">ENTROPY</h1>
          
          <div className="space-y-4">
            {/* EXPORT BUTTONS - Removed from here */ }
            <button 
              onClick={() => setCurrentTool('DITHER')}
              className="w-full bg-white text-black text-lg md:text-xl font-bold py-3 md:py-4 hover:bg-[#f27200] hover:text-white border-2 border-black uppercase tracking-wider"
            >
              DITHER TOOL
            </button>
            
            <button 
              onClick={() => setCurrentTool('DATAMOSH')}
              className="w-full bg-white text-black text-lg md:text-xl font-bold py-3 md:py-4 hover:bg-[#f27200] hover:text-white border-2 border-black uppercase tracking-wider"
            >
              DATAMOSH
            </button>
            
            <button 
              onClick={() => setCurrentTool('TERMINAL')}
              className="w-full bg-white text-black text-lg md:text-xl font-bold py-3 md:py-4 hover:bg-[#f27200] hover:text-white border-2 border-black uppercase tracking-wider"
            >
              TERMINAL
            </button>
            
            <button 
              disabled
              className="w-full bg-black text-white/30 text-lg md:text-xl font-bold py-3 md:py-4 border-2 border-white/30 cursor-not-allowed uppercase tracking-wider"
            >
              GLITCH [COMING SOON]
            </button>
          </div>
          
          <div className="mt-12 text-white/50 text-xs md:text-sm font-bold uppercase tracking-widest text-center">
            © 2025 MATTIA CAPOMAGI
          </div>
        </div>
      </div>
    )
  }

  // DITHER TOOL
  return (
    <div className="absolute inset-0 bg-black h-[100dvh] w-full overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* HEADER - BLACK */}
      <div className="h-14 md:h-16 bg-black border-b-2 border-[#f27200] flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4 md:gap-6">
          <button
            onClick={() => setCurrentTool('MENU')}
            className="text-white hover:text-[#f27200] transition-colors"
            title="Back to Menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div className="text-[#f27200] text-2xl md:text-3xl font-bold uppercase tracking-widest">
            {currentTool}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="absolute top-14 md:top-16 bottom-16 md:bottom-20 left-0 right-0 flex flex-col md:flex-row">
        
        {/* PREVIEW AREA (Top on mobile, Right on desktop) */}
        <div className={`
          relative bg-black order-1 md:order-2 
          ${isFullscreen ? 'fixed inset-0 z-50 h-[100dvh] w-full' : 'flex-1 h-[40%] md:h-auto border-b-2 md:border-b-0 border-[#f27200] md:border-none'}
        `}>
          {!imageURL ? (
            <div
              onClick={handleFileClick}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-[#f27200]/30 m-8 md:m-12 cursor-pointer hover:border-[#f27200]"
            >
              <div className="text-[#f27200] text-xl md:text-2xl font-bold uppercase tracking-widest">RELEASE IMAGE HERE</div>
              <div className="text-[#f27200]/50 text-base md:text-lg font-bold uppercase mt-2 md:mt-3">OR CLICK</div>
            </div>
          ) : (
            <div className="absolute inset-0">
              <Stage />
              
              {/* Fullscreen Toggle Button */}
              <button 
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="absolute top-4 right-4 z-10 bg-black/50 text-[#f27200] border-2 border-[#f27200] p-2 hover:bg-[#f27200] hover:text-black transition-colors"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isFullscreen ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path></svg>
                )}
              </button>
            </div>
          )}
        </div>

        {/* SIDEBAR - BLACK (Bottom on mobile, Left on desktop) */}
        <div className={`
          w-full md:w-80 bg-black border-r-0 md:border-r-2 border-[#f27200] overflow-y-auto scrollbar-hide order-2 md:order-1
          ${isFullscreen ? 'hidden' : 'h-[60%] md:h-auto'}
        `}>
          <div className="p-4 space-y-4">
            
            {/* COLOR - Hide in Terminal mode */}
            {currentTool !== 'TERMINAL' && (
            <div className="border-2 border-[#f27200] p-3 bg-black text-white">
              <div className="text-base font-semibold mb-3 uppercase tracking-wide border-b-2 border-[#f27200] pb-2">
                COLOR
              </div>
              
              <select
                value={colorMode}
                onChange={(e) => {
                  pushToHistory()
                  setColorMode(parseInt(e.target.value))
                }}
                className="w-full bg-[#f27200] text-black border-2 border-[#f27200] p-2 font-bold text-sm uppercase"
              >
                {COLOR_MODES.map(mode => (
                  <option key={mode.id} value={mode.id}>{mode.name}</option>
                ))}
              </select>

              {colorMode === 2 && (
                <div className="mt-4">
                  <div className="flex justify-between mb-1.5">
                    <span className="font-medium uppercase text-xs">HUE</span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          pushToHistory()
                          setTintHue(20)
                        }}
                        className="text-[10px] font-bold uppercase text-[#f27200] hover:text-white"
                        style={{ opacity: tintHue === 20 ? 0 : 1, pointerEvents: tintHue === 20 ? 'none' : 'auto' }}
                      >
                        RESET
                      </button>
                      <span className="text-[#f27200] font-semibold text-sm w-8 text-right">{tintHue}</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={1}
                    value={tintHue}
                    onPointerDown={pushToHistory}
                    onChange={(e) => setTintHue(parseInt(e.target.value))}
                    className="w-full h-5 appearance-none bg-[#333] border-2 border-[#333] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-[#f27200] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-black"
                  />
                  <div className="w-full h-2 mt-2 rounded-sm" style={{ backgroundColor: `hsl(${tintHue}, 100%, 50%)` }} />
                </div>
              )}

              {colorMode === 3 && (
                <div className="mt-4 space-y-4">
                  <select
                    value={selectedPreset}
                    onChange={(e) => {
                      pushToHistory()
                      setSelectedPreset(e.target.value)
                      const preset = PALETTE_PRESETS.find(p => p.name === e.target.value)
                      if (preset) {
                        if (preset.name === 'CUSTOM') {
                          handleCustomColorCountChange(4)
                        } else {
                          setPaletteColors(preset.colors)
                        }
                      }
                    }}
                    className="w-full bg-[#f27200] text-black border-2 border-[#f27200] p-2 font-bold text-sm uppercase"
                  >
                    <option value="">SELECT PRESET</option>
                    {PALETTE_PRESETS.map(p => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                  
                  {selectedPreset === 'CUSTOM' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-black uppercase text-sm">COLORS</span>
                        <select
                          value={customColorCount}
                          onChange={(e) => handleCustomColorCountChange(parseInt(e.target.value))}
                          className="bg-[#f27200] text-black border-2 border-[#f27200] p-1.5 font-bold text-xs"
                        >
                          {[...Array(12)].map((_, i) => (
                            <option key={i + 1} value={i + 1}>{i + 1}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-4 gap-2">
                    {paletteColors.map((color, index) => (
                      <input
                        key={index}
                        type="color"
                        value={color}
                        onPointerDown={pushToHistory}
                        onChange={(e) => updatePaletteColor(index, e.target.value)}
                        className="w-full h-auto aspect-square border-2 border-[#f27200] cursor-pointer p-0 appearance-none rounded-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* ADJUST - Hide in Datamosh and Terminal mode */}
            {currentTool !== 'DATAMOSH' && currentTool !== 'TERMINAL' && (
            <div className="border-2 border-[#f27200] p-3 bg-black text-white">
              <div className="text-base font-semibold mb-3 uppercase tracking-wide border-b-2 border-[#f27200] pb-2">
                ADJUST
              </div>
              
              {[
                { label: 'BRIGHTNESS', value: brightness, setter: setBrightness, min: 0, max: 200, def: 100 },
                { label: 'CONTRAST', value: contrast, setter: setContrast, min: 0, max: 200, def: 100 },
                { label: 'SHADOWS', value: shadows, setter: setShadows, min: 0, max: 200, def: 100 },
                { label: 'LIGHTS', value: highlights, setter: setHighlights, min: 0, max: 200, def: 100 },
                { label: 'BLACKS', value: blacks, setter: setBlacks, min: 0, max: 200, def: 100 },
                { label: 'WHITES', value: whites, setter: setWhites, min: 0, max: 200, def: 100 },
                { label: 'GAMMA', value: gamma, setter: setGamma, min: 0, max: 200, def: 100 },
                { label: 'SATURATION', value: saturation, setter: setSaturation, min: 0, max: 200, def: 100 },
                { label: 'VIBRANCE', value: vibrance, setter: setVibrance, min: 0, max: 200, def: 100 },
              ].map(({ label, value, setter, min, max, def }) => (
                <div key={label} className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium uppercase text-xs">{label}</span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          pushToHistory()
                          setter(def)
                        }}
                        className="text-[10px] font-bold uppercase text-[#f27200] hover:text-white"
                        style={{ opacity: value === def ? 0 : 1, pointerEvents: value === def ? 'none' : 'auto' }}
                      >
                        RESET
                      </button>
                      <span className="text-[#f27200] font-semibold text-sm w-8 text-right">{typeof value === 'number' ? value.toFixed(0) : value}</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={1}
                    value={value}
                    onPointerDown={pushToHistory}
                    onChange={(e) => setter(parseFloat(e.target.value))}
                    className="w-full h-5 appearance-none bg-[#333] border-2 border-[#333] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-[#f27200] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-black"
                  />
                </div>
              ))}
            </div>
            )}

            {/* DATAMOSH CONTROLS */}
            {currentTool === 'DATAMOSH' && (
              <div className="border-2 border-[#f27200] p-3 bg-[#f27200] text-black mt-4">
                <div className="text-base font-semibold mb-3 uppercase tracking-wide border-b-2 border-black pb-2">
                  DATAMOSH
                </div>
                
                {/* Seed Input */}
                <div className="mb-3">
                  <div className="flex justify-between mb-1">
                    <label className="text-sm font-bold">SEED</label>
                    <button 
                      onClick={() => {
                        setDmSeed(Math.random().toString(36).substring(7).toUpperCase())
                        pushToHistory()
                      }}
                      className="text-xs underline hover:text-white"
                    >
                      RANDOMIZE
                    </button>
                  </div>
                  <input 
                    type="text" 
                    value={dm_seed}
                    onChange={(e) => {
                      const val = e.target.value.slice(0, 16)
                      setDmSeed(val)
                    }}
                    onBlur={pushToHistory}
                    maxLength={16}
                    className="w-full bg-black border border-black text-white p-2 font-mono text-sm focus:outline-none focus:border-white uppercase"
                  />
                </div>

                {[
                  { label: 'STRENGTH', value: dm_strength, setter: setDmStrength, min: 0, max: 1, step: 0.01, def: 0.5 },
                  { label: 'BLOCK SIZE', value: dm_scale, setter: setDmScale, min: 0.01, max: 5, step: 0.01, def: 1.0 },
                  { label: 'SIZE VARIATION', value: dm_size_variation, setter: setDmSizeVariation, min: 0, max: 0.5, step: 0.01, def: 0.0 },
                  { label: 'DENSITY', value: dm_contrast, setter: setDmContrast, min: 0.0, max: 1.0, step: 0.01, def: 1.0 },
                  { label: 'COLOR SHIFT', value: dm_color_noise, setter: setDmColorNoise, min: 0, max: 1, step: 0.01, def: 0.0 },
                ].map(({ label, value, setter, min, max, step, def }) => (
                  <div key={label} className="mb-3">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium uppercase text-xs">{label}</span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            pushToHistory()
                            setter(def)
                          }}
                          className="text-[10px] font-bold uppercase text-black hover:text-white"
                          style={{ opacity: value === def ? 0 : 1, pointerEvents: value === def ? 'none' : 'auto' }}
                        >
                          RESET
                        </button>
                        <span className="font-semibold text-sm w-8 text-right">{value.toFixed(2)}</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={value}
                      onPointerDown={pushToHistory}
                      onChange={(e) => setter(parseFloat(e.target.value))}
                      className="w-full h-6 appearance-none bg-black border-4 border-black [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-black"
                    />
                  </div>
                ))}
              </div>
            )}
            
            {/* TERMINAL CONTROLS */}
            {currentTool === 'TERMINAL' && (
              <div className="border-2 border-[#f27200] p-3 bg-black text-white mt-4">
                <div className="text-base font-semibold mb-3 uppercase tracking-wide border-b-2 border-[#f27200] pb-2">
                  TERMINAL
                </div>
                
                {/* Color Controls */}
                <div className="mb-4">
                  <div className="flex justify-between mb-1.5">
                    <span className="font-medium uppercase text-xs">COLOR</span>
                    <div className="flex items-center gap-2">
                       <input 
                        type="text" 
                        value={asciiColor}
                        onChange={(e) => setAsciiColor(e.target.value)}
                        className="w-20 bg-black border border-[#f27200] text-[#f27200] text-xs p-1 font-mono uppercase text-center focus:outline-none"
                      />
                      <div className="w-6 h-6 border-2 border-[#f27200]" style={{ backgroundColor: asciiColor }} />
                    </div>
                  </div>
                  
                  {/* Hue Slider for quick color selection */}
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="1"
                    defaultValue="120" // Default green-ish
                    onChange={(e) => {
                      const hue = parseInt(e.target.value)
                      const color = `hsl(${hue}, 100%, 50%)`
                      setAsciiColor(color)
                    }}
                    className="w-full h-4 appearance-none border-2 border-[#333] mb-2 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-black"
                    style={{
                      background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)'
                    }}
                  />
                </div>

                {/* Character Size Slider - 10 discrete steps from 5px to 20px */}
                <div className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium uppercase text-xs">CHARACTER SIZE</span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          pushToHistory()
                          // Default to middle size (12-13px, level 5-6)
                          const pixelSize = 12
                          setAsciiDensity(Math.round(1000 / pixelSize))
                        }}
                        className="text-[10px] font-bold uppercase text-[#f27200] hover:text-white"
                        style={{ opacity: asciiDensity === 83 ? 0 : 1, pointerEvents: asciiDensity === 83 ? 'none' : 'auto' }}
                      >
                        RESET
                      </button>
                      {/* Display actual character height in pixels */}
                      <span className="text-[#f27200] font-semibold text-sm w-12 text-right">
                        {Math.round(1000 / asciiDensity)}px
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    // Map slider value (1-10) to pixel size (5-20)
                    // pixelSize = 3 + (sliderValue * 1.67) ≈ 5 to 20
                    // Actually simpler: pixelSize = 5 + (sliderValue - 1) * 1.67
                    // Even simpler: array mapping
                    value={(() => {
                      // Map current density to slider value
                      const pixelSize = Math.round(1000 / asciiDensity)
                      // Pixel sizes: 5, 7, 9, 11, 13, 15, 17, 19, 20, 20
                      // Map pixel to slider: 5->1, 7->2, 9->3, 11->4, 13->5, 15->6, 17->7, 19->8, 20->9
                      const pixelSizes = [5, 7, 9, 11, 13, 15, 17, 19, 20, 20]
                      const closestIndex = pixelSizes.reduce((prev, curr, idx) => 
                        Math.abs(curr - pixelSize) < Math.abs(pixelSizes[prev] - pixelSize) ? idx : prev
                      , 0)
                      return closestIndex + 1
                    })()}
                    onPointerDown={pushToHistory}
                    onChange={(e) => {
                      const sliderValue = parseInt(e.target.value)
                      // Map slider (1-10) to pixel sizes
                      const pixelSizes = [5, 7, 9, 11, 13, 15, 17, 19, 20, 20]
                      const pixelSize = pixelSizes[sliderValue - 1]
                      // Convert pixel size to density
                      const density = Math.round(1000 / pixelSize)
                      setAsciiDensity(density)
                    }}
                    className="w-full h-5 appearance-none bg-[#333] border-2 border-[#333] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-[#f27200] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-black"
                  />
                </div>
              </div>
            )}
            
            {/* DITHER CONTROLS - Only show if DITHER tool is active */}
            {currentTool === 'DITHER' && (
            <div className="border-2 border-[#f27200] p-3 bg-[#f27200] text-black">
              <div className="text-base font-semibold mb-3 uppercase tracking-wide border-b-2 border-black pb-2">
                DITHER
              </div>
              
              <select
                value={ditherAlgorithm}
                onChange={(e) => {
                  pushToHistory()
                  setDitherAlgorithm(parseInt(e.target.value))
                }}
                className="w-full bg-black text-white border-2 border-black p-2 font-bold text-sm uppercase mb-3"
              >
                {DITHER_ALGORITHMS.map(algo => (
                  <option key={algo.id} value={algo.id}>{algo.name}</option>
                ))}
              </select>

              <div className="mb-2">
                <div className="flex justify-between mb-1">
                  <span className="font-medium uppercase text-xs">STRENGTH</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        pushToHistory()
                        setDitherStrength(0.5)
                      }}
                      className="text-[10px] font-bold uppercase text-black hover:text-white"
                      style={{ opacity: ditherStrength === 0.5 ? 0 : 1, pointerEvents: ditherStrength === 0.5 ? 'none' : 'auto' }}
                    >
                      RESET
                    </button>
                    <span className="font-semibold text-sm w-8 text-right">{ditherStrength.toFixed(2)}</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0.15"
                  max="1"
                  step="0.01"
                  value={ditherStrength}
                  onPointerDown={pushToHistory}
                  onChange={(e) => setDitherStrength(parseFloat(e.target.value))}
                  className="w-full h-6 appearance-none bg-black border-4 border-black [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-black"
                />
              </div>

              <div className="mb-1">
                <div className="flex justify-between mb-1">
                  <span className="font-medium uppercase text-xs">SCALE</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        pushToHistory()
                        setDitherScale(1.0)
                      }}
                      className="text-[10px] font-bold uppercase text-black hover:text-white"
                      style={{ opacity: ditherScale === 1.0 ? 0 : 1, pointerEvents: ditherScale === 1.0 ? 'none' : 'auto' }}
                    >
                      RESET
                    </button>
                    <span className="font-semibold text-sm w-8 text-right">{ditherScale.toFixed(1)}x</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="4"
                  step="0.1"
                  value={ditherScale}
                  onPointerDown={pushToHistory}
                  onChange={(e) => setDitherScale(parseFloat(e.target.value))}
                  className="w-full h-6 appearance-none bg-black border-4 border-black [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-black"
                />
              </div>
            </div>
            )}

          </div>
        </div>


      </div>

      {/* FOOTER - BLACK */}
      <div className="absolute bottom-0 left-0 right-0 h-16 md:h-20 bg-black border-t-2 border-[#f27200] flex items-center justify-between px-4 md:px-6 pb-safe">
        <div className="flex items-center">
          <span className="text-white/50 text-xs md:text-sm font-bold uppercase tracking-widest">
            © 2025 MATTIA CAPOMAGI
          </span>
        </div>
        
        <div className="flex gap-3 md:gap-6">
          <button
            onClick={handleClearImage}
            disabled={!imageURL}
            className="bg-black text-white px-4 py-2 md:px-6 md:py-3 border-2 border-[#f27200] font-bold text-sm md:text-lg uppercase tracking-wider hover:bg-[#f27200] hover:text-black disabled:opacity-30 disabled:hover:bg-black disabled:hover:text-white"
          >
            CLEAR
          </button>
          <button
            onClick={() => {
              console.log('[UI] SAVE button CLICKED directly')
              console.log('[UI] imageURL:', imageURL)
              console.log('[UI] Button disabled?', !imageURL)
              handleExport()
            }}
            disabled={!imageURL}
            className="bg-[#f27200] text-black px-4 py-2 md:px-6 md:py-3 border-2 border-[#f27200] font-bold text-sm md:text-lg uppercase tracking-wider hover:bg-black hover:text-[#f27200] disabled:opacity-30 disabled:hover:bg-[#f27200]"
          >
            SAVE
          </button>
        </div>
      </div>
    </div>
  )
}
