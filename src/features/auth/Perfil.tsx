import { useAuth } from '../../app/providers'

export function Perfil() {
  const { usuario } = useAuth()

  return (
    <div>
      <h1>Perfil</h1>

      <p>Nome: {usuario?.nome}</p>
      <p>E-mail: {usuario?.email}</p>
      <p>Perfil: {usuario?.perfil}</p>
    </div>
  )
}
