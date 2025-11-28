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

void main() {
  vec2 uv = vUv;
  
  // 1. Create TRULY SQUARE cells (in pixel space)
  // uDensity = number of columns
  float cols = uDensity;
  float cellSizeX = uResolution.x / cols; // width of one cell in pixels
  float rows = uResolution.y / cellSizeX;  // how many cells fit vertically (maintains square cells)
  
  vec2 grid = vec2(cols, rows);
  vec2 cellUv = fract(uv * grid);
  vec2 gridUv = floor(uv * grid) / grid;
  
  // 2. Sample Input Luminance
  vec3 inputColor = texture2D(uTexture, gridUv + (0.5 / grid)).rgb;
  float gray = dot(inputColor, vec3(0.299, 0.587, 0.114));
  
  // 3. Map Luminance to Character
  // Use exact character count from uniform
  float charIndex = floor(gray * (uCharCount - 0.01));
  
  // 4. Calculate Character Texture UVs
  float charWidth = 1.0 / uCharCount;
  vec2 charUv = vec2(
    (cellUv.x * charWidth) + (charIndex * charWidth),
    cellUv.y
  );
  
  // 5. Sample Character Texture
  vec4 charColor = texture2D(uCharTexture, charUv);
  
  // 6. Output
  // If transparent: Alpha = charColor.r (assuming white text on black/transparent)
  // If opaque: Mix black background with colored text
  
  vec3 finalColor = uColor * charColor.r;
  
  if (uTransparent > 0.5) {
     gl_FragColor = vec4(uColor, charColor.r);
  } else {
     gl_FragColor = vec4(finalColor, 1.0);
  }
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

  // 2. Generate Procedural Character Texture
  useEffect(() => {
    const canvas = document.createElement('canvas')
    // Full character set with letters, numbers, and symbols
    const chars = " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"
    const charSize = 64 // Reduced from 400 to avoid max texture size limits (64 * 69 = 4416px < 16384px)
    const width = charSize * chars.length
    const height = charSize
    
    canvas.width = width
    canvas.height = height
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Black background
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, height)
    
    // White text - reduced size to prevent clipping
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${charSize * 0.65}px 'Space Mono', monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    // Draw characters
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i]
      const x = (i * charSize) + (charSize / 2)
      const y = charSize / 2
      ctx.fillText(char, x, y)
    }
    
    const tex = new THREE.CanvasTexture(canvas)
    tex.minFilter = THREE.NearestFilter // Use Nearest for crisp pixel-perfect edges
    tex.magFilter = THREE.NearestFilter
    tex.needsUpdate = true
    setCharTexture(tex)
    
    // Update uniform with exact count
    if (materialRef.current) {
      materialRef.current.uniforms.uCharCount.value = chars.length
    }
    
  }, [])

  // 3. Uniforms
  const uniforms = useMemo(() => ({
    uTexture: { value: null },
    uCharTexture: { value: null },
    uDensity: { value: 120 },
    uColor: { value: new THREE.Color(0x00ff00) },
    uTransparent: { value: 0.0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uCharCount: { value: 69.0 } // Default, updated by useEffect
  }), [])

  // 4. Update Loop + Export Logic
  useFrame(({ gl, scene }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTexture.value = texture
      materialRef.current.uniforms.uCharTexture.value = charTexture
      materialRef.current.uniforms.uDensity.value = asciiDensity
      materialRef.current.uniforms.uColor.value.set(asciiColor)
      // Always use transparency for Terminal (export will always be transparent PNG)
      materialRef.current.uniforms.uTransparent.value = 1.0
      materialRef.current.uniforms.uResolution.value.set(size.width, size.height)
    }
    
    // EXPORT LOGIC
    if (isExporting && texture && texture.image && exportCameraRef.current) {
      console.log('[SHADER_ASCII] Export triggered!')
      console.log('[SHADER_ASCII] texture:', texture)
      console.log('[SHADER_ASCII] texture.image:', texture.image)
      
      const img = texture.image as HTMLImageElement
      const originalWidth = img.width
      const originalHeight = img.height
      
      console.log('[SHADER_ASCII] Image dimensions:', { originalWidth, originalHeight })
      
      // Configure export camera to match image dimensions exactly
      const cam = exportCameraRef.current
      cam.left = -originalWidth / 2
      cam.right = originalWidth / 2
      cam.top = originalHeight / 2
      cam.bottom = -originalHeight / 2
      cam.updateProjectionMatrix()
      
      // Temporarily resize canvas to original image size
      const currentWidth = size.width
      const currentHeight = size.height
      gl.setSize(originalWidth, originalHeight, false)
      
      // Render at original size using export camera
      gl.render(scene, cam)
      
      try {
        console.log('[SHADER_ASCII] Creating PNG blob...')
        gl.domElement.toBlob((blob) => {
          if (!blob) {
            console.error('[SHADER_ASCII] Failed to create blob')
            return
         }
          
          console.log('[SHADER_ASCII] Blob created, size:', blob.size)
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          
          const now = new Date()
          const timestamp = now.getTime().toString().slice(-6)
          
          link.download = `entropy_terminal_${timestamp}.png`
          link.href = url
          document.body.appendChild(link)
          console.log('[SHADER_ASCII] Triggering download...')
          link.click()
          document.body.removeChild(link)
          
          setTimeout(() => URL.revokeObjectURL(url), 100)
          console.log('[SHADER_ASCII] Download complete')
        }, 'image/png', 1.0)
      } catch (error) {
        console.error('[SHADER_ASCII] Export failed:', error)
      }
      
      // Restore canvas size
      gl.setSize(currentWidth, currentHeight, false)
      setIsExporting(false)
      console.log('[SHADER_ASCII] Export process finished')
    }
  })
  
  // Fit to screen logic
  useEffect(() => {
    if (texture && texture.image && controlsRef.current && camera) {
       // Only fit if this is a new texture
       if (lastFittedTextureRef.current === texture.uuid) return
       
       lastFittedTextureRef.current = texture.uuid
       
       const img = texture.image as HTMLImageElement
       const padding = 0.9
       const zoomWidth = (size.width * padding) / img.width
       const zoomHeight = (size.height * padding) / img.height
       const newZoom = Math.min(zoomWidth, zoomHeight)
       
       const orthoCam = camera as THREE.OrthographicCamera
       // eslint-disable-next-line
       orthoCam.zoom = newZoom
       orthoCam.updateProjectionMatrix()
       
       if (controlsRef.current) {
         controlsRef.current.minZoom = newZoom * 0.9
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
