import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useRef, useEffect, useState, useMemo, memo } from 'react'
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
uniform float uShadows;
uniform float uHighlights;
uniform float uBlacks;
uniform float uWhites;
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
  
  // 2b. Apply Shadows & Highlights
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float shadowFactor = 1.0 - smoothstep(0.0, 1.0, luma);
  float highlightFactor = smoothstep(0.0, 1.0, luma);
  
  color += uShadows * shadowFactor * 0.5;
  color += uHighlights * highlightFactor * 0.5;
  
  // 2c. Apply Blacks & Whites (Levels)
  // Blacks: Adjust black point (Negative = Crush, Positive = Lift)
  // Whites: Adjust white point (Negative = Dim, Positive = Blow out)
  float blackPoint = -uBlacks * 0.2;
  float whitePoint = 1.0 - uWhites * 0.2;
  color = (color - blackPoint) / (whitePoint - blackPoint);

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

const datamoshFragmentShader = `
uniform sampler2D uTexture;
uniform float uDmStrength;
uniform float uDmScale;
uniform float uDmContrast;
uniform float uDmColorNoise;
uniform float uDmSeed;
uniform float uDmSizeVariation;
// Palette Uniforms
uniform vec3 uPalette[4];
uniform bool uUsePalette;
// Color Mode Uniforms
uniform int uColorMode; // 0=Normal, 1=Grayscale, 2=Tint, 3=Palette (Multicolor)
uniform float uTintHue;
varying vec2 vUv;

// Helper for Tint
vec3 hueToRGB(float hue) {
  float r = abs(hue * 6.0 - 3.0) - 1.0;
  float g = 2.0 - abs(hue * 6.0 - 2.0);
  float b = 2.0 - abs(hue * 6.0 - 4.0);
  return clamp(vec3(r, g, b), 0.0, 1.0);
}

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233) + uDmSeed)) * 43758.5453123);
}

float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// Helper for palette mapping
vec3 mapToPalette(vec3 color) {
  float minDist = 1000.0;
  vec3 closestColor = color;
  
  for (int i = 0; i < 4; i++) {
    float dist = distance(color, uPalette[i]);
    if (dist < minDist) {
      minDist = dist;
      closestColor = uPalette[i];
    }
  }
  return closestColor;
}

void main() {
  vec2 uv = vUv;
  
  // SIZE VARIATION: Randomly change block size for individual blocks
  // Instead of warping, we can use a noise threshold to decide if a block 
  // should be subdivided or merged.
  // Simpler approach: Calculate block UVs at two scales.
  // Scale A: Base scale (uDmScale)
  // Scale B: Larger scale (uDmScale * 0.5)
  // Use noise to mix between them per-pixel? No, that blurs.
  // We need to decide for a region which scale to use.
  
  float baseBlocks = 50.0 / uDmScale;
  
  // Calculate a "Scale Map" using low-freq noise driven by Seed
  // If noise > threshold, use larger blocks.
  // uDmSizeVariation controls the threshold/mix.
  float scaleNoise = noise(floor(uv * baseBlocks * 0.2) + uDmSeed);
  
  // If variation is high, we allow more large blocks.
  // But we want "random size of single block".
  // Let's try:
  float currentBlocks = baseBlocks;
  
  // If random check passes, use half density (double size)
  if (scaleNoise < uDmSizeVariation) {
     currentBlocks = baseBlocks * 0.5;
  }
  
  vec2 blockUv = floor(uv * currentBlocks) / currentBlocks;
  
  // DENSITY (formerly Contrast): Percentage of image affected.
  // uDmContrast is now 0.0 to 1.0.
  // We use it as a threshold.
  // We want to create a mask.
  // SEED: Add uDmSeed to the noise lookup
  float maskNoise = noise(blockUv * 3.14 + 10.0 + uDmSeed); 
  
  // Threshold = 1.0 - uDmContrast.
  float densityThreshold = 1.0 - uDmContrast;
  float densityMask = step(densityThreshold, maskNoise);
  
  // Calculate Displacement Vectors
  // Stepped (Hard Blocks)
  // SEED: Add uDmSeed to random calls
  vec2 dispStepped = vec2(
    (random(blockUv + uDmSeed) - 0.5) * 2.0,
    (random(blockUv + 100.0 + uDmSeed) - 0.5) * 2.0
  );
  
  // Apply displacement
  vec2 displacedUv = uv + dispStepped * uDmStrength * densityMask * 0.1;
  
  // Sample texture
  vec4 color = texture2D(uTexture, displacedUv);
  
  // Add artifacts
  float artifact = random(uv * 100.0 + uDmSeed) * uDmStrength * 0.1 * densityMask;
  color.rgb += artifact;
  
  // COLOR INVERSION / SHIFT
  // Apply only where mask is active
  if (densityMask > 0.5) {
    float blockRandom = random(blockUv + 50.0 + uDmSeed);
    if (blockRandom < uDmColorNoise) {
      color.rgb = 1.0 - color.rgb;
    }
  }
  
  // COLOR MODES
  // 1. Grayscale
  if (uColorMode == 1) {
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = vec3(gray);
  }
  // 2. Palette (Multicolor) - Handled via uUsePalette flag logic or explicit mode
  // 2. Tint
  else if (uColorMode == 2) {
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 tintColor = hueToRGB(uTintHue);
    color.rgb = tintColor * gray;
  }
  // 3. Palette (Multicolor)
  else if (uColorMode == 3) {
    color.rgb = mapToPalette(color.rgb);
  }
  
  // Fallback for uUsePalette if not in mode 3 (legacy support or mixed usage)
  if (uUsePalette && uColorMode != 3) {
     color.rgb = mapToPalette(color.rgb);
  }
  
  gl_FragColor = color;
}
`

const ScreenQuad = memo(function ScreenQuad() {
  const { gl, scene, camera, size } = useThree()
  const imageURL = useStore((state) => state.imageURL)
  const currentTool = useStore((state) => state.currentTool)
  const ditherStrength = useStore((state) => state.ditherStrength)
  const ditherScale = useStore((state) => state.ditherScale)
  const ditherAlgorithm = useStore((state) => state.ditherAlgorithm)
  const brightness = useStore((state) => state.brightness)
  const contrast = useStore((state) => state.contrast)
  const saturation = useStore((state) => state.saturation)
  const gamma = useStore((state) => state.gamma)
  const vibrance = useStore((state) => state.vibrance)
  const shadows = useStore((state) => state.shadows)
  const highlights = useStore((state) => state.highlights)
  const blacks = useStore((state) => state.blacks)
  const whites = useStore((state) => state.whites)
  const colorMode = useStore((state) => state.colorMode)
  const tintHue = useStore((state) => state.tintHue)
  const paletteColors = useStore((state) => state.paletteColors)
  
  const dm_strength = useStore((state) => state.dm_strength)
  const dm_scale = useStore((state) => state.dm_scale)
  const dm_contrast = useStore((state) => state.dm_contrast)
  const dm_color_noise = useStore((state) => state.dm_color_noise)
  const dm_seed = useStore((state) => state.dm_seed)
  const dm_size_variation = useStore((state) => state.dm_size_variation)
  const isExporting = useStore((state) => state.isExporting)
  const setIsExporting = useStore((state) => state.setIsExporting)
  
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const exportCameraRef = useRef<THREE.OrthographicCamera>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null)

  useEffect(() => {
    // Reset texture when imageURL changes
    if (!imageURL) return

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
  }, [imageURL, camera, size])

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
    uShadows: { value: 0.0 },
    uHighlights: { value: 0.0 },
    uBlacks: { value: 0.0 },
    uWhites: { value: 0.0 },
    uColorMode: { value: 0 },
    uTintHue: { value: 20.0 },
    uPalette: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
    uUsePalette: { value: false },
    
    // Datamosh Uniforms
    uDmStrength: { value: 0.0 },
    uDmScale: { value: 1.0 },
    uDmContrast: { value: 1.0 },
    uDmColorNoise: { value: 0.0 },
    uDmSeed: { value: 0.0 },
    uDmSizeVariation: { value: 0.0 },
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
      // INVERTED Vibrance as requested by user
      materialRef.current.uniforms.uVibrance.value = -1.0 * (vibrance - 100) / 100.0
      
      materialRef.current.uniforms.uShadows.value = (shadows - 100) / 100.0
      materialRef.current.uniforms.uHighlights.value = (highlights - 100) / 100.0
      materialRef.current.uniforms.uBlacks.value = (blacks - 100) / 100.0
      materialRef.current.uniforms.uWhites.value = (whites - 100) / 100.0
      
      materialRef.current.uniforms.uColorMode.value = colorMode
      materialRef.current.uniforms.uTintHue.value = tintHue / 360.0 // Normalize 0-360 to 0-1 for shader
      materialRef.current.uniforms.uPalette.value = paletteUniform
      materialRef.current.uniforms.uUsePalette.value = colorMode === 3 // 3 is MULTICOLOR/PALETTE mode
      
      materialRef.current.uniforms.uDmStrength.value = dm_strength
      materialRef.current.uniforms.uDmScale.value = dm_scale
      materialRef.current.uniforms.uDmContrast.value = dm_contrast
      materialRef.current.uniforms.uDmColorNoise.value = dm_color_noise
      
      // Simple string hash for seed
      let seedVal = 0;
      for (let i = 0; i < dm_seed.length; i++) {
        seedVal = ((seedVal << 5) - seedVal) + dm_seed.charCodeAt(i);
        seedVal |= 0; // Convert to 32bit integer
      }
      // Normalize to a safe float range (0.0 - 1000.0) to avoid GLSL precision issues with sin()
      const safeSeed = (Math.abs(seedVal) % 100000) / 100.0;
      materialRef.current.uniforms.uDmSeed.value = safeSeed
      materialRef.current.uniforms.uDmSizeVariation.value = dm_size_variation
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
          fragmentShader={currentTool === 'DATAMOSH' ? datamoshFragmentShader : fragmentShader}
          uniforms={uniforms}
        />
      </mesh>
    </>
  )
})

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
