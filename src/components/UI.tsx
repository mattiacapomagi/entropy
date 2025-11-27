import { useStore } from '../store'
import { useRef, useCallback, useState } from 'react'
import { Stage } from './Stage'

const DITHER_ALGORITHMS = [
  { id: 0, name: 'BAYER 2X2' },
  { id: 1, name: 'BAYER 4X4' },
  { id: 2, name: 'BAYER 8X8' },
  { id: 3, name: 'RANDOM' },
  { id: 4, name: 'CLUSTERED DOT' },
  { id: 5, name: 'HALFTONE DOT' },
  { id: 6, name: 'HALFTONE LINE' },
  { id: 7, name: 'CROSSHATCH' }
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
  const colorMode = useStore((state) => state.colorMode)
  const tintHue = useStore((state) => state.tintHue)
  const paletteColors = useStore((state) => state.paletteColors)
  
  const setDitherStrength = useStore((state) => state.setDitherStrength)
  const setDitherScale = useStore((state) => state.setDitherScale)
  const setDitherAlgorithm = useStore((state) => state.setDitherAlgorithm)
  const setBrightness = useStore((state) => state.setBrightness)
  const setContrast = useStore((state) => state.setContrast)
  const setSaturation = useStore((state) => state.setSaturation)
  const setGamma = useStore((state) => state.setGamma)
  const setVibrance = useStore((state) => state.setVibrance)
  const setColorMode = useStore((state) => state.setColorMode)
  const setTintHue = useStore((state) => state.setTintHue)
  const setPaletteColors = useStore((state) => state.setPaletteColors)
  const setIsExporting = useStore((state) => state.setIsExporting)
  const setImage = useStore((state) => state.setImage)
  const imageURL = useStore((state) => state.imageURL)
  
  const [customColorCount, setCustomColorCount] = useState(4)
  const [selectedPreset, setSelectedPreset] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = useCallback(() => setIsExporting(true), [setIsExporting])
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

  const hueToRGB = useCallback((hue: number) => {
    const h = hue / 60
    const c = 1
    const x = c * (1 - Math.abs((h % 2) - 1))
    let rgb = [0, 0, 0]
    if (h >= 0 && h < 1) rgb = [c, x, 0]
    else if (h >= 1 && h < 2) rgb = [x, c, 0]
    else if (h >= 2 && h < 3) rgb = [0, c, x]
    else if (h >= 3 && h < 4) rgb = [0, x, c]
    else if (h >= 4 && h < 5) rgb = [x, 0, c]
    else rgb = [c, 0, x]
    return `rgb(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)})`
  }, [])

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
      <div className="absolute inset-0 bg-black flex items-center justify-center text-white">
        <div className="border-[16px] border-white p-16 max-w-3xl w-full">
          <h1 className="text-8xl font-black mb-4 tracking-tight uppercase">ENTROPY</h1>
          <div className="text-[#f27200] text-3xl mb-16 tracking-widest font-black uppercase border-b-8 border-[#f27200] pb-4">
            SYSTEM v2.0
          </div>
          
          <div className="space-y-6">
            <button 
              onClick={() => setCurrentTool('DITHER')}
              className="w-full bg-white text-black text-4xl font-black py-8 hover:bg-[#f27200] hover:text-white border-4 border-black uppercase tracking-wider"
            >
              DITHER TOOL
            </button>
            
            <button 
              disabled
              className="w-full bg-black text-white/30 text-4xl font-black py-8 border-4 border-white/30 cursor-not-allowed uppercase tracking-wider"
            >
              GLITCH [LOCKED]
            </button>
            
            <button 
              disabled
              className="w-full bg-black text-white/30 text-4xl font-black py-8 border-4 border-white/30 cursor-not-allowed uppercase tracking-wider"
            >
              DATAMOSH [LOCKED]
            </button>
          </div>
        </div>
      </div>
    )
  }

  // DITHER TOOL
  return (
    <div className="absolute inset-0 bg-black">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* HEADER - BLACK */}
      <div className="h-20 bg-black border-b-8 border-[#f27200] flex items-center px-8">
        <div className="flex items-center gap-8">
          <button
            onClick={() => setCurrentTool('MENU')}
            className="text-white text-2xl font-black uppercase tracking-wider hover:text-[#f27200]"
          >
            ◄ MENU
          </button>
          <div className="text-[#f27200] text-3xl font-black uppercase tracking-widest">
            ENTROPY / DITHER
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="absolute top-20 bottom-24 left-0 right-0 flex">
        {/* SIDEBAR - BLACK */}
        <div className="w-96 bg-black border-r-8 border-[#f27200] overflow-y-auto scrollbar-hide">
          <div className="p-6 space-y-6">
            
            {/* COLOR */}
            <div className="border-4 border-[#f27200] p-4 bg-black text-white">
              <div className="text-xl font-bold mb-4 uppercase tracking-wider border-b-4 border-[#f27200] pb-2">
                COLOR
              </div>
              
              <select
                value={colorMode}
                onChange={(e) => setColorMode(parseInt(e.target.value))}
                className="w-full bg-[#f27200] text-black border-4 border-[#f27200] p-3 font-black text-lg uppercase"
              >
                {COLOR_MODES.map(mode => (
                  <option key={mode.id} value={mode.id}>{mode.name}</option>
                ))}
              </select>

              {colorMode === 2 && (
                <div className="mt-4">
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold uppercase text-sm">HUE</span>
                    <div className="w-12 h-6 border-4 border-[#f27200]" style={{ backgroundColor: hueToRGB(tintHue) }} />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={tintHue}
                    onChange={(e) => setTintHue(parseFloat(e.target.value))}
                    className="w-full h-8 appearance-none bg-[#333] border-4 border-[#333] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-[#f27200] [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-black"
                  />
                </div>
              )}

              {colorMode === 3 && (
                <div className="mt-4 space-y-4">
                  <select
                    value={selectedPreset}
                    onChange={(e) => {
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
                    className="w-full bg-[#f27200] text-black border-4 border-[#f27200] p-3 font-black text-lg uppercase"
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
                          className="bg-[#f27200] text-black border-4 border-[#f27200] p-2 font-black text-sm"
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
                        onChange={(e) => updatePaletteColor(index, e.target.value)}
                        className="w-full h-16 border-4 border-[#f27200] cursor-pointer"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ADJUST */}
            <div className="border-4 border-[#f27200] p-4 bg-black text-white">
              <div className="text-xl font-bold mb-4 uppercase tracking-wider border-b-4 border-[#f27200] pb-2">
                ADJUST
              </div>
              
              {[
                { label: 'BRIGHT', value: brightness, setter: setBrightness, min: 1, max: 100 },
                { label: 'CONTRAST', value: contrast, setter: setContrast, min: 1, max: 100 },
                { label: 'GAMMA', value: gamma, setter: setGamma, min: 1, max: 100 },
                { label: 'SATURATION', value: saturation, setter: setSaturation, min: 1, max: 100 },
                { label: 'VIBRANCE', value: vibrance, setter: setVibrance, min: 1, max: 100 },
              ].map(({ label, value, setter, min, max }) => (
                <div key={label} className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="font-semibold uppercase text-sm">{label}</span>
                    <span className="text-[#f27200] font-bold">{typeof value === 'number' ? value.toFixed(0) : value}</span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={1}
                    value={value}
                    onChange={(e) => setter(parseFloat(e.target.value))}
                    className="w-full h-6 appearance-none bg-[#333] border-4 border-[#333] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-[#f27200] [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-black"
                  />
                </div>
              ))}
            </div>

            {/* DITHER */}
            <div className="border-4 border-[#f27200] p-4 bg-[#f27200] text-black">
              <div className="text-xl font-bold mb-4 uppercase tracking-wider border-b-4 border-black pb-2">
                DITHER
              </div>
              
              <select
                value={ditherAlgorithm}
                onChange={(e) => setDitherAlgorithm(parseInt(e.target.value))}
                className="w-full bg-black text-white border-4 border-black p-3 font-black text-lg uppercase mb-4"
              >
                {DITHER_ALGORITHMS.map(algo => (
                  <option key={algo.id} value={algo.id}>{algo.name}</option>
                ))}
              </select>

              <div className="mb-3">
                <div className="flex justify-between mb-1">
                  <span className="font-semibold uppercase text-sm">STRENGTH</span>
                  <span className="font-bold">{ditherStrength.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.15"
                  max="1"
                  step="0.01"
                  value={ditherStrength}
                  onChange={(e) => setDitherStrength(parseFloat(e.target.value))}
                  className="w-full h-6 appearance-none bg-black border-4 border-black [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-black"
                />
              </div>

              <div className="mb-1">
                <div className="flex justify-between mb-1">
                  <span className="font-semibold uppercase text-sm">SCALE</span>
                  <span className="font-bold">{ditherScale.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="4"
                  step="0.1"
                  value={ditherScale}
                  onChange={(e) => setDitherScale(parseFloat(e.target.value))}
                  className="w-full h-6 appearance-none bg-black border-4 border-black [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-black"
                />
              </div>
            </div>

          </div>
        </div>

        {/* PREVIEW AREA */}
        <div className="flex-1 relative bg-black">
          {!imageURL ? (
            <div
              onClick={handleFileClick}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="absolute inset-0 flex flex-col items-center justify-center border-4 border-dashed border-[#f27200]/30 m-16 cursor-pointer hover:border-[#f27200]"
            >
              <div className="text-[#f27200] text-6xl font-black mb-8">↑</div>
              <div className="text-[#f27200] text-3xl font-black uppercase tracking-widest">DROP IMAGE</div>
              <div className="text-[#f27200]/50 text-xl font-black uppercase mt-4">OR CLICK</div>
            </div>
          ) : (
            <div className="absolute inset-0">
              <Stage />
            </div>
          )}
        </div>
      </div>

      {/* FOOTER - BLACK */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-black border-t-8 border-[#f27200] flex items-center justify-between px-8">
        <div className="flex items-center gap-6">
          <div className={`w-6 h-6 ${imageURL ? 'bg-[#f27200]' : 'bg-[#333]'} border-4 border-[#f27200]`} />
          <span className="text-white text-2xl font-black uppercase tracking-wider">
            {imageURL ? 'IMAGE LOADED' : 'NO IMAGE'}
          </span>
          <span className="text-white/30 text-xs font-normal ml-4">
            © MATTIA CAPOMAGI 2025
          </span>
        </div>
        
        <div className="flex gap-6">
          <button
            onClick={handleClearImage}
            disabled={!imageURL}
            className="bg-black text-white px-8 py-4 border-4 border-[#f27200] font-black text-xl uppercase tracking-wider hover:bg-[#f27200] hover:text-black disabled:opacity-30 disabled:hover:bg-black disabled:hover:text-white"
          >
            CLEAR
          </button>
          <button
            onClick={handleExport}
            disabled={!imageURL}
            className="bg-[#f27200] text-black px-8 py-4 border-4 border-[#f27200] font-black text-xl uppercase tracking-wider hover:bg-black hover:text-[#f27200] disabled:opacity-30 disabled:hover:bg-[#f27200]"
          >
            DOWNLOAD
          </button>
        </div>
      </div>
    </div>
  )
}
