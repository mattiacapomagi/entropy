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
uniform vec2 uResolution;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  
  // 1. Pixelate / Grid Logic
  // Calculate grid cell size
  vec2 grid = vec2(uDensity, uDensity * (uResolution.y / uResolution.x));
  vec2 cellUv = fract(uv * grid);
  vec2 gridUv = floor(uv * grid) / grid;
  
  // 2. Sample Input Luminance at grid center
  // We add 0.5/grid to sample the center of the block
  vec3 inputColor = texture2D(uTexture, gridUv + (0.5 / grid)).rgb;
  float gray = dot(inputColor, vec3(0.299, 0.587, 0.114));
  
  // 3. Map Luminance to Character
  // We have 10 characters in the strip: " .:-=+*#%@"
  // Map gray (0.0-1.0) to index (0.0-9.0)
  float charIndex = floor(gray * 9.99); // 0 to 9
  
  // 4. Calculate Character Texture UVs
  // The texture is a horizontal strip of 10 characters.
  // Each char is 0.1 width.
  // cellUv.x needs to be squashed to 0.1 and offset by charIndex * 0.1
  float charWidth = 1.0 / 10.0;
  vec2 charUv = vec2(
    (cellUv.x * charWidth) + (charIndex * charWidth),
    cellUv.y
  );
  
  // 5. Sample Character Texture
  vec4 charColor = texture2D(uCharTexture, charUv);
  
  // 6. Output
  // Multiply character alpha/white by the chosen terminal color
  // We assume the char texture is white text on transparent/black background
  // If procedural texture is black text on white, we might need to invert.
  // Let's assume we draw white text on black canvas.
  
  vec3 finalColor = uColor * charColor.r; // Use red channel as mask
  
  gl_FragColor = vec4(finalColor, 1.0);
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
    ctx.font = `bold ${charSize * 0.8}px monospace` // Slightly smaller than box to avoid clipping
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
    uResolution: { value: new THREE.Vector2(1, 1) }
  }), [])

  // 4. Update Loop
  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTexture.value = texture
      materialRef.current.uniforms.uCharTexture.value = charTexture
      materialRef.current.uniforms.uDensity.value = asciiDensity
      materialRef.current.uniforms.uColor.value.set(asciiColor)
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
