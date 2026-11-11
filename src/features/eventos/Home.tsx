import { useAuth } from '../../app/auth-context'

export function Home() {
  const { usuario } = useAuth()
  return <h1>Olá, {usuario?.nome}</h1>
}
