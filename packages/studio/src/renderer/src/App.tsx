import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import WritingConsole from './pages/WritingConsole'
import ChapterManager from './pages/ChapterManager'
import TruthFiles from './pages/TruthFiles'
import LLMSettings from './pages/LLMSettings'
import ExportPage from './pages/ExportPage'

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/writing" element={<WritingConsole />} />
        <Route path="/chapters" element={<ChapterManager />} />
        <Route path="/truth-files" element={<TruthFiles />} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="/settings" element={<LLMSettings />} />
      </Route>
    </Routes>
  )
}
