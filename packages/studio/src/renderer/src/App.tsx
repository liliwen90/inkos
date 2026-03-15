import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import WritingConsole from './pages/WritingConsole'
import ChapterManager from './pages/ChapterManager'
import TruthFiles from './pages/TruthFiles'
import LLMSettings from './pages/LLMSettings'
import ExportPage from './pages/ExportPage'
import StyleAnalysis from './pages/StyleAnalysis'
import AIGCDetection from './pages/AIGCDetection'
import HumanizeEngine from './pages/HumanizeEngine'
import AISuggestions from './pages/AISuggestions'

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/writing" element={<WritingConsole />} />
        <Route path="/chapters" element={<ChapterManager />} />
        <Route path="/truth-files" element={<TruthFiles />} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="/style-analysis" element={<StyleAnalysis />} />
        <Route path="/detection" element={<AIGCDetection />} />
        <Route path="/humanize" element={<HumanizeEngine />} />
        <Route path="/suggestions" element={<AISuggestions />} />
        <Route path="/settings" element={<LLMSettings />} />
      </Route>
    </Routes>
  )
}
