import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { useStore } from '../store'

// Vertex Shader
const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// Fragment Shader
const fragmentShader = `
uniform float uTime;
uniform sampler2D uTexture;
uniform float uEntropyLevel;
uniform float uNoiseScale;
uniform float uSeed;
uniform vec2 uResolution;
uniform vec2 uImageResolution;

varying vec2 vUv;

// Simplex 2D noise
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = vUv;
  
  // Aspect Ratio Correction (Cover)
  vec2 ratio = vec2(
    min((uResolution.x / uResolution.y) / (uImageResolution.x / uImageResolution.y), 1.0),
    min((uResolution.y / uResolution.x) / (uImageResolution.y / uImageResolution.x), 1.0)
  );
  
  vec2 uvCover = vec2(
    vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
    vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
  );

  // Noise Generation
  float noise = snoise(uvCover * uNoiseScale + uTime * 0.1 + uSeed);
  
  // Displacement
  vec2 displacement = vec2(noise * 0.01 * uEntropyLevel, noise * 0.01 * uEntropyLevel);
  vec2 distortedUv = uvCover + displacement;

  // Chromatic Aberration
  float aberration = 0.02 * uEntropyLevel;
  float r = texture2D(uTexture, distortedUv + vec2(aberration, 0.0)).r;
  float g = texture2D(uTexture, distortedUv).g;
  float b = texture2D(uTexture, distortedUv - vec2(aberration, 0.0)).b;

  // Scanlines (optional, based on entropy)
  float scanline = sin(uvCover.y * 800.0 + uTime * 5.0) * 0.1 * uEntropyLevel;
  vec3 color = vec3(r, g, b) - scanline;

  // Grain
  float grain = (fract(sin(dot(uvCover, vec2(12.9898, 78.233) * uTime)) * 43758.5453) - 0.5) * 0.2 * uEntropyLevel;
  color += grain;

  gl_FragColor = vec4(color, 1.0);
}
`

function ScreenQuad() {
  const { viewport, size, gl } = useThree()
  const imageURL = useStore((state) => state.imageURL)
  const entropyLevel = useStore((state) => state.entropyLevel)
  const noiseScale = useStore((state) => state.noiseScale)
  const isExporting = useStore((state) => state.isExporting)
  const setIsExporting = useStore((state) => state.setIsExporting)
  
  // Construct correct path for GitHub Pages (base: './')
  // If base is './', import.meta.env.BASE_URL is './'
  // We need to ensure we don't end up with // or bad paths.
  // Safest is to just use the relative filename if we are sure we are at the root of the app.
  // But let's use the explicit base for correctness.
  const baseUrl = import.meta.env.BASE_URL
  const defaultImage = baseUrl === './' ? './entropy-icon.png' : `${baseUrl}entropy-icon.png`.replace('//', '/')
  
  const texture = useTexture(imageURL || defaultImage)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const [seed] = useState(() => Math.random())

  // Initialize uniforms once using useState to keep the object stable
  const [uniforms] = useState(() => ({
    uTime: { value: 0 },
    uTexture: { value: texture },
    uEntropyLevel: { value: entropyLevel },
    uNoiseScale: { value: noiseScale },
    uSeed: { value: seed },
    uResolution: { value: new THREE.Vector2(size.width, size.height) },
    uImageResolution: { value: new THREE.Vector2(1, 1) }
  }))

  // Update texture uniform when texture changes
  useEffect(() => {
    if (texture && materialRef.current) {
      materialRef.current.uniforms.uTexture.value = texture
      const img = texture.image
      if (img && typeof img === 'object' && 'width' in img && 'height' in img) {
         materialRef.current.uniforms.uImageResolution.value.set(img.width, img.height)
      }
    }
  }, [texture])

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
      materialRef.current.uniforms.uEntropyLevel.value = entropyLevel
      materialRef.current.uniforms.uNoiseScale.value = noiseScale
      materialRef.current.uniforms.uResolution.value.set(size.width, size.height)
    }

    if (isExporting) {
      // Force a render if needed, but we are in useFrame so it's rendering.
      // We capture the canvas content.
      // Note: preserveDrawingBuffer: true is required on Canvas.
      gl.render(state.scene, state.camera)
      const dataURL = gl.domElement.toDataURL('image/png', 1.0)
      
      const link = document.createElement('a')
      link.download = `entropy_render_${Date.now()}.png`
      link.href = dataURL
      link.click()
      
      setIsExporting(false)
    }
  })

  return (
    <mesh scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  )
}

export function Stage() {
  return (
    <div className="absolute inset-0 w-full h-full bg-entropy-void">
      <Canvas
        gl={{ preserveDrawingBuffer: true, antialias: false }}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 1], fov: 75 }}
      >
        <ScreenQuad />
      </Canvas>
    </div>
  )
}
