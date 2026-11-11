import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

function validarConfiguracao() {
  try {
    const url = new URL(supabaseUrl)
    return Boolean(url.hostname && ['http:', 'https:'].includes(url.protocol) && supabaseAnonKey?.trim())
  } catch { return false }
}
export const configuracaoValida = validarConfiguracao()

export const supabase = createClient(
  configuracaoValida ? supabaseUrl : 'https://configuracao-ausente.invalid',
  configuracaoValida ? supabaseAnonKey : 'configuracao-ausente'
)
