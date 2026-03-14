import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export const Accounts = () => {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ name: '', bank: '', balance: 0 })
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    if (user) {
      loadAccounts()
    }
  }, [user])

  const loadAccounts = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    
    setAccounts(data || [])
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    


    if (editingId) {
      await supabase
        .from('accounts')
        .update({ name: formData.name, bank: formData.bank, balance: formData.balance })
        .eq('id', editingId)
    } else {
      await supabase
        .from('accounts')
        .insert({ user_id: user.id, name: formData.name, bank: formData.bank, balance: formData.balance })
    }

    setFormData({ name: '', bank: '', balance: 0 })
    setEditingId(null)
    setShowModal(false)
    loadAccounts()
  }

  const handleEdit = (account) => {
    setFormData({ name: account.name, bank: account.bank, balance: account.balance })
    setEditingId(account.id)
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (confirm('Tem certeza que deseja excluir esta conta? Todas as transações também serão excluídas.')) {
      await supabase.from('transactions').delete().eq('account_id', id)
      await supabase.from('accounts').delete().eq('id', id)
      loadAccounts()
    }
  }

  const openNewModal = () => {
    setFormData({ name: '', bank: '', balance: 0 })
    setEditingId(null)
    setShowModal(true)
  }

  if (loading) {
    return <div className="loading">Carregando...</div>
  }

  return (
    <div className="accounts-page">
      <div className="page-header">
        <h1>Minhas Contas</h1>
        <button onClick={openNewModal} className="btn-primary">
          + Nova Conta
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="empty-state">
          <p>Nenhuma conta cadastrada.</p>
          <p>Adicione uma conta para começar.</p>
        </div>
      ) : (
        <div className="accounts-grid">
          {accounts.map(account => (
            <div key={account.id} className="account-card">
              <h3>{account.name}</h3>
              <p className="bank">{account.bank}</p>
              <p className="balance">
                Saldo: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(account.balance || 0)}
              </p>
              <div className="account-actions">
                <button onClick={() => handleEdit(account)} className="btn-secondary">Editar</button>
                <button onClick={() => handleDelete(account.id)} className="btn-danger">Excluir</button>
              </div>
              <a href={`/import/${account.id}`} className="btn-import">
                Importar Extrato
              </a>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editingId ? 'Editar Conta' : 'Nova Conta'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nome da Conta</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Ex: Conta Corrente"
                />
              </div>
              <div className="form-group">
                <label>Banco</label>
                <input
                  type="text"
                  value={formData.bank}
                  onChange={e => setFormData({ ...formData, bank: e.target.value })}
                  required
                  placeholder="Ex: Nubank, Itaú, Banco do Brasil"
                />
              </div>
              <div className="form-group">
                <label>Saldo Inicial</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.balance}
                  onChange={e => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingId ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
