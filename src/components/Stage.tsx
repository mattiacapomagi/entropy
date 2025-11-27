import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useRef, useEffect, useState, useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '../store'

// Helper for FS
const getRGB = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

const findClosestColor = (r: number, g: number, b: number, palette: {r:number, g:number, b:number}[]) => {
  let minDist = Infinity
  let closest = palette[0]
  for (const color of palette) {
    const dist = (r - color.r) ** 2 + (g - color.g) ** 2 + (b - color.b) ** 2
    if (dist < minDist) {
      minDist = dist
      closest = color
    }
  }
  return closest
}

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
uniform sampler2D uTexture;
uniform sampler2D uFSTexture; // New uniform for FS result
uniform float uDitherStrength;
uniform int uDitherAlgorithm;
uniform float uBrightness;
uniform float uContrast;
uniform float uSaturation;
uniform float uGamma;
uniform float uVibrance;
uniform float uAberration;
uniform int uColorMode;
uniform float uTintHue;
uniform vec3 uPalette[4];
uniform vec2 uResolution;
uniform vec2 uImageResolution;
uniform bool uHasImage;
uniform float uTime;
uniform vec2 uMouse;
uniform bool uMagnifierActive;

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
  vec2 tex = uv * uResolution * scale; // Scale determines dot density
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
  vec2 tex = uv * uResolution * scale;
  vec2 point = vec2(
    c * tex.x - s * tex.y,
    s * tex.x + c * tex.y
  );
  // Sine wave normalized to 0-1
  return sin(point.y * 3.14159) * 0.5 + 0.5;
}

// Function to get the dithered color BEFORE adjustments
vec3 getDitheredColor(vec2 uv, vec2 ditherCoord) {
  // If Floyd-Steinberg (ID 8), sample from the pre-calculated texture
  if (uDitherAlgorithm == 8) {
     vec3 fsColor = texture2D(uFSTexture, uv).rgb;
     // Mix based on strength (though FS is usually binary, we allow blending)
     vec3 original = texture2D(uTexture, uv).rgb;
     
     // For palette modes, we might want to respect the palette?
     // The FS texture is already quantized.
     return mix(original, fsColor, uDitherStrength);
  }

  // No pixelation/DPI logic anymore, just raw texture sampling
  vec3 color = texture2D(uTexture, uv).rgb;
  
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
       // Use ditherCoord instead of gl_FragCoord
       vec2 pixelCoord = ditherCoord;
       float threshold = 0.5;
       
       // Algorithms
       if (uDitherAlgorithm == 0) threshold = bayer2x2(pixelCoord);
       else if (uDitherAlgorithm == 1) threshold = bayer4x4(pixelCoord);
       else if (uDitherAlgorithm == 2) threshold = bayer8x8(pixelCoord);
       else if (uDitherAlgorithm == 3) threshold = random(pixelCoord);
       else if (uDitherAlgorithm == 4) { // Clustered Dot
          float angle = 45.0 * 3.14159 / 180.0;
          vec2 rotated = vec2(
            pixelCoord.x * cos(angle) - pixelCoord.y * sin(angle),
            pixelCoord.x * sin(angle) + pixelCoord.y * cos(angle)
          );
          threshold = bayer4x4(rotated);
       }
       else if (uDitherAlgorithm == 5) { // Halftone Dot (Improved)
          // Scale needs to be related to DPI or just fixed?
          // Let's make it fixed but high freq
          threshold = halftoneDot(uv, 0.785, 0.2); // 0.2 scale
          // Clamp to 0-1
          threshold = clamp(threshold, 0.0, 1.0);
       }
       else if (uDitherAlgorithm == 6) { // Halftone Line
          threshold = halftoneLine(uv, 0.785, 0.3);
       }
       else if (uDitherAlgorithm == 7) { // Crosshatch
          float l1 = halftoneLine(uv, 0.785, 0.3);
          float l2 = halftoneLine(uv, -0.785, 0.3);
          threshold = (l1 + l2) * 0.5; // Average
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
    // Use ditherCoord instead of gl_FragCoord
    vec2 pixelCoord = ditherCoord;
    float threshold = 0.5;
    
    if (uDitherAlgorithm == 0) threshold = bayer2x2(pixelCoord);
    else if (uDitherAlgorithm == 1) threshold = bayer4x4(pixelCoord);
    else if (uDitherAlgorithm == 2) threshold = bayer8x8(pixelCoord);
    else if (uDitherAlgorithm == 3) threshold = random(pixelCoord);
    else if (uDitherAlgorithm == 4) {
      float angle = 45.0 * 3.14159 / 180.0;
      vec2 rotated = vec2(
        pixelCoord.x * cos(angle) - pixelCoord.y * sin(angle),
        pixelCoord.x * sin(angle) + pixelCoord.y * cos(angle)
      );
      threshold = bayer4x4(rotated);
    }
    else if (uDitherAlgorithm == 5) { // Halftone Dot
        threshold = halftoneDot(uv, 0.785, 0.2);
        threshold = clamp(threshold, 0.0, 1.0);
    }
    else if (uDitherAlgorithm == 6) { // Halftone Line
        threshold = halftoneLine(uv, 0.785, 0.3);
    }
    else if (uDitherAlgorithm == 7) { // Crosshatch
        float l1 = halftoneLine(uv, 0.785, 0.3);
        float l2 = halftoneLine(uv, -0.785, 0.3);
        threshold = (l1 + l2) * 0.5;
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

  vec2 ratio = uImageResolution / uResolution;
  float maxRatio = max(ratio.x, ratio.y);
  vec2 scale = ratio / maxRatio;
  vec2 uvContain = (vUv - 0.5) / scale + 0.5;
  
  if (uvContain.x < 0.0 || uvContain.x > 1.0 || uvContain.y < 0.0 || uvContain.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec2 uv = uvContain;
  
  // Magnifier Logic
  if (uMagnifierActive) {
    // Correct aspect ratio for round lens
    float aspect = uResolution.x / uResolution.y;
    vec2 aspectCorrection = vec2(aspect, 1.0);
    
    float dist = distance(uv * aspectCorrection, uMouse * aspectCorrection);
    float radius = 0.15; // Lens radius
    float zoom = 3.0;
    
    if (dist < radius) {
      // Zoom in
      uv = (uv - uMouse) / zoom + uMouse;
      
      // Add a subtle border
      if (dist > radius - 0.005) {
         gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // White border
         return;
      }
    }
  }

  // Calculate dither coordinate based on UV and Image Resolution
  // This ensures the pattern sticks to the image pixels
  vec2 ditherCoord = uv * uImageResolution;

  vec3 color;

  // 1. Chromatic Aberration
  if (uAberration > 0.0) {
    float offset = uAberration * 0.01; 
    float r = getDitheredColor(uv + vec2(offset, 0.0), ditherCoord).r;
    float g = getDitheredColor(uv, ditherCoord).g;
    float b = getDitheredColor(uv - vec2(offset, 0.0), ditherCoord).b;
    color = vec3(r, g, b);
  } else {
    color = getDitheredColor(uv, ditherCoord);
  }
  
  // 2. Adjustments
  
  // Brightness & Contrast
  color = (color - 0.5) * uContrast + 0.5 + uBrightness;
  
  // Clamp to prevent negative values
  color = clamp(color, 0.0, 1.0);
  
  // Gamma
  color = pow(color, vec3(1.0 / uGamma));
  
  // Vibrance
  float average = (color.r + color.g + color.b) / 3.0;
  float mx = max(color.r, max(color.g, color.b));
  float amt = (mx - average) * -3.0 * uVibrance;
  color = mix(color, vec3(mx), amt);
  
  // Saturation
  float luminance = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luminance), color, uSaturation);

  gl_FragColor = vec4(color, 1.0);
}
`

function ScreenQuad() {
  const { viewport, size, gl, scene, camera } = useThree()
  const imageURL = useStore((state) => state.imageURL)
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
  const isExporting = useStore((state) => state.isExporting)
  const setIsExporting = useStore((state) => state.setIsExporting)
  
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const [fsTexture, setFsTexture] = useState<THREE.Texture | null>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  useEffect(() => {
    if (!imageURL) {
      setTexture(null)
      return
    }

    const loader = new THREE.TextureLoader()
    let isMounted = true
    loader.load(imageURL, (loadedTexture) => {
      if (isMounted) {
        loadedTexture.minFilter = THREE.NearestFilter
        loadedTexture.magFilter = THREE.NearestFilter
        setTexture(loadedTexture)
      }
    })
    return () => { isMounted = false }
  }, [imageURL])

  // Floyd-Steinberg Processing Effect
  useEffect(() => {
    if (ditherAlgorithm !== 8 || !texture || !texture.image) {
      setFsTexture(null) // Clear FS texture if not using FS or no image
      return
    }

    const img = texture.image as HTMLImageElement
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    const width = canvas.width
    const height = canvas.height

    // Prepare Palette based on Color Mode
    let palette: {r:number, g:number, b:number}[] = []
    
    if (colorMode === 3) { // Multicolor
      palette = paletteColors.map(getRGB)
    } else if (colorMode === 1 || colorMode === 2) { // Grayscale or Tint
      // 2 levels: Black and White (or mapped later)
      palette = [{r:0, g:0, b:0}, {r:255, g:255, b:255}]
    } else { // Full Color
      // 3 levels per channel (Web Safe-ish)
      // We don't use a simple array for this, we quantize per channel
    }

    // Processing Loop
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        const oldR = data[i]
        const oldG = data[i + 1]
        const oldB = data[i + 2]

        let newR, newG, newB

        if (colorMode === 0) { // Full Color (Per-channel quantization)
           const levels = 2 // 0, 127, 255
           newR = Math.round(oldR / 255 * levels) / levels * 255
           newG = Math.round(oldG / 255 * levels) / levels * 255
           newB = Math.round(oldB / 255 * levels) / levels * 255
        } else if (colorMode === 1 || colorMode === 2) { // Grayscale/Tint
           const gray = 0.299 * oldR + 0.587 * oldG + 0.114 * oldB
           const closest = gray < 128 ? 0 : 255
           newR = newG = newB = closest
        } else { // Palette
           const closest = findClosestColor(oldR, oldG, oldB, palette)
           newR = closest.r
           newG = closest.g
           newB = closest.b
        }

        data[i] = newR
        data[i + 1] = newG
        data[i + 2] = newB

        const errR = oldR - newR
        const errG = oldG - newG
        const errB = oldB - newB

        const distribute = (dx: number, dy: number, factor: number) => {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const ni = (ny * width + nx) * 4
            data[ni] = Math.min(255, Math.max(0, data[ni] + errR * factor))
            data[ni + 1] = Math.min(255, Math.max(0, data[ni + 1] + errG * factor))
            data[ni + 2] = Math.min(255, Math.max(0, data[ni + 2] + errB * factor))
          }
        }

        distribute(1, 0, 7/16)
        distribute(-1, 1, 3/16)
        distribute(0, 1, 5/16)
        distribute(1, 1, 1/16)
      }
    }

    const newTex = new THREE.CanvasTexture(canvas)
    newTex.minFilter = THREE.NearestFilter
    newTex.magFilter = THREE.NearestFilter
    setFsTexture(newTex)

  }, [ditherAlgorithm, texture, colorMode, paletteColors]) // Re-run when these change

  const paletteUniform = useMemo(() => {
    return paletteColors.map(hex => {
      const c = new THREE.Color(hex)
      return new THREE.Vector3(c.r, c.g, c.b)
    })
  }, [paletteColors])

  const [uniforms] = useState(() => ({
    uTexture: { value: null },
    uFSTexture: { value: null }, // Add to uniforms
    uDitherStrength: { value: 0.0 },
    uDitherAlgorithm: { value: 2 },
    uBrightness: { value: 0.0 },
    uContrast: { value: 1.0 },
    uSaturation: { value: 1.0 },
    uGamma: { value: 1.0 },
    uVibrance: { value: 0.0 },
    uAberration: { value: 0.0 },
    uColorMode: { value: 0 },
    uTintHue: { value: 20.0 },
    uPalette: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
    uResolution: { value: new THREE.Vector2(size.width, size.height) },
    uImageResolution: { value: new THREE.Vector2(1, 1) },
    uHasImage: { value: false },
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uMagnifierActive: { value: false }
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
      materialRef.current.uniforms.uDitherAlgorithm.value = ditherAlgorithm
      materialRef.current.uniforms.uFSTexture.value = fsTexture // Pass FS texture
      
      // MAPPING 1-100 to Shader Values
      // Brightness: 50 -> 0. Range -0.2 to 0.2
      materialRef.current.uniforms.uBrightness.value = (brightness - 50) / 50 * 0.2
      
      // Contrast: 50 -> 1.0. Range 0.5 to 1.5
      materialRef.current.uniforms.uContrast.value = (contrast - 50) / 50 * 0.5 + 1.0
      
      // Saturation: 50 -> 1.0. Range 0.0 to 2.0
      materialRef.current.uniforms.uSaturation.value = saturation / 50.0
      
      // Gamma: 50 -> 1.0. Range 0.1 to 3.0?
      // Let's map 1-100 to 0.5 - 2.5 roughly
      materialRef.current.uniforms.uGamma.value = (gamma / 50.0)
      
      // Vibrance: 50 -> 0.0. Range -1.0 to 1.0
      materialRef.current.uniforms.uVibrance.value = (vibrance - 50) / 50.0
      
      materialRef.current.uniforms.uAberration.value = aberration
      materialRef.current.uniforms.uColorMode.value = colorMode
      materialRef.current.uniforms.uTintHue.value = tintHue
      materialRef.current.uniforms.uPalette.value = paletteUniform
      
      // Update Mouse
      // state.pointer is -1 to 1. Map to 0 to 1.
      const mx = (state.pointer.x + 1) / 2
      const my = (state.pointer.y + 1) / 2
      materialRef.current.uniforms.uMouse.value.set(mx, my)
      
      // Activate magnifier if mouse is inside the viewport
      const isInside = Math.abs(state.pointer.x) <= 1.0 && Math.abs(state.pointer.y) <= 1.0
      materialRef.current.uniforms.uMagnifierActive.value = isInside
      
      if (isExporting && texture && texture.image) {
        const img = texture.image as HTMLImageElement
        materialRef.current.uniforms.uResolution.value.set(img.width, img.height)
      } else {
        materialRef.current.uniforms.uResolution.value.set(size.width, size.height)
      }
    }

    if (isExporting && texture && texture.image) {
      const img = texture.image as HTMLImageElement
      const originalWidth = img.width
      const originalHeight = img.height
      const currentWidth = size.width
      const currentHeight = size.height
      
      gl.setSize(originalWidth, originalHeight, false)
      gl.render(scene, camera)
      
      try {
        const dataURL = gl.domElement.toDataURL('image/png', 1.0)
        const link = document.createElement('a')
        
        const now = new Date()
        const dateStr = now.toISOString().split('T')[0]
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-')
        const hex = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0')
        
        link.download = `ENTROPY_ARTIFACT_${dateStr}_${timeStr}_${hex}.png`
        link.href = dataURL
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } catch (error) {
        console.error('Export failed:', error)
      }
      
      gl.setSize(currentWidth, currentHeight, false)
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
    <div className="absolute inset-0 w-full h-full bg-black flex items-center justify-center pointer-events-none">
      <div className="relative w-[80%] h-[80%] border-4 border-white pointer-events-auto">
        <Canvas
          gl={{ preserveDrawingBuffer: true, antialias: false }}
          dpr={[1, 1]}
          camera={{ position: [0, 0, 1], fov: 75 }}
        >
          <ScreenQuad />
        </Canvas>
      </div>
    </div>
  )
}
