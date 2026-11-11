import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

import App from './App'
import { AuthProvider } from './app/providers'
import { configuracaoValida } from './lib/supabase'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {configuracaoValida ? <AuthProvider>
      <App />
    </AuthProvider> : <p role="alert">Configuração de acesso ausente ou inválida. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY antes de iniciar o sistema.</p>}
  </StrictMode>,
)
