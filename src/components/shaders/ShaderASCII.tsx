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
uniform vec2 uResolution;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  
  // 1. Pixelate / Grid Logic with SQUARE cells
  // uDensity defines the number of columns
  // Calculate rows to maintain square aspect ratio for cells
  float aspect = uResolution.y / uResolution.x;
  float cols = uDensity;
  float rows = uDensity * aspect;
  
  vec2 grid = vec2(cols, rows);
  vec2 cellUv = fract(uv * grid);
  vec2 gridUv = floor(uv * grid) / grid;
  
  // 2. Sample Input Luminance
  vec3 inputColor = texture2D(uTexture, gridUv + (0.5 / grid)).rgb;
  float gray = dot(inputColor, vec3(0.299, 0.587, 0.114));
  
  // 3. Map Luminance to Character
  float charIndex = floor(gray * 9.99);
  
  // 4. Calculate Character Texture UVs
  float charWidth = 1.0 / 10.0;
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
  const { size, camera } = useThree()
  
  const imageURL = useStore((state) => state.imageURL)
  const asciiDensity = useStore((state) => state.asciiDensity)
  const asciiColor = useStore((state) => state.asciiColor)
  const exportFormat = useStore((state) => state.exportFormat)
  
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
    // High resolution strip: 10 chars * 400px width = 4000px
    const charSize = 400
    const chars = " .:-=+*#%@"
    const width = charSize * chars.length
    const height = charSize
    
    canvas.width = width
    canvas.height = height
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Black background
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, height)
    
    // White text
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${charSize * 0.8}px 'Open Sans', sans-serif`
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
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.needsUpdate = true
    setCharTexture(tex)
    
  }, [])

  // 3. Uniforms
  const uniforms = useMemo(() => ({
    uTexture: { value: null },
    uCharTexture: { value: null },
    uDensity: { value: 120 },
    uColor: { value: new THREE.Color(0x00ff00) },
    uTransparent: { value: 0.0 },
    uResolution: { value: new THREE.Vector2(1, 1) }
  }), [])

  // 4. Update Loop
  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTexture.value = texture
      materialRef.current.uniforms.uCharTexture.value = charTexture
      materialRef.current.uniforms.uDensity.value = asciiDensity
      materialRef.current.uniforms.uColor.value.set(asciiColor)
      // If exporting as PNG_TRANSPARENT, set uTransparent to 1.0
      materialRef.current.uniforms.uTransparent.value = exportFormat === 'PNG_TRANSPARENT' ? 1.0 : 0.0
      materialRef.current.uniforms.uResolution.value.set(size.width, size.height)
    }
  })
  
  // Fit to screen logic
  useEffect(() => {
    if (texture && texture.image && controlsRef.current && camera) {
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
