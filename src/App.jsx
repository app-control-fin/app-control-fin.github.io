import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Header } from './components/Header'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'
import { Accounts } from './pages/Accounts'
import { Import } from './pages/Import'
import './App.css'

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="loading">Carregando...</div>
  }

  if (!user) {
    return <Navigate to="/login" />
  }

  return children
}

const AppRoutes = () => {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="loading">Carregando...</div>
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
      
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Header />
          <Dashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/accounts" element={
        <ProtectedRoute>
          <Header />
          <Accounts />
        </ProtectedRoute>
      } />
      
      <Route path="/import/:accountId" element={
        <ProtectedRoute>
          <Header />
          <Import />
        </ProtectedRoute>
      } />
      
      <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
