# Entropy

**Entropy** is a high-performance, browser-based image processing tool focused on advanced dithering and color grading. It leverages WebGL for real-time rendering, allowing users to apply complex dithering algorithms and color manipulations instantly, even on high-resolution images.

## 🛠 Tech Stack

- **Core:** [React](https://react.dev/) (v18), [TypeScript](https://www.typescriptlang.org/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Rendering:** [Three.js](https://threejs.org/) via [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber)
- **State Management:** [Zustand](https://github.com/pmndrs/zustand) (with Persistence & History middleware)
- **Styling:** Tailwind CSS (via utility classes)

## 🏗 Architecture

The application is built around a single WebGL canvas (`Stage`) and a floating UI layer (`UI`).

### 1. State Management (`src/store/index.ts`)

The application state is centralized in a Zustand store, which handles:

- **Image Data:** URL, dimensions.
- **Processing Parameters:** Dither strength, scale, algorithm, color adjustments.
- **History:** Custom Undo/Redo implementation using `past` and `future` arrays.
- **Persistence:** `persist` middleware saves tool state and settings to `localStorage`, excluding transient data like the loaded image.

### 2. Rendering Pipeline (`src/components/Stage.tsx`)

Rendering is performed using a single full-screen quad (`ScreenQuad`) with a custom `ShaderMaterial`.

- **Vertex Shader:** Standard pass-through.
- **Fragment Shader:** The core processing engine.
  1.  **Color Grading:**
      - **Brightness/Contrast:** Standard linear adjustments.
      - **Shadows/Highlights:** Luma-based masking to target specific tonal ranges.
      - **Levels (Blacks/Whites):** Input/Output level remapping.
      - **Gamma/Saturation:** Power functions and vector mixing.
      - **Vibrance:** Saturation adjustment weighted by current saturation (prevents clipping).
  2.  **Dithering:**
      - **Bayer Matrices:** 2x2, 4x4, 8x8 ordered dithering.
      - **Halftone:** Rotated grid patterns (45°, 22°).
      - **Noise:** White noise dithering.
  3.  **Palette Mapping:**
      - Maps each pixel to the nearest color in the active palette using Euclidean distance.
  4.  **Datamosh (Block Displacement):**
      - Simulates video compression artifacts on static images.
      - **Block Displacement:** Uses noise-driven vector fields to displace pixels in a grid.
      - **Edge Blur:** Mixes stepped (blocky) and smooth (liquid) displacement for organic transitions.
      - **Color Shift:** Inverts colors of displaced blocks based on a density mask.

### 3. Optimization

- **React.memo:** The `ScreenQuad` is memoized to prevent re-renders unless uniforms change.
- **Texture Filtering:** Uses `LinearFilter` for smooth preview scaling on mobile/desktop.
- **Debouncing:** Slider inputs trigger state updates; history is pushed only on interaction start (`onPointerDown`) to group continuous changes.

## 🚀 Features

- **Real-time WebGL Preview:** Zero-latency feedback.
- **Advanced Color Control:**
  - **Shadows/Lights:** Recover detail in dynamic ranges.
  - **Blacks/Whites:** Set precise black/white points.
  - **Vibrance:** Smart saturation.
- **Dithering Algorithms:**
  - Bayer (2x2, 4x4, 8x8)
  - Halftone (45°, 22°)
  - Noise
- **Datamosh Tool:**
  - **Block Size:** Control the granularity of the glitch (from tiny noise to huge blocks).
  - **Density:** Adjust the percentage of the image affected by the distortion.
  - **Color Shift:** Invert colors of displaced blocks for a "corrupted file" aesthetic.
  - **Seed:** Randomize the noise pattern with a text seed (max 16 chars).
  - **Size Variation:** Randomly vary the size of individual blocks (non-uniform grid).
- **Terminal Tool (ASCII):**
  - **Procedural Rendering:** High-performance ASCII shader using 4096px character strips.
  - **Character Size:** Intuitive slider to control text density/size.
  - **Color Control:** Full Rainbow Hue slider + Hex input for precise styling.
  - **Export Options:**
    - **PNG:** Standard raster image (Black background).
    - **PNG (Alpha):** Transparent background (ideal for overlays).
    - **SVG:** Full vector export (text elements) for print/design.
- **Palette System:** Custom 4-color palettes + Presets.
- **State Persistence:** Reloading the page retains your settings and tool position.
- **History:** Robust Undo/Redo system for all parameters.

## 📦 Development

1.  **Install Dependencies:**

    ```bash
    npm install
    ```

2.  **Run Development Server:**

    ```bash
    npm run dev
    ```

3.  **Build for Production:**
    ```bash
    npm run build
    ```
