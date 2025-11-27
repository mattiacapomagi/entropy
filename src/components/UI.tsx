import { useStore } from '../store'
import { useRef, useCallback, useState } from 'react'
import { Stage } from './Stage'

const DITHER_ALGORITHMS = [
  { id: 0, name: 'Bayer 2x2 (Sharp)' },
  { id: 1, name: 'Bayer 4x4 (Balanced)' },
  { id: 2, name: 'Bayer 8x8 (Smooth)' },
  { id: 3, name: 'Random (Noisy)' },
  { id: 4, name: 'Clustered Dot (Halftone)' },
  { id: 5, name: 'Halftone Dot (Round)' },
  { id: 6, name: 'Halftone Line (Scan)' },
  { id: 7, name: 'Crosshatch (Sketch)' }
]

const COLOR_MODES = [
  { id: 0, name: 'Full Color' },
  { id: 1, name: 'Grayscale' },
  { id: 2, name: 'Tint (Custom)' },
  { id: 3, name: 'Multicolor (4-Color Palette)' }
]

const PALETTE_PRESETS = [
  { name: 'Retro Coffee', colors: ['#0d080d', '#4f2b24', '#825b31', '#c59154'] },
  { name: 'Gameboy', colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'] },
  { name: 'Gameboy Pocket', colors: ['#c4cfa1', '#8b956d', '#4d533c', '#1f1f1f'] },
  { name: 'CGA', colors: ['#000000', '#55ffff', '#ff55ff', '#ffffff'] },
  { name: 'CGA 2', colors: ['#000000', '#00aaaa', '#aa0000', '#aaaaaa'] },
  { name: 'Cyberpunk', colors: ['#0d0221', '#261447', '#ff005c', '#00f0ff'] },
  { name: 'Vaporwave', colors: ['#2c2137', '#76448a', '#b967ff', '#62f6ff'] },
  { name: 'Matrix', colors: ['#000000', '#003b00', '#008f11', '#00ff41'] },
  { name: 'Sepia', colors: ['#2e1d0e', '#6b4826', '#b08d55', '#e8dcb5'] },
  { name: 'Black & White', colors: ['#000000', '#555555', '#aaaaaa', '#ffffff'] },
  { name: '2-Bit Gray', colors: ['#000000', '#666666', '#b3b3b3', '#ffffff'] },
  { name: 'Midnight', colors: ['#000000', '#1a1a2e', '#16213e', '#0f3460'] },
  { name: 'Sunset', colors: ['#2d1b2e', '#b0305c', '#eb564b', '#f2d492'] },
  { name: 'Deep Sea', colors: ['#000000', '#001e1d', '#004e4a', '#008f8c'] },
  { name: 'Hotline', colors: ['#2b0f54', '#ab20fd', '#ff0055', '#ff9900'] },
  { name: 'Toxic', colors: ['#0d1b06', '#2f4d12', '#648c1f', '#99cc33'] },
  { name: 'Candy', colors: ['#2a0928', '#7a1c5d', '#c24285', '#ff9ecf'] },
]

// Collapsible Section Component
function CollapsibleSection({ 
  title, 
  children, 
  defaultOpen = true 
}: { 
  title: string
  children: React.ReactNode
  defaultOpen?: boolean 
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  
  return (
    <div className="border-b-2 border-gray-800 pb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center text-[#f27200] text-xs font-bold mb-3 hover:text-white transition-colors uppercase"
        aria-expanded={isOpen}
      >
        <span>/// {title}</span>
        <span className="text-white text-lg transition-transform duration-200" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▶
        </span>
      </button>
      <div 
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ 
          maxHeight: isOpen ? '1000px' : '0',
          opacity: isOpen ? 1 : 0
        }}
      >
        <div className="space-y-4">
          {children}
        </div>
      </div>
    </div>
  )
}

export function LabOverlay() {
  const currentTool = useStore((state) => state.currentTool)
  const setCurrentTool = useStore((state) => state.setCurrentTool)
  
  // Dither Tool State
  const ditherStrength = useStore((state) => state.ditherStrength)
  const ditherAlgorithm = useStore((state) => state.ditherAlgorithm)
  const brightness = useStore((state) => state.brightness)
  const contrast = useStore((state) => state.contrast)
  const saturation = useStore((state) => state.saturation)
  const gamma = useStore((state) => state.gamma)
  const vibrance = useStore((state) => state.vibrance)
  const aberration = useStore((state) => state.aberration)
  const colorMode = useStore((state) => state.colorMode)
  const tintHue = useStore((state) => state.tintHue)
  const paletteColors = useStore((state) => state.paletteColors)
  
  // Setters
  const setDitherStrength = useStore((state) => state.setDitherStrength)
  const setDitherAlgorithm = useStore((state) => state.setDitherAlgorithm)
  const setBrightness = useStore((state) => state.setBrightness)
  const setContrast = useStore((state) => state.setContrast)
  const setSaturation = useStore((state) => state.setSaturation)
  const setGamma = useStore((state) => state.setGamma)
  const setVibrance = useStore((state) => state.setVibrance)
  const setAberration = useStore((state) => state.setAberration)
  const setColorMode = useStore((state) => state.setColorMode)
  const setTintHue = useStore((state) => state.setTintHue)
  const setPaletteColors = useStore((state) => state.setPaletteColors)
  const setIsExporting = useStore((state) => state.setIsExporting)
  const setImage = useStore((state) => state.setImage)
  const imageURL = useStore((state) => state.imageURL)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = useCallback(() => setIsExporting(true), [setIsExporting])
  const handleFileClick = useCallback(() => fileInputRef.current?.click(), [])

  const loadImageFile = useCallback((file: File) => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        setImage(url, img.width, img.height)
      }
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

  const handleClearImage = useCallback(() => setImage(null, 0, 0), [setImage])

  // MAIN MENU VIEW
  if (currentTool === 'MENU') {
    return (
      <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center font-mono text-white">
        <div className="border-4 border-white p-12 max-w-2xl w-full text-center">
          <h1 className="text-6xl font-bold mb-2 tracking-tighter">ENTROPY</h1>
          <div className="text-[#f27200] text-xl mb-12 tracking-widest">MULTITOOL SYSTEM v2.0</div>
          
          <div className="space-y-4">
            <button 
              onClick={() => setCurrentTool('DITHER')}
              className="w-full bg-white text-black text-2xl font-bold py-4 hover:bg-[#f27200] hover:text-white transition-all duration-200 border-4 border-transparent hover:border-white uppercase transform hover:scale-[1.02]"
            >
              [ DITHER TOOL ]
            </button>
            
            <button 
              disabled
              className="w-full bg-gray-900 text-gray-500 text-2xl font-bold py-4 border-4 border-gray-800 cursor-not-allowed uppercase opacity-50"
            >
              [ GLITCH TOOL ] (LOCKED)
            </button>
            
            <button 
              disabled
              className="w-full bg-gray-900 text-gray-500 text-2xl font-bold py-4 border-4 border-gray-800 cursor-not-allowed uppercase opacity-50"
            >
              [ DATA MOSH ] (LOCKED)
            </button>
          </div>
          
          <div className="mt-12 text-xs text-gray-500">
            SYSTEM READY // WAITING FOR INPUT
          </div>
        </div>
      </div>
    )
  }

  // DITHER TOOL VIEW
  return (
    <div className="absolute inset-0">
      {/* Fullscreen drag and drop zone */}
      <div 
        className="absolute inset-0 z-10"
        style={{ pointerEvents: imageURL ? 'none' : 'auto' }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      />

      <div className="absolute inset-0 pointer-events-none flex flex-col p-4 z-20 font-mono text-white">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Navbar */}
        <div className="flex justify-between items-center w-full bg-black border-4 border-white p-3 pointer-events-auto mb-4 transition-shadow hover:shadow-lg hover:shadow-white/20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setCurrentTool('MENU')}
              className="text-sm hover:text-[#f27200] border-r-2 border-white pr-4 mr-2 transition-all duration-200 hover:scale-110"
              aria-label="Back to menu"
            >
              ◄ MENU
            </button>
            <div className="text-lg font-bold uppercase tracking-wider">
              ◆ DITHER TOOL ◆
            </div>
          </div>
          <button 
            onClick={handleFileClick}
            className="bg-white text-black px-4 py-2 border-4 border-black font-bold uppercase hover:bg-[#f27200] hover:text-white transition-all duration-200 transform hover:scale-105"
            aria-label="Upload image"
          >
            [UPLOAD]
          </button>
        </div>

        {/* Controls */}
        <div className="flex-grow flex gap-4 overflow-hidden">
          <div className="w-80 bg-black border-4 border-white p-4 pointer-events-auto space-y-4 overflow-y-auto max-h-full scrollbar-hide">
            <h2 className="text-lg font-bold uppercase border-b-4 border-white pb-2 mb-4">
              ▼ CONTROLS
            </h2>
            
            {/* COLOR SETTINGS */}
            <CollapsibleSection title="Color Settings" defaultOpen={true}>
              <div className="space-y-1">
                <label className="uppercase text-sm font-bold block">Color Mode</label>
                <select
                  value={colorMode}
                  onChange={(e) => setColorMode(parseInt(e.target.value))}
                  className="w-full bg-black text-white border-2 border-white p-2 font-mono uppercase cursor-pointer hover:border-[#f27200] transition-colors"
                  aria-label="Color mode"
                >
                  {COLOR_MODES.map(mode => (
                    <option key={mode.id} value={mode.id}>
                      {mode.name}
                    </option>
                  ))}
                </select>
              </div>

              {colorMode === 2 && (
                <div className="space-y-1 animate-fadeIn">
                  <div className="flex justify-between text-sm">
                    <label className="uppercase">Tint Hue</label>
                    <div 
                      className="w-8 h-4 border-2 border-white transition-all" 
                      style={{ backgroundColor: hueToRGB(tintHue) }}
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="1"
                    value={tintHue}
                    onChange={(e) => setTintHue(parseFloat(e.target.value))}
                    className="w-full h-6 bg-black appearance-none cursor-pointer border-2 border-white [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
                    style={{
                      background: `linear-gradient(to right, rgb(255,0,0), rgb(255,255,0), rgb(0,255,0), rgb(0,255,255), rgb(0,0,255), rgb(255,0,255), rgb(255,0,0))`
                    }}
                    aria-label="Tint hue"
                  />
                </div>
              )}

              {colorMode === 3 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="space-y-1">
                    <label className="uppercase text-sm font-bold block">Presets</label>
                    <select
                      onChange={(e) => {
                        const preset = PALETTE_PRESETS.find(p => p.name === e.target.value)
                        if (preset) setPaletteColors(preset.colors)
                      }}
                      className="w-full bg-black text-white border-2 border-white p-2 font-mono uppercase cursor-pointer hover:border-[#f27200] transition-colors"
                      aria-label="Palette presets"
                    >
                      <option value="">-- Select Preset --</option>
                      {PALETTE_PRESETS.map(p => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="uppercase text-sm font-bold block">Palette (Dark → Light)</label>
                    <div className="flex justify-between gap-2">
                      {paletteColors.map((color, index) => (
                        <div key={index} className="flex flex-col items-center gap-1 w-full">
                          <input
                            type="color"
                            value={color}
                            onChange={(e) => updatePaletteColor(index, e.target.value)}
                            className="w-full h-8 p-0 border-2 border-white bg-black cursor-pointer transition-transform hover:scale-110"
                            aria-label={`Palette color ${index + 1}`}
                          />
                          <span className="text-[10px] uppercase text-gray-400">{index + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CollapsibleSection>

            {/* IMAGE ADJUSTMENTS */}
            <CollapsibleSection title="Image Adjustments" defaultOpen={false}>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <label className="uppercase">Brightness</label>
                  <span className="text-[#f27200] font-bold">{brightness}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={brightness}
                  onChange={(e) => setBrightness(parseFloat(e.target.value))}
                  className="w-full h-6 bg-black appearance-none cursor-pointer border-2 border-white [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
                  aria-label="Brightness"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <label className="uppercase">Contrast</label>
                  <span className="text-[#f27200] font-bold">{contrast}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={contrast}
                  onChange={(e) => setContrast(parseFloat(e.target.value))}
                  className="w-full h-6 bg-black appearance-none cursor-pointer border-2 border-white [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
                  aria-label="Contrast"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <label className="uppercase">Gamma</label>
                  <span className="text-[#f27200] font-bold">{gamma}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={gamma}
                  onChange={(e) => setGamma(parseFloat(e.target.value))}
                  className="w-full h-6 bg-black appearance-none cursor-pointer border-2 border-white [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
                  aria-label="Gamma"
                />
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <label className="uppercase">Saturation</label>
                  <span className="text-[#f27200] font-bold">{saturation}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={saturation}
                  onChange={(e) => setSaturation(parseFloat(e.target.value))}
                  className="w-full h-6 bg-black appearance-none cursor-pointer border-2 border-white [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
                  aria-label="Saturation"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <label className="uppercase">Vibrance</label>
                  <span className="text-[#f27200] font-bold">{vibrance}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={vibrance}
                  onChange={(e) => setVibrance(parseFloat(e.target.value))}
                  className="w-full h-6 bg-black appearance-none cursor-pointer border-2 border-white [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
                  aria-label="Vibrance"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <label className="uppercase">Aberration</label>
                  <span className="text-[#f27200] font-bold">{aberration.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={aberration}
                  onChange={(e) => setAberration(parseFloat(e.target.value))}
                  className="w-full h-6 bg-black appearance-none cursor-pointer border-2 border-white [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
                  aria-label="Chromatic aberration"
                />
              </div>
            </CollapsibleSection>

            {/* DITHERING */}
            <CollapsibleSection title="Dithering" defaultOpen={true}>
              <div className="space-y-1">
                <label className="uppercase text-sm font-bold block">Algorithm</label>
                <select
                  value={ditherAlgorithm}
                  onChange={(e) => setDitherAlgorithm(parseInt(e.target.value))}
                  className="w-full bg-black text-white border-2 border-white p-2 font-mono uppercase cursor-pointer hover:border-[#f27200] transition-colors"
                  aria-label="Dithering algorithm"
                >
                  {DITHER_ALGORITHMS.map(algo => (
                    <option key={algo.id} value={algo.id}>
                      {algo.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <label className="uppercase">Strength</label>
                  <span className="text-[#f27200] font-bold">{ditherStrength.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={ditherStrength}
                  onChange={(e) => setDitherStrength(parseFloat(e.target.value))}
                  className="w-full h-6 bg-black appearance-none cursor-pointer border-2 border-white [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
                  aria-label="Dithering strength"
                />
              </div>
            </CollapsibleSection>
          </div>

          {/* CANVAS AREA */}
          {!imageURL ? (
            <div
              onClick={handleFileClick}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/20 hover:border-white/40 hover:bg-white/5 transition-all duration-300 cursor-pointer group"
              role="button"
              tabIndex={0}
              aria-label="Upload image area"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/50 mb-4 group-hover:text-white/70 transition-colors group-hover:scale-110 transform duration-200">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" x2="12" y1="3" y2="15"/>
              </svg>
              <p className="text-white/50 text-center font-mono text-sm group-hover:text-white/70 transition-colors">
                DRAG & DROP OR CLICK TO UPLOAD
              </p>
            </div>
          ) : (
            <div className="flex-1 relative overflow-hidden flex flex-col bg-black">
              <div className="flex-1 relative">
                <Stage />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center w-full bg-black border-4 border-white p-3 pointer-events-auto mt-4 transition-shadow hover:shadow-lg hover:shadow-white/20">
          <div className="text-sm flex items-center gap-2">
            <span className={`inline-block w-2 h-2 ${imageURL ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
            {imageURL ? '■ IMAGE LOADED' : '□ NO IMAGE'}
          </div>
          <div className="flex gap-4">
            <button 
              onClick={handleClearImage}
              disabled={!imageURL}
              className="bg-black text-white px-6 py-2 border-4 border-white font-bold uppercase hover:bg-white hover:text-black transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 disabled:hover:scale-100"
              aria-label="Clear image"
            >
              [CLEAR]
            </button>
            <button 
              onClick={handleExport}
              disabled={!imageURL}
              className="bg-[#f27200] text-white px-6 py-2 border-4 border-white font-bold uppercase hover:bg-white hover:text-black transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 disabled:hover:scale-100"
              aria-label="Download processed image"
            >
              [DOWNLOAD] 
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
