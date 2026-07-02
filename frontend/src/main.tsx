import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const root = document.getElementById('root');
if (!root) throw new Error('找不到 #root 元素，请检查 index.html');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
