import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export const Header = () => {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/dashboard" className="logo">ControlFin</Link>
        
        {user && (
          <nav className="nav">
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/accounts">Contas</Link>
            <button onClick={handleLogout} className="btn-logout">
              Sair
            </button>
          </nav>
        )}
      </div>
    </header>
  )
}
