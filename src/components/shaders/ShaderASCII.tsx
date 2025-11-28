import { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MapControls, OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../../store'

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
uniform sampler2D uTexture;
uniform sampler2D uCharTexture;
uniform float uDensity;
uniform vec3 uColor;
uniform float uTransparent; // 0.0 = Opaque Black, 1.0 = Transparent
uniform float uCharCount;
uniform vec2 uResolution;
uniform vec2 uGridDims; // (cols, rows)
varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  
  // 1. Create TRULY SQUARE cells (in pixel space)
  float cols = uDensity;
  float cellSizeX = uResolution.x / cols;
  float rows = uResolution.y / cellSizeX;
  
  vec2 grid = vec2(cols, rows);
  vec2 cellUv = fract(uv * grid);
  vec2 gridUv = floor(uv * grid) / grid;
  
  // 2. Sample Input Luminance
  vec3 inputColor = texture2D(uTexture, gridUv + (0.5 / grid)).rgb;
  float gray = dot(inputColor, vec3(0.299, 0.587, 0.114));
  
  // 3. Map Luminance to Character Index
  float charIndex = floor(gray * (uCharCount - 0.01));
  
  // 4. Calculate Atlas UVs
  // Grid logic: col = index % cols, row = floor(index / cols)
  float atlasCol = mod(charIndex, uGridDims.x);
  float atlasRow = floor(charIndex / uGridDims.x);
  
  // Flip Y logic: Canvas (0,0) is Top-Left. Texture UV (0,1) is Top-Left.
  // So Row 0 is at the TOP (high V).
  // We need to invert the row index for UV calculation
  float invertedRow = uGridDims.y - 1.0 - atlasRow;
  
  vec2 charUv = vec2(
    (atlasCol + cellUv.x) / uGridDims.x,
    (invertedRow + cellUv.y) / uGridDims.y
  );
  
  // 5. Sample Character Texture
  vec4 charColor = texture2D(uCharTexture, charUv);
  
  // 6. Final Color
  // charColor.r is the mask (white text on black bg)
  float mask = charColor.r;
  
  vec3 finalColor = uColor * mask;
  float alpha = 1.0;
  
  // uTransparent: 0.0 = Black BG, 1.0 = Transparent BG, 2.0 = White BG
  if (uTransparent > 1.5) {
    // WHITE BACKGROUND
    // If mask is 1 (text), use uColor. If mask is 0 (bg), use White.
    finalColor = mix(vec3(1.0), uColor, mask);
  } else if (uTransparent > 0.5) {
    // TRANSPARENT BACKGROUND
    alpha = mask;
  } else {
    // BLACK BACKGROUND (Default)
    // Already set: finalColor is colored text on black (0,0,0)
  }

  gl_FragColor = vec4(finalColor, alpha);
}
`

export function ShaderASCII() {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null)
  const exportCameraRef = useRef<THREE.OrthographicCamera>(null)
  const lastFittedTextureRef = useRef<string | null>(null)
  const { size, camera } = useThree()
  
  const imageURL = useStore((state) => state.imageURL)
  const asciiDensity = useStore((state) => state.asciiDensity)
  const asciiColor = useStore((state) => state.asciiColor)
  const asciiBgMode = useStore((state) => state.asciiBgMode)
  const isExporting = useStore((state) => state.isExporting)
  const setIsExporting = useStore((state) => state.setIsExporting)
  
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const [charTexture, setCharTexture] = useState<THREE.Texture | null>(null)

  // 1. Load Image Texture
  useEffect(() => {
    if (!imageURL) return
    const loader = new THREE.TextureLoader()
    loader.load(imageURL, (tex) => {
      tex.minFilter = THREE.LinearFilter
      tex.magFilter = THREE.LinearFilter
      setTexture(tex)
    })
  }, [imageURL])

  // 2. Generate Procedural Character Texture (High-Res Atlas)
  useEffect(() => {
    const canvas = document.createElement('canvas')
    const chars = " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"
    
    // High resolution for crisp export (512px per char)
    const charSize = 512 
    
    // Grid layout (Atlas)
    const cols = 8
    const rows = Math.ceil(chars.length / cols)
    
    const width = cols * charSize
    const height = rows * charSize
    
    canvas.width = width
    canvas.height = height
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Black background
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, height)
    
    // White text
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${charSize * 0.65}px 'Space Mono', monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    // Draw characters in grid
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i]
      
      const col = i % cols
      const row = Math.floor(i / cols)
      
      const x = (col * charSize) + (charSize / 2)
      const y = (row * charSize) + (charSize / 2)
      
      ctx.fillText(char, x, y)
    }
    
    const tex = new THREE.CanvasTexture(canvas)
    tex.minFilter = THREE.LinearMipmapLinearFilter // Use Mipmaps for smooth downscaling (anti-aliasing)
    tex.magFilter = THREE.LinearFilter
    tex.generateMipmaps = true
    tex.needsUpdate = true
    setCharTexture(tex)
    
    // Update uniforms
    if (materialRef.current) {
      materialRef.current.uniforms.uCharCount.value = chars.length
      materialRef.current.uniforms.uGridDims.value.set(cols, rows)
    }
    
  }, [])

  // 3. Uniforms
  const uniforms = useMemo(() => ({
    uTexture: { value: null },
    uCharTexture: { value: null },
    uDensity: { value: 120 },
    uColor: { value: new THREE.Color(0x00ff00) },
    uTransparent: { value: 1.0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uCharCount: { value: 69.0 },
    uGridDims: { value: new THREE.Vector2(8, 9) }
  }), [])

  // 4. Update Loop + Export Logic
  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTexture.value = texture
      materialRef.current.uniforms.uCharTexture.value = charTexture
      materialRef.current.uniforms.uDensity.value = asciiDensity
      materialRef.current.uniforms.uColor.value.set(asciiColor)
      
      // Update transparency based on mode
      // 0.0 = Opaque (Black), 1.0 = Transparent, 2.0 = White (Need to update shader for this)
      // For now, let's just toggle transparency. If White, we need shader support.
      // Actually, let's keep shader simple: 
      // If TRANSPARENT -> uTransparent = 1.0
      // If BLACK -> uTransparent = 0.0
      // If WHITE -> We need to handle this.
      
      // Let's update the shader code to handle background color properly.
      // But for now, let's just map:
      // TRANSPARENT -> 1.0
      // BLACK -> 0.0
      // WHITE -> 0.0 (but we need to change clear color? No, shader draws background)
      
      // Wait, the shader draws black background by default.
      // Let's update shader code in next step.
      // For now, pass mode as float: 0=Black, 1=Transparent, 2=White
      let bgMode = 0.0
      if (asciiBgMode === 'TRANSPARENT') bgMode = 1.0
      if (asciiBgMode === 'WHITE') bgMode = 2.0
      
      materialRef.current.uniforms.uTransparent.value = bgMode
      materialRef.current.uniforms.uResolution.value.set(size.width, size.height)
    }
    
    // EXPORT LOGIC
    if (isExporting && texture && texture.image) {
      console.log('[SHADER_ASCII] Export triggered (Native Canvas Mode)!')
      
      const img = texture.image as HTMLImageElement
      const originalWidth = img.width
      const originalHeight = img.height
      const aspect = originalHeight / originalWidth
      
      // 1. Calculate Grid Dimensions
      const cols = asciiDensity
      const rows = Math.round(cols * aspect)
      
      // 2. Create Source Canvas (for sampling pixel data)
      const sourceCanvas = document.createElement('canvas')
      sourceCanvas.width = cols
      sourceCanvas.height = rows
      const sourceCtx = sourceCanvas.getContext('2d')
      if (!sourceCtx) return
      
      // Draw image scaled down to grid size (one pixel per character)
      sourceCtx.drawImage(img, 0, 0, cols, rows)
      const imgData = sourceCtx.getImageData(0, 0, cols, rows).data
      
      // 3. Create Export Canvas
      // Target resolution: ensure high quality (e.g. 64px per char)
      // Cap max width to 8192px to prevent browser crashes
      const maxDim = 8192
      let pixelsPerChar = 64
      let exportWidth = cols * pixelsPerChar
      
      if (exportWidth > maxDim) {
        exportWidth = maxDim
        pixelsPerChar = exportWidth / cols
      }
      
      const exportHeight = rows * pixelsPerChar
      
      const exportCanvas = document.createElement('canvas')
      exportCanvas.width = exportWidth
      exportCanvas.height = exportHeight
      const ctx = exportCanvas.getContext('2d')
      if (!ctx) return
      
      // 4. Render Characters
      // Clear with correct background
      ctx.clearRect(0, 0, exportWidth, exportHeight)
      
      if (asciiBgMode === 'BLACK') {
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, exportWidth, exportHeight)
      } else if (asciiBgMode === 'WHITE') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, exportWidth, exportHeight)
      }
      // If TRANSPARENT, we just leave it cleared
      
      // Setup Font
      // Use a slightly smaller font size (0.65x) to match the look on screen and prevent clipping
      const fontSize = pixelsPerChar * 0.65
      ctx.font = `bold ${fontSize}px 'Space Mono', monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = asciiColor // Use the selected color
      
      const chars = " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"
      
      console.log('[SHADER_ASCII] Rendering to canvas...', { cols, rows, exportWidth, exportHeight })
      
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4
          const r = imgData[i]
          const g = imgData[i + 1]
          const b = imgData[i + 2]
          // const a = imgData[i + 3] // Ignore alpha for now, assume opaque image
          
          // Calculate Luminance
          const gray = (0.299 * r + 0.587 * g + 0.114 * b) / 255
          
          // Map to Character
          const charIndex = Math.floor(gray * (chars.length - 0.01))
          const char = chars[charIndex]
          
          // Draw Character
          const posX = (x * pixelsPerChar) + (pixelsPerChar / 2)
          const posY = (y * pixelsPerChar) + (pixelsPerChar / 2)
          
          ctx.fillText(char, posX, posY)
        }
      }
      
      // 5. Download
      exportCanvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `entropy_ascii_${Date.now()}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        console.log('[SHADER_ASCII] Download complete')
      }, 'image/png')
      
      setIsExporting(false)
    }
  })
  
  // Fit to screen logic
  useEffect(() => {
    if (texture && texture.image && controlsRef.current && camera) {
       // Only fit if this is a new texture
       if (lastFittedTextureRef.current === texture.uuid) return
       
       lastFittedTextureRef.current = texture.uuid
       
       const img = texture.image as HTMLImageElement
       // Use smaller padding to ensure full visibility (0.8 instead of 0.9)
       const padding = 0.8
       const zoomWidth = (size.width * padding) / img.width
       const zoomHeight = (size.height * padding) / img.height
       const newZoom = Math.min(zoomWidth, zoomHeight)
       
       const orthoCam = camera as THREE.OrthographicCamera
       // eslint-disable-next-line
       orthoCam.zoom = newZoom
       orthoCam.updateProjectionMatrix()
       
       if (controlsRef.current) {
         controlsRef.current.minZoom = newZoom * 0.5 // Allow zooming out more
         controlsRef.current.reset()
         controlsRef.current.object.zoom = newZoom
         controlsRef.current.object.updateProjectionMatrix()
       }
    }
  }, [texture, size, camera])

  if (!texture || !charTexture) return null
  
  const meshWidth = (texture?.image as HTMLImageElement)?.width || 1
  const meshHeight = (texture?.image as HTMLImageElement)?.height || 1

  return (
    <>
      <OrthographicCamera 
        makeDefault 
        position={[0, 0, 10]} 
        zoom={1}
        near={0.1}
        far={1000}
      />
      
      {/* Dedicated camera for export - matches image dimensions exactly */}
      <OrthographicCamera
        ref={exportCameraRef}
        position={[0, 0, 10]}
        zoom={1}
        near={0.1}
        far={1000}
      />
      
      <MapControls 
        ref={controlsRef}
        enableRotate={false} 
        enableDamping={false}
        screenSpacePanning={true}
        minZoom={0.1}
        maxZoom={10}
      />

      <mesh ref={meshRef} scale={[meshWidth, meshHeight, 1]}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent={true}
        />
      </mesh>
    </>
  )
}
