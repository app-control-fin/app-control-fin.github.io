import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingDown, CreditCard, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react'

const COLORS = ['#6C5CE7', '#00B894', '#FDCB6E', '#FF6B6B', '#A29BFE']

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const getInitialMonth = () => {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() - 1 // Mês anterior
  }
}

const getMonthRange = (year, month) => {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  return {
    startDate: firstDay.toISOString().split('T')[0],
    endDate: lastDay.toISOString().split('T')[0],
    monthValue: `${year}-${String(month + 1).padStart(2, '0')}`
  }
}

export const Dashboard = () => {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(getInitialMonth())
  const [showAllMonths, setShowAllMonths] = useState(false)
  const [dateRange, setDateRange] = useState(() => {
    const { year, month } = getInitialMonth()
    return getMonthRange(year, month)
  })

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user, dateRange])

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
      
      let query = supabase
        .from('transactions')
        .select('*')
        .in('account_id', accountIds)
        .order('date', { ascending: false })

      if (dateRange.startDate) {
        query = query.gte('date', dateRange.startDate)
      }
      if (dateRange.endDate) {
        query = query.lte('date', dateRange.endDate)
      }
      
      const { data: transactionsData } = await query
      
      setTransactions(transactionsData || [])
    }
    
    setLoading(false)
  }

  const handlePrevMonth = () => {
    let newMonth = currentMonth.month - 1
    let newYear = currentMonth.year
    if (newMonth < 0) {
      newMonth = 11
      newYear--
    }
    setCurrentMonth({ year: newYear, month: newMonth })
    setDateRange(getMonthRange(newYear, newMonth))
  }

  const handleNextMonth = () => {
    const now = new Date()
    if (currentMonth.year > now.getFullYear() || 
        (currentMonth.year === now.getFullYear() && currentMonth.month >= now.getMonth())) {
      return
    }
    let newMonth = currentMonth.month + 1
    let newYear = currentMonth.year
    if (newMonth > 11) {
      newMonth = 0
      newYear++
    }
    setCurrentMonth({ year: newYear, month: newMonth })
    setDateRange(getMonthRange(newYear, newMonth))
  }

  const handleMonthSelect = (year, month) => {
    setCurrentMonth({ year, month })
    setDateRange(getMonthRange(year, month))
    setShowAllMonths(false)
  }

  const handleShowAll = () => {
    setCurrentMonth({ year: null, month: null })
    setDateRange({ startDate: '', endDate: '', monthValue: '' })
    setShowAllMonths(false)
  }

  const getFilteredTransactions = () => transactions

  const getCategoryData = () => {
    const filtered = getFilteredTransactions()
    const categories = {}
    filtered
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const cat = t.category || 'Outros'
        categories[cat] = (categories[cat] || 0) + Math.abs(t.amount)
      })

    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }

  const getTopCategories = () => {
    const data = getCategoryData()
    const total = data.reduce((sum, item) => sum + item.value, 0)
    return data.map(item => ({
      ...item,
      percent: total > 0 ? (item.value / total * 100).toFixed(0) : 0
    }))
  }

  const getTotalExpenses = () => {
    return getFilteredTransactions()
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
  }

  const getTransactionCount = () => {
    return getFilteredTransactions().filter(t => t.type === 'expense').length
  }

  const getTopExpense = () => {
    const expenses = getFilteredTransactions()
      .filter(t => t.type === 'expense')
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    return expenses[0] || null
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const canGoNext = () => {
    const now = new Date()
    return currentMonth.year < now.getFullYear() || 
           (currentMonth.year === now.getFullYear() && currentMonth.month < now.getMonth())
  }

  if (loading) {
    return <div className="loading">Carregando...</div>
  }

  const monthLabel = currentMonth.year 
    ? `${MONTH_NAMES[currentMonth.month]} ${currentMonth.year}`
    : 'Todos os períodos'

  return (
    <div className="page-container">
      {/* Month Selector */}
      <div className="month-selector">
        <button onClick={handlePrevMonth} className="month-nav-btn">
          <ChevronLeft size={24} />
        </button>
        
        <div className="month-current" onClick={() => setShowAllMonths(!showAllMonths)}>
          <span className="month-label">{monthLabel}</span>
          <span className="month-hint">toque para mudar</span>
        </div>
        
        <button 
          onClick={handleNextMonth} 
          className={`month-nav-btn ${!canGoNext() ? 'disabled' : ''}`}
          disabled={!canGoNext()}
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Month Dropdown */}
      {showAllMonths && (
        <div className="month-dropdown">
          <button 
            className={`month-option ${!currentMonth.year ? 'active' : ''}`}
            onClick={handleShowAll}
          >
            Todos os períodos
          </button>
          {Array.from({ length: 12 }, (_, i) => {
            const now = new Date()
            const year = now.getFullYear()
            const month = now.getMonth() - i
            let displayYear = year
            let displayMonth = month
            if (month < 0) {
              displayMonth = 12 + month
              displayYear = year - 1
            }
            return (
              <button
                key={`${displayYear}-${displayMonth}`}
                className={`month-option ${currentMonth.year === displayYear && currentMonth.month === displayMonth ? 'active' : ''}`}
                onClick={() => handleMonthSelect(displayYear, displayMonth)}
              >
                {MONTH_NAMES[displayMonth]} {displayYear}
              </button>
            )
          })}
        </div>
      )}

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card highlight">
          <div className="summary-card-header">
            <h3>Total de Gastos</h3>
            <div className="summary-card-icon red">
              <TrendingDown size={20} />
            </div>
          </div>
          <p className="expense">{formatCurrency(getTotalExpenses())}</p>
          <span className="summary-sub">{getTransactionCount()} transações</span>
        </div>
        
        <div className="summary-card">
          <div className="summary-card-header">
            <h3>Maior Gasto</h3>
            <div className="summary-card-icon purple">
              <CreditCard size={20} />
            </div>
          </div>
          {getTopExpense() ? (
            <>
              <p className="expense">{formatCurrency(Math.abs(getTopExpense().amount))}</p>
              <span className="summary-sub">{getTopExpense().description?.substring(0, 25)}...</span>
            </>
          ) : (
            <p className="no-data">-</p>
          )}
        </div>
      </div>

      {/* Top Categories - Horizontal Bar */}
      <div className="chart-card">
        <h3>
          <BarChart3 size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
          Top 5 Categorias
        </h3>
        
        {getTopCategories().length === 0 ? (
          <div className="empty-chart">Nenhuma categoria encontrada</div>
        ) : (
          <div className="top-categories">
            {getTopCategories().map((cat, index) => (
              <div key={cat.name} className="category-row">
                <div className="category-info">
                  <span className="category-rank">{index + 1}</span>
                  <span className="category-name">{cat.name}</span>
                </div>
                <div className="category-bar-container">
                  <div 
                    className="category-bar" 
                    style={{ 
                      width: `${cat.percent}%`,
                      backgroundColor: COLORS[index % COLORS.length]
                    }}
                  />
                </div>
                <span className="category-value">{formatCurrency(cat.value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pie Chart */}
      {transactions.length === 0 ? (
        <div className="empty-state">
          <p>Nenhuma transação encontrada.</p>
          <p>Importe seu extrato na página de Contas.</p>
        </div>
      ) : (
        <div className="chart-card">
          <h3>Distribuição por Categoria</h3>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={getCategoryData()}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                innerRadius={45}
                fill="#8884d8"
                dataKey="value"
                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
                  const RADIAN = Math.PI / 180
                  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
                  const x = cx + radius * Math.cos(-midAngle * RADIAN)
                  const y = cy + radius * Math.sin(-midAngle * RADIAN)
                  return percent > 0.05 ? (
                    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12}>
                      {`${(percent * 100).toFixed(0)}%`}
                    </text>
                  ) : null
                }}
              >
                {getCategoryData().map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value, name) => [formatCurrency(value), name]}
                contentStyle={{ 
                  background: '#1A1A24', 
                  border: '1px solid #2D2D3A',
                  borderRadius: '8px'
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
