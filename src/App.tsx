import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Library from './components/Library/Library'
import Viewer from './components/Viewer/Viewer'
import Navbar from './components/UI/Navbar'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Library />} />
            <Route path="/read/:bookId" element={<Viewer />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
