import { Stage } from './components/Stage'
import { LabOverlay } from './components/UI'
import { useStore } from './store'

function App() {
  const currentTool = useStore((state) => state.currentTool)

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white selection:bg-[#f27200] selection:text-white">
      {currentTool === 'DITHER' && <Stage />}
      <LabOverlay />
    </div>
  )
}

export default App
