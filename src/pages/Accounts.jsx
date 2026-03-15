import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Plus, CreditCard, Building2, Edit2, Trash2, Upload, Wallet, History, X } from 'lucide-react'

export const Accounts = () => {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showImportHistory, setShowImportHistory] = useState(null)
  const [importHistory, setImportHistory] = useState([])
  const [formData, setFormData] = useState({ name: '', bank: '', type: 'conta_corrente' })
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    if (user) loadAccounts()
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

  const loadImportHistory = async (accountId) => {
    const { data } = await supabase
      .from('transactions')
      .select('import_hash, date, amount')
      .eq('account_id', accountId)
      .not('import_hash', 'is', null)
      .order('date', { ascending: false })

    if (data) {
      const hashes = {}
      data.forEach(t => {
        if (t.import_hash) {
          if (!hashes[t.import_hash]) {
            hashes[t.import_hash] = { hash: t.import_hash, date: t.date, count: 0, total: 0 }
          }
          hashes[t.import_hash].count++
          hashes[t.import_hash].total += Math.abs(t.amount)
        }
      })
      setImportHistory(Object.values(hashes).sort((a, b) => new Date(b.date) - new Date(a.date)))
    }
  }

  const handleShowHistory = async (accountId) => {
    await loadImportHistory(accountId)
    setShowImportHistory(accountId)
  }

  const handleDeleteImport = async (hash, accountId) => {
    const count = importHistory.find(h => h.hash === hash)?.count || 0
    const total = importHistory.find(h => h.hash === hash)?.total || 0
    
    if (confirm(`Excluir ${count} transações? Total: R$ ${total.toFixed(2)}`)) {
      await supabase.from('transactions').delete().eq('import_hash', hash).eq('account_id', accountId)
      await loadImportHistory(accountId)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (editingId) {
      await supabase
        .from('accounts')
        .update({ name: formData.name, bank: formData.bank, type: formData.type })
        .eq('id', editingId)
    } else {
      await supabase
        .from('accounts')
        .insert({ user_id: user.id, name: formData.name, bank: formData.bank, type: formData.type })
    }

    setFormData({ name: '', bank: '', type: 'conta_corrente' })
    setEditingId(null)
    setShowModal(false)
    loadAccounts()
  }

  const handleEdit = (account) => {
    setFormData({ name: account.name, bank: account.bank, type: account.type || 'conta_corrente' })
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
    setFormData({ name: '', bank: '', type: 'conta_corrente' })
    setEditingId(null)
    setShowModal(true)
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  if (loading) return <div className="loading">Carregando...</div>

  return (
    <div className="accounts-page">
      {accounts.length === 0 ? (
        <div className="empty-state">
          <Wallet size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <p>Nenhuma conta cadastrada.</p>
          <p>Adicione uma conta para começar.</p>
          <button onClick={openNewModal} className="btn-primary" style={{ marginTop: '1.5rem' }}>
            <Plus size={18} />
            Adicionar Conta
          </button>
        </div>
      ) : (
        <>
          <button onClick={openNewModal} className="btn-add-account">
            <Plus size={20} />
            Adicionar Conta
          </button>

          <div className="accounts-grid">
            {accounts.map(account => (
              <div key={account.id} className="account-card">
                {showImportHistory === account.id ? (
                  <div className="import-history-panel">
                    <div className="history-header">
                      <h3>Histórico de Importações</h3>
                      <button onClick={() => setShowImportHistory(null)} className="btn-close-history">
                        <X size={18} />
                      </button>
                    </div>
                    {importHistory.length === 0 ? (
                      <p className="no-history">Nenhuma importação</p>
                    ) : (
                      <div className="history-list">
                        {importHistory.map(h => (
                          <div key={h.hash} className="history-item">
                            <div className="history-info">
                              <span className="history-date">{new Date(h.date).toLocaleDateString('pt-BR')}</span>
                              <span className="history-count">{h.count} transações</span>
                            </div>
                            <div className="history-actions">
                              <span className="history-total">{formatCurrency(h.total)}</span>
                              <button 
                                onClick={() => handleDeleteImport(h.hash, account.id)}
                                className="btn-delete-import"
                                title="Excluir importação"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="account-card-header">
                      <div className={`account-icon ${account.type === 'cartao_credito' ? 'card' : 'bank'}`}>
                        {account.type === 'cartao_credito' ? <CreditCard size={24} /> : <Building2 size={24} />}
                      </div>
                      <div className="account-info">
                        <h3>{account.name}</h3>
                        <p className="bank">{account.bank}</p>
                      </div>
                      <div className="account-actions-menu">
                        <button onClick={() => handleEdit(account)} className="btn-icon" title="Editar">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(account.id)} className="btn-icon danger" title="Excluir">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    
                    <a href={`/import/${account.id}`} className="btn-import">
                      <Upload size={18} />
                      Importar Extrato
                    </a>

                    <button onClick={() => handleShowHistory(account.id)} className="btn-history">
                      <History size={16} />
                      Ver Importações
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editingId ? 'Editar Conta' : 'Nova Conta'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Tipo da Conta</label>
                <div className="type-selector">
                  <button
                    type="button"
                    className={`type-option ${formData.type === 'conta_corrente' ? 'active' : ''}`}
                    onClick={() => setFormData({ ...formData, type: 'conta_corrente' })}
                  >
                    <Building2 size={20} />
                    <span>Conta Corrente</span>
                  </button>
                  <button
                    type="button"
                    className={`type-option ${formData.type === 'cartao_credito' ? 'active' : ''}`}
                    onClick={() => setFormData({ ...formData, type: 'cartao_credito' })}
                  >
                    <CreditCard size={20} />
                    <span>Cartão de Crédito</span>
                  </button>
                </div>
              </div>
              
              <div className="form-group">
                <label>Nome da Conta</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Ex: Minha Conta Principal"
                />
              </div>
              
              <div className="form-group">
                <label>Banco</label>
                <input
                  type="text"
                  value={formData.bank}
                  onChange={e => setFormData({ ...formData, bank: e.target.value })}
                  required
                  placeholder="Ex: Nubank, Itaú"
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
