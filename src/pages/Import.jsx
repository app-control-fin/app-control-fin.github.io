import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCategoryFromDescription, getDefaultCategories } from '../utils/categorizer'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export const Import = () => {
  const { accountId } = useParams()
  const navigate = useNavigate()
  const [account, setAccount] = useState(null)
  const [step, setStep] = useState(1)
  const [file, setFile] = useState(null)
  const [rawData, setRawData] = useState([])
  const [columns, setColumns] = useState([])
  const [mapping, setMapping] = useState({ date: '', description: '', amount: '', type: '' })
  const [preview, setPreview] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    loadAccount()
  }, [accountId])

  const loadAccount = async () => {
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', accountId)
      .single()
    
    setAccount(data)
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setLoading(true)

    const extension = selectedFile.name.split('.').pop().toLowerCase()

    if (extension === 'csv') {
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processData(results.data)
        }
      })
    } else if (['xlsx', 'xls'].includes(extension)) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })
        
        if (jsonData.length > 0) {
          const headers = jsonData[0].map((h, i) => h || `Coluna ${i + 1}`)
          const rows = jsonData.slice(1).map(row => {
            const obj = {}
            headers.forEach((h, i) => {
              obj[h] = row[i]
            })
            return obj
          })
          processData(rows, headers)
        }
      }
      reader.readAsArrayBuffer(selectedFile)
    } else {
      alert('Formato não suportado. Use CSV ou Excel.')
      setLoading(false)
    }
  }

  const processData = (data, headers = null) => {
    const validData = data.filter(row => {
      const values = Object.values(row)
      return values.some(v => v !== null && v !== undefined && v !== '')
    })

    setRawData(validData)
    
    if (headers) {
      setColumns(headers)
    } else {
      setColumns(Object.keys(validData[0] || {}))
    }
    
    setPreview(validData.slice(0, 5))
    setStep(2)
    setLoading(false)
  }

  const autoDetectColumns = () => {
    const sample = rawData[0] || {}
    const newMapping = { ...mapping }

    columns.forEach(col => {
      const lowerCol = col.toLowerCase()
      const sampleValue = String(sample[col] || '').toLowerCase()

      if (!newMapping.date && (lowerCol.includes('data') || lowerCol.includes('date'))) {
        newMapping.date = col
      }
      if (!newMapping.description && (lowerCol.includes('descri') || lowerCol.includes('historico') || lowerCol.includes('detail'))) {
        newMapping.description = col
      }
      if (!newMapping.amount && (lowerCol.includes('valor') || lowerCol.includes('amount') || lowerCol.includes('value'))) {
        newMapping.amount = col
      }
      if (!newMapping.type && (lowerCol.includes('tipo') || lowerCol.includes('type') || lowerCol.includes('credito') || lowerCol.includes('debito'))) {
        newMapping.type = col
      }
    })

    setMapping(newMapping)
  }

  const processTransactions = () => {
    const processed = rawData.map(row => {
      const dateValue = row[mapping.date]
      const descValue = row[mapping.description]
      const amountValue = row[mapping.amount]
      const typeValue = mapping.type ? row[mapping.type] : null

      let date = dateValue
      if (dateValue instanceof Date) {
        date = dateValue.toISOString().split('T')[0]
      } else if (typeof dateValue === 'number') {
        const excelDate = new Date((dateValue - 25569) * 86400 * 1000)
        date = excelDate.toISOString().split('T')[0]
      } else if (typeof dateValue === 'string') {
        const dateStr = dateValue.trim()
        if (dateStr.includes('/')) {
          const parts = dateStr.split('/')
          if (parts.length === 3) {
            const day = parts[0].padStart(2, '0')
            const month = parts[1].padStart(2, '0')
            const year = parts[2].length === 2 ? '20' + parts[2] : parts[2]
            date = `${year}-${month}-${day}`
          }
        }
      }

      let amount = 0
      if (typeof amountValue === 'string') {
        amount = parseFloat(amountValue.replace('R$', '').replace(/\s/g, '').replace(',', '.'))
      } else {
        amount = parseFloat(amountValue) || 0
      }

      let type = 'expense'
      if (typeValue) {
        const typeStr = String(typeValue).toLowerCase()
        if (typeStr.includes('credito') || typeStr.includes('crédito') || typeStr.includes('receita') || typeStr.includes('deposito')) {
          type = 'income'
        } else if (typeStr.includes('debito') || typeStr.includes('débito') || typeStr.includes('despesa')) {
          type = 'expense'
        }
      } else if (amount > 0) {
        type = 'income'
      }

      const category = type === 'expense' ? getCategoryFromDescription(descValue) : 'Receita'

      return {
        date,
        description: descValue,
        amount: type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
        type,
        category
      }
    }).filter(t => t.date && t.description)

    setTransactions(processed)
    setStep(3)
  }

  const handleImport = async () => {
    setImporting(true)

    const toInsert = transactions.map(t => ({
      account_id: accountId,
      date: t.date,
      description: t.description,
      amount: t.amount,
      type: t.type,
      category: t.category
    }))

    const { error } = await supabase
      .from('transactions')
      .insert(toInsert)

    if (error) {
      alert('Erro ao importar: ' + error.message)
    } else {
      alert(`${toInsert.length} transações importadas com sucesso!`)
      navigate('/accounts')
    }

    setImporting(false)
  }

  const updateCategory = (index, newCategory) => {
    const updated = [...transactions]
    updated[index].category = newCategory
    setTransactions(updated)
  }

  const categories = getDefaultCategories()

  return (
    <div className="import-page">
      <div className="page-header">
        <h1>Importar Extrato</h1>
        {account && <p>Conta: {account.name} - {account.bank}</p>}
      </div>

      {step === 1 && (
        <div className="upload-section">
          <div 
            className="upload-area"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <p>Clique para selecionar ou arraste o arquivo</p>
            <p className="sub-text">Formatos aceitos: CSV, Excel (.xlsx, .xls)</p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mapping-section">
          <h2>Mapeamento de Colunas</h2>
          <p className="sub-text">Selecione quais colunas correspondem a cada campo</p>

          <button onClick={autoDetectColumns} className="btn-secondary auto-detect">
            Auto-detectar Colunas
          </button>

          <div className="mapping-grid">
            <div className="form-group">
              <label>Data *</label>
              <select
                value={mapping.date}
                onChange={e => setMapping({ ...mapping, date: e.target.value })}
                required
              >
                <option value="">Selecione</option>
                {columns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Descrição *</label>
              <select
                value={mapping.description}
                onChange={e => setMapping({ ...mapping, description: e.target.value })}
                required
              >
                <option value="">Selecione</option>
                {columns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Valor *</label>
              <select
                value={mapping.amount}
                onChange={e => setMapping({ ...mapping, amount: e.target.value })}
                required
              >
                <option value="">Selecione</option>
                {columns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Tipo (opcional)</label>
              <select
                value={mapping.type}
                onChange={e => setMapping({ ...mapping, type: e.target.value })}
              >
                <option value="">Selecione</option>
                {columns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="preview-section">
            <h3>Preview (primeiras 5 linhas)</h3>
            <table className="preview-table">
              <thead>
                <tr>
                  {columns.map(col => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    {columns.map(col => (
                      <td key={col}>{row[col]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="step-actions">
            <button onClick={() => { setStep(1); setFile(null) }} className="btn-secondary">
              Voltar
            </button>
            <button 
              onClick={processTransactions}
              disabled={!mapping.date || !mapping.description || !mapping.amount}
              className="btn-primary"
            >
              Processar
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="review-section">
          <h2>Revisar Transações</h2>
          <p className="sub-text">{transactions.length} transações encontradas</p>

          <div className="transactions-list">
            {transactions.slice(0, 50).map((t, i) => (
              <div key={i} className="transaction-item">
                <div className="transaction-info">
                  <span className="date">{t.date}</span>
                  <span className="description">{t.description}</span>
                </div>
                <div className="transaction-details">
                  <span className={`amount ${t.type}`}>
                    {t.type === 'income' ? '+' : ''}{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount)}
                  </span>
                  {t.type === 'expense' && (
                    <select
                      value={t.category}
                      onChange={e => updateCategory(i, e.target.value)}
                      className="category-select"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ))}
            {transactions.length > 50 && (
              <p className="more-items">+ {transactions.length - 50} transações</p>
            )}
          </div>

          <div className="step-actions">
            <button onClick={() => setStep(2)} className="btn-secondary">
              Voltar
            </button>
            <button onClick={handleImport} disabled={importing} className="btn-primary">
              {importing ? 'Importando...' : `Importar ${transactions.length} Transações`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
