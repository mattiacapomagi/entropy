import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useRef, useEffect, useState, useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '../store'
import { MapControls, OrthographicCamera } from '@react-three/drei'

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
uniform sampler2D uTexture;
uniform float uDitherStrength;
uniform float uDitherScale;
uniform int uDitherAlgorithm;
uniform float uBrightness;
uniform float uContrast;
uniform float uSaturation;
uniform float uGamma;
uniform float uVibrance;
uniform int uColorMode;
uniform float uTintHue;
uniform vec3 uPalette[4];
uniform vec2 uImageResolution;
uniform bool uHasImage;
uniform float uTime;

varying vec2 vUv;

vec3 hueToRGB(float hue) {
  float h = mod(hue, 360.0) / 60.0;
  float x = 1.0 - abs(mod(h, 2.0) - 1.0);
  
  if (h < 1.0) return vec3(1.0, x, 0.0);
  else if (h < 2.0) return vec3(x, 1.0, 0.0);
  else if (h < 3.0) return vec3(0.0, 1.0, x);
  else if (h < 4.0) return vec3(0.0, x, 1.0);
  else if (h < 5.0) return vec3(x, 0.0, 1.0);
  else return vec3(1.0, 0.0, x);
}

// Bayer Matrices
float bayer2x2(vec2 coord) {
  int x = int(mod(coord.x, 2.0));
  int y = int(mod(coord.y, 2.0));
  int index = y * 2 + x;
  int pattern[4] = int[4](0, 2, 3, 1);
  return float(pattern[index]) / 4.0;
}

float bayer4x4(vec2 coord) {
  int x = int(mod(coord.x, 4.0));
  int y = int(mod(coord.y, 4.0));
  int index = y * 4 + x;
  int pattern[16] = int[16](
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5
  );
  return float(pattern[index]) / 16.0;
}

float bayer8x8(vec2 coord) {
  int x = int(mod(coord.x, 8.0));
  int y = int(mod(coord.y, 8.0));
  int index = y * 8 + x;
  int pattern[64] = int[64](
     0, 32,  8, 40,  2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44,  4, 36, 14, 46,  6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
     3, 35, 11, 43,  1, 33,  9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47,  7, 39, 13, 45,  5, 37,
    63, 31, 55, 23, 61, 29, 53, 21
  );
  return float(pattern[index]) / 64.0;
}

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

// Improved Halftone Patterns
float halftoneDot(vec2 uv, float angle, float scale) {
  float s = sin(angle), c = cos(angle);
  vec2 tex = uv * uImageResolution * scale; // Use Image Resolution
  vec2 point = vec2(
    c * tex.x - s * tex.y,
    s * tex.x + c * tex.y
  );
  
  // Create a grid of centers
  vec2 nearest = floor(point + 0.5);
  vec2 dist = point - nearest;
  float d = length(dist);
  
  // Return a gradient based on distance from center
  // 0 at center, 1 at edge
  return d * 1.5; // Multiplier adjusts sharpness/size
}

float halftoneLine(vec2 uv, float angle, float scale) {
  float s = sin(angle), c = cos(angle);
  vec2 tex = uv * uImageResolution * scale;
  vec2 point = vec2(
    c * tex.x - s * tex.y,
    s * tex.x + c * tex.y
  );
  // Sine wave normalized to 0-1
  return sin(point.y * 3.14159) * 0.5 + 0.5;
}

// Function to get the dithered color
vec3 getDitheredColor(vec3 inputColor, vec2 uv) {
  vec3 color = inputColor;
  
  // Color Modes & Dithering
  if (uColorMode == 1) {
    // Grayscale
    float gray = dot(color, vec3(0.299, 0.587, 0.114));
    color = vec3(gray);
  } else if (uColorMode == 2) {
    // Tint
    float gray = dot(color, vec3(0.299, 0.587, 0.114));
    vec3 tintColor = hueToRGB(uTintHue);
    color = tintColor * gray;
  } else if (uColorMode == 3) {
    // Multicolor Palette
    float gray = dot(color, vec3(0.299, 0.587, 0.114));
    float scaledGray = gray * 3.0;
    int idx = int(floor(scaledGray));
    idx = clamp(idx, 0, 2);
    
    vec3 c1 = uPalette[idx];
    vec3 c2 = uPalette[idx + 1];
    
    float localFract = fract(scaledGray);
    
    if (uDitherStrength > 0.0) {
       // Use Image-Space Coordinates for consistency
       vec2 pixelCoord = (uv * uImageResolution) / uDitherScale;
       float threshold = 0.5;
       
       // Algorithms
       if (uDitherAlgorithm == 0) threshold = bayer2x2(pixelCoord);
       else if (uDitherAlgorithm == 1) threshold = bayer4x4(pixelCoord);
       else if (uDitherAlgorithm == 2) threshold = bayer8x8(pixelCoord);
       else if (uDitherAlgorithm == 3) { // Halftone 45°
          threshold = halftoneDot(uv, 0.785, 0.2 * uDitherScale); 
          threshold = clamp(threshold, 0.0, 1.0);
       }
       else if (uDitherAlgorithm == 4) { // Halftone 22°
          threshold = halftoneDot(uv, 0.384, 0.2 * uDitherScale); // 22° in radians ≈ 0.384
          threshold = clamp(threshold, 0.0, 1.0);
       }
       
       return mix(
         mix(c1, c2, localFract),
         mix(c1, c2, step(threshold, localFract)),
         uDitherStrength
       );
    } else {
       return mix(c1, c2, localFract);
    }
  }
  
  // Standard Dithering (for non-palette modes)
  if (uDitherStrength > 0.0 && uColorMode != 3) {
    // Use Image-Space Coordinates for consistency
    vec2 pixelCoord = (uv * uImageResolution) / uDitherScale;
    float threshold = 0.5; // CRITICAL: declare threshold variable
    
    if (uDitherAlgorithm == 0) threshold = bayer2x2(pixelCoord);
    else if (uDitherAlgorithm == 1) threshold = bayer4x4(pixelCoord);
    else if (uDitherAlgorithm == 2) threshold = bayer8x8(pixelCoord);
    else if (uDitherAlgorithm == 3) { // Halftone 45°
        threshold = halftoneDot(uv, 0.785, 0.2 * uDitherScale);
        threshold = clamp(threshold, 0.0, 1.0);
    }
    else if (uDitherAlgorithm == 4) { // Halftone 22°
        threshold = halftoneDot(uv, 0.384, 0.2 * uDitherScale);
        threshold = clamp(threshold, 0.0, 1.0);
    }
    
    threshold = mix(0.5, threshold, uDitherStrength);
    
    float levels = 2.0; 
    vec3 quantized = floor(color * levels) / levels;
    vec3 nextLevel = ceil(color * levels) / levels;
    
    color = mix(quantized, nextLevel, step(threshold, fract(color * levels)));
  }
  
  return color;
}

void main() {
  if (!uHasImage) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Use vUv directly - geometry handles aspect ratio
  vec2 uv = vUv;
  
  // 1. Sample Texture
  vec3 color = texture2D(uTexture, uv).rgb;
  
  // 2. Apply Brightness & Contrast (BEFORE Dithering)
  color = (color - 0.5) * uContrast + 0.5 + uBrightness;
  color = clamp(color, 0.0, 1.0); // Clamp to avoid crazy values before dithering
  
  // 3. Apply Dithering
  color = getDitheredColor(color, uv);
  
  // 4. Apply Post-Processing (Gamma, Saturation, Vibrance)
  
  // Gamma
  color = pow(max(color, vec3(0.0)), vec3(uGamma));
  
  // Saturation
  float luminance = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luminance), color, uSaturation);
  
  // Vibrance
  float maxColor = max(max(color.r, color.g), color.b);
  float minColor = min(min(color.r, color.g), color.b);
  float sat = maxColor - minColor;
  float vibranceEffect = (1.0 - sat) * uVibrance;
  color = mix(vec3(luminance), color, 1.0 + vibranceEffect);
  
  // Final Clamp
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
`

function ScreenQuad() {
  const { gl, scene, camera, size } = useThree()
  const imageURL = useStore((state) => state.imageURL)
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
  const isExporting = useStore((state) => state.isExporting)
  const setIsExporting = useStore((state) => state.setIsExporting)
  
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const exportCameraRef = useRef<THREE.OrthographicCamera>(null)
  const controlsRef = useRef<any>(null)

  useEffect(() => {
    if (!imageURL) {
      setTexture(null)
      return
    }

    const loader = new THREE.TextureLoader()
    let isMounted = true
    loader.load(imageURL, (loadedTexture) => {
      if (isMounted) {
        // Use LinearFilter for smooth scaling when zoomed out
        // This prevents "blocky" appearance on mobile while maintaining pixel-perfect rendering when zoomed in
        loadedTexture.minFilter = THREE.LinearFilter
        loadedTexture.magFilter = THREE.LinearFilter
        loadedTexture.wrapS = THREE.ClampToEdgeWrapping
        loadedTexture.wrapT = THREE.ClampToEdgeWrapping
        loadedTexture.needsUpdate = true
        setTexture(loadedTexture)
        
        // FIT TO SCREEN LOGIC - Contain entire image (fit both width AND height)
        const img = loadedTexture.image
        if (img && controlsRef.current && camera) {
           const padding = 0.9 // Keep 90% of screen filled
           
           // Calculate zoom for both width and height, use the SMALLER one to ensure entire image fits
           const zoomWidth = (size.width * padding) / img.width
           const zoomHeight = (size.height * padding) / img.height
           const newZoom = Math.min(zoomWidth, zoomHeight)
           
           // Update camera zoom
           const orthoCam = camera as THREE.OrthographicCamera
           orthoCam.zoom = newZoom
           orthoCam.updateProjectionMatrix()
           
           // Set minZoom to prevent zooming out below fit-to-screen (prevents glitchy bands)
           if (controlsRef.current) {
             controlsRef.current.minZoom = newZoom * 0.9 // Allow slight zoom out but not too much
             controlsRef.current.reset()
             controlsRef.current.object.zoom = newZoom
             controlsRef.current.object.updateProjectionMatrix()
           }
        }
      }
    })
    return () => { isMounted = false }
  }, [imageURL])

  const paletteUniform = useMemo(() => {
    return paletteColors.map(hex => {
      const c = new THREE.Color(hex)
      return new THREE.Vector3(c.r, c.g, c.b)
    })
  }, [paletteColors])

  const [uniforms] = useState(() => ({
    uTexture: { value: null },
    uDitherStrength: { value: 0.5 },
    uDitherScale: { value: 1.0 },
    uDitherAlgorithm: { value: 2 },
    uBrightness: { value: 0.0 },
    uContrast: { value: 1.0 },
    uSaturation: { value: 1.0 },
    uGamma: { value: 1.0 },
    uVibrance: { value: 0.0 },
    uColorMode: { value: 0 },
    uTintHue: { value: 20.0 },
    uPalette: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
    uImageResolution: { value: new THREE.Vector2(1, 1) },
    uHasImage: { value: false },
    uTime: { value: 0 }
  }))

  useEffect(() => {
    if (texture && materialRef.current) {
      materialRef.current.uniforms.uTexture.value = texture
      materialRef.current.uniforms.uHasImage.value = true
      const img = texture.image as HTMLImageElement
      materialRef.current.uniforms.uImageResolution.value.set(img.width, img.height)
    } else if (materialRef.current) {
      materialRef.current.uniforms.uHasImage.value = false
    }
  }, [texture])

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
      materialRef.current.uniforms.uDitherStrength.value = ditherStrength
      materialRef.current.uniforms.uDitherScale.value = ditherScale
      materialRef.current.uniforms.uDitherAlgorithm.value = ditherAlgorithm
      
      // MAPPING 0-200 to Shader Values
      materialRef.current.uniforms.uBrightness.value = (brightness - 100) / 100.0 * 0.5
      materialRef.current.uniforms.uContrast.value = contrast / 100.0
      materialRef.current.uniforms.uSaturation.value = saturation / 100.0
      materialRef.current.uniforms.uGamma.value = Math.max(0.01, gamma / 100.0)
      materialRef.current.uniforms.uVibrance.value = (vibrance - 100) / 100.0
      
      materialRef.current.uniforms.uColorMode.value = colorMode
      materialRef.current.uniforms.uTintHue.value = tintHue
      materialRef.current.uniforms.uPalette.value = paletteUniform
    }

    if (isExporting && texture && texture.image && exportCameraRef.current) {
      const img = texture.image as HTMLImageElement
      const originalWidth = img.width
      const originalHeight = img.height
      const currentWidth = state.size.width
      const currentHeight = state.size.height
      
      // Configure export camera to match image dimensions exactly
      const cam = exportCameraRef.current
      cam.left = -originalWidth / 2
      cam.right = originalWidth / 2
      cam.top = originalHeight / 2
      cam.bottom = -originalHeight / 2
      cam.updateProjectionMatrix()
      
      gl.setSize(originalWidth, originalHeight, false)
      gl.render(scene, cam) // Render using the export camera
      
      try {
        // Convert canvas to Blob for better iOS/Safari compatibility
        gl.domElement.toBlob((blob) => {
          if (!blob) {
            console.error('Failed to create blob')
            return
          }
          
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          
          const now = new Date()
          const timestamp = now.getTime().toString().slice(-6)
          
          link.download = `entropy_${timestamp}.png`
          link.href = url
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          
          // Clean up the object URL after a short delay
          setTimeout(() => URL.revokeObjectURL(url), 100)
        }, 'image/png', 1.0)
      } catch (error) {
        console.error('Export failed:', error)
      }
      
      gl.setSize(currentWidth, currentHeight, false)
      setIsExporting(false)
    }
  })

  // Calculate mesh size based on image dimensions
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

      <mesh scale={[meshWidth, meshHeight, 1]}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
        />
      </mesh>
    </>
  )
}

export function Stage() {
  return (
    <div className="absolute inset-0 w-full h-full flex">
      <div className="relative w-full h-full">
        <Canvas
          gl={{ preserveDrawingBuffer: true, antialias: false }}
          dpr={[1, 1]}
        >
          <ScreenQuad />
        </Canvas>
      </div>
    </div>
  )
}
