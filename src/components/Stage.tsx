import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useRef, useEffect, useState, useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '../store'

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
uniform vec2 uResolution;
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
vec3 getDitheredColor(vec2 uv) {
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
       // Use gl_FragCoord with scale applied
       vec2 pixelCoord = gl_FragCoord.xy / uDitherScale;
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
          threshold = halftoneDot(uv, 0.785, 0.2 * uDitherScale); // 0.2 scale
          // Clamp to 0-1
          threshold = clamp(threshold, 0.0, 1.0);
       }
       else if (uDitherAlgorithm == 6) { // Halftone Line
          threshold = halftoneLine(uv, 0.785, 0.3 * uDitherScale);
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
    // Use gl_FragCoord with scale applied
    vec2 pixelCoord = gl_FragCoord.xy / uDitherScale;
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
        threshold = halftoneDot(uv, 0.785, 0.2 * uDitherScale);
        threshold = clamp(threshold, 0.0, 1.0);
    }
    else if (uDitherAlgorithm == 6) { // Halftone Line
        threshold = halftoneLine(uv, 0.785, 0.3 * uDitherScale);
    }
    else if (uDitherAlgorithm == 7) { // Crosshatch
        float l1 = halftoneLine(uv, 0.785, 0.3 * uDitherScale);
        float l2 = halftoneLine(uv, -0.785, 0.3 * uDitherScale);
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
  
  // Add epsilon to avoid edge artifacts
  if (uvContain.x < 0.001 || uvContain.x > 0.999 || uvContain.y < 0.001 || uvContain.y > 0.999) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec2 uv = uvContain;
  
  // Get color with dithering applied
  vec3 color = getDitheredColor(uv);
  
  // Apply Color Adjustments
  
  // Brightness & Contrast
  color = (color - 0.5) * uContrast + 0.5 + uBrightness;
  
  // Gamma
  color = pow(max(color, vec3(0.0)), vec3(uGamma));
  
  // Saturation
  float luminance = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luminance), color, uSaturation);
  
  // Vibrance (affects less saturated colors more)
  float maxColor = max(max(color.r, color.g), color.b);
  float minColor = min(min(color.r, color.g), color.b);
  float sat = maxColor - minColor;
  float vibranceEffect = (1.0 - sat) * uVibrance;
  color = mix(vec3(luminance), color, 1.0 + vibranceEffect);
  
  // Clamp final color
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
`

function ScreenQuad() {
  const { viewport, size, gl, scene, camera } = useThree()
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
        loadedTexture.wrapS = THREE.ClampToEdgeWrapping
        loadedTexture.wrapT = THREE.ClampToEdgeWrapping
        loadedTexture.needsUpdate = true
        setTexture(loadedTexture)
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
    uResolution: { value: new THREE.Vector2(size.width, size.height) },
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
      
      materialRef.current.uniforms.uColorMode.value = colorMode
      materialRef.current.uniforms.uTintHue.value = tintHue
      materialRef.current.uniforms.uPalette.value = paletteUniform
      
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
    <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none">
      <div className="relative w-full h-full pointer-events-auto">
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
