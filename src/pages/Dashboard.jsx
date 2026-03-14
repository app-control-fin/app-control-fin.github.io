import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#a4de6c', '#d0ed57']

export const Dashboard = () => {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    setLoading(true)
    
    const { data: accountsData } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    
    setAccounts(accountsData || [])

    if (accountsData && accountsData.length > 0) {
      const accountIds = accountsData.map(a => a.id)
      
      const { data: transactionsData } = await supabase
        .from('transactions')
        .select('*')
        .in('account_id', accountIds)
        .order('date', { ascending: false })
      
      setTransactions(transactionsData || [])
    }
    
    setLoading(false)
  }

  const getCategoryData = () => {
    const categories = {}
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const cat = t.category || 'Não categorizado'
        categories[cat] = (categories[cat] || 0) + Math.abs(t.amount)
      })

    return Object.entries(categories).map(([name, value]) => ({ name, value }))
  }

  const getMonthlyData = () => {
    const monthly = {}
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const month = t.date.substring(0, 7)
        monthly[month] = (monthly[month] || 0) + Math.abs(t.amount)
      })

    return Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, total]) => ({ month, total }))
  }

  const getTotalExpenses = () => {
    return transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
  }

  const getTotalIncome = () => {
    return transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)
  }

  const getBalance = () => {
    const totalExpenses = getTotalExpenses()
    const totalIncome = getTotalIncome()
    const accountsBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0)
    return accountsBalance + totalIncome - totalExpenses
  }

  const getTopCategory = () => {
    const categoryData = getCategoryData()
    if (categoryData.length === 0) return '-'
    const top = categoryData.reduce((a, b) => a.value > b.value ? a : b)
    return top.name
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  if (loading) {
    return <div className="loading">Carregando...</div>
  }

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      
      <div className="summary-cards">
        <div className="summary-card">
          <h3>Saldo Total</h3>
          <p className={`balance ${getBalance() >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(getBalance())}
          </p>
        </div>
        <div className="summary-card">
          <h3>Receitas</h3>
          <p className="income">{formatCurrency(getTotalIncome())}</p>
        </div>
        <div className="summary-card">
          <h3>Despesas</h3>
          <p className="expense">{formatCurrency(getTotalExpenses())}</p>
        </div>
        <div className="summary-card">
          <h3>Maior Categoria</h3>
          <p>{getTopCategory()}</p>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="empty-state">
          <p>Nenhuma transação encontrada.</p>
          <p>Importe seu extrato na página de Contas.</p>
        </div>
      ) : (
        <div className="charts-container">
          <div className="chart-card">
            <h3>Gastos por Categoria</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={getCategoryData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getCategoryData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3>Evolução de Gastos</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={getMonthlyData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Line type="monotone" dataKey="total" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
