import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCategoryFromDescription, getDefaultCategories } from '../utils/categorizer'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { Upload, FileSpreadsheet, ChevronRight, Check, ArrowLeft, Save } from 'lucide-react'

const generateHash = (str) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36) + str.length.toString(36)
}

const generateImportHash = () => {
  return generateHash(Date.now().toString() + Math.random().toString(36).substring(2))
}

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
  const [fileHash, setFileHash] = useState(null)
  const [fileAlreadyImported, setFileAlreadyImported] = useState(false)
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

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setLoading(true)
    setFileAlreadyImported(false)

    const reader = new FileReader()
    reader.onload = async (event) => {
      const arrayBuffer = event.target.result
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      const fileHash = hashHex.substring(0, 16)
      
      setFileHash(fileHash)

      const { data: existingImport } = await supabase
        .from('transactions')
        .select('import_hash')
        .eq('import_hash', fileHash)
        .limit(1)

      if (existingImport && existingImport.length > 0) {
        setFileAlreadyImported(true)
      }

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
        const data = new Uint8Array(arrayBuffer)
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
      } else {
        alert('Formato não suportado. Use CSV ou Excel.')
        setLoading(false)
      }
    }
    reader.readAsArrayBuffer(selectedFile)
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
    const isCartaoCredito = account?.type === 'cartao_credito'
    
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

      if (isCartaoCredito) {
        if (amount > 0) {
          amount = -Math.abs(amount)
          type = 'expense'
        } else {
          amount = Math.abs(amount)
          type = 'income'
        }
      }

      if (descValue && descValue.toLowerCase().includes('pagamento recebido')) {
        return null
      }

      const category = type === 'expense' ? getCategoryFromDescription(descValue) : 'Receita'

      return {
        date,
        description: descValue,
        amount: type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
        type,
        category,
        importHash: fileHash
      }
    }).filter(t => t && t.date && t.description)

    const filteredTransactions = filterPixDuplicates(processed, account?.type)
    
    setTransactions(filteredTransactions)
    setStep(3)
  }

  const filterPixDuplicates = (transactions, accountType) => {
    if (accountType !== 'conta_corrente') {
      return transactions
    }

    const transactionsByDate = {}
    transactions.forEach((t, index) => {
      if (!transactionsByDate[t.date]) {
        transactionsByDate[t.date] = []
      }
      transactionsByDate[t.date].push({ ...t, originalIndex: index })
    })

    const toRemove = new Set()

    Object.values(transactionsByDate).forEach(dayTransactions => {
      const valueMap = {}
      
      dayTransactions.forEach(t => {
        const absValue = Math.abs(t.amount)
        if (!valueMap[absValue]) {
          valueMap[absValue] = []
        }
        valueMap[absValue].push(t)
      })

      Object.values(valueMap).forEach(sameValueTransactions => {
        const income = sameValueTransactions.find(t => t.amount > 0)
        const expense = sameValueTransactions.find(t => t.amount < 0)

        if (income && expense) {
          toRemove.add(income.originalIndex)
          toRemove.add(expense.originalIndex)
        }
      })
    })

    return transactions.filter((_, index) => !toRemove.has(index))
  }

  const handleImport = async () => {
    setImporting(true)

    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('import_hash', fileHash)
      .limit(1)

    if (existing && existing.length > 0) {
      alert('Este arquivo já foi importado anteriormente.')
      setImporting(false)
      return
    }

    const toInsert = transactions.map(t => ({
        account_id: accountId,
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.type,
        category: t.category,
        import_hash: t.importHash
      }))

    const { error } = await supabase
      .from('transactions')
      .insert(toInsert)

    if (error) {
      alert('Erro ao importar: ' + error.message)
    } else {
      const skipped = transactions.length - toInsert.length
      if (skipped > 0) {
        alert(`${toInsert.length} transações importadas! ${skipped} duplicadas foram ignoradas.`)
      } else {
        alert(`${toInsert.length} transações importadas com sucesso!`)
      }
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

  const isStepComplete = (stepNum) => {
    if (stepNum < step) return true
    if (stepNum === step) return 'active'
    return false
  }

  return (
    <div className="import-page">
      {/* Step Indicator */}
      <div className="steps-indicator">
        <div className={`step ${isStepComplete(1) === true ? 'complete' : isStepComplete(1)}`}>
          <div className="step-icon">
            {isStepComplete(1) === true ? <Check size={16} /> : '1'}
          </div>
          <span>Arquivo</span>
        </div>
        <div className="step-line"></div>
        <div className={`step ${isStepComplete(2) === true ? 'complete' : isStepComplete(2)}`}>
          <div className="step-icon">
            {isStepComplete(2) === true ? <Check size={16} /> : '2'}
          </div>
          <span>Mapeamento</span>
        </div>
        <div className="step-line"></div>
        <div className={`step ${isStepComplete(3) === true ? 'complete' : isStepComplete(3)}`}>
          <div className="step-icon">
            {isStepComplete(3) === true ? <Check size={16} /> : '3'}
          </div>
          <span>Revisão</span>
        </div>
      </div>

      {step === 1 && (
        <div className="upload-section">
          {file && (
            <div className="file-selected">
              <span className="file-name">{file.name}</span>
              {fileAlreadyImported && (
                <span className="file-warning">⚠️ Este arquivo já foi importado</span>
              )}
            </div>
          )}
          
          <div className="upload-card">
            <div className="upload-icon">
              <FileSpreadsheet size={48} />
            </div>
            <h3>Selecione o arquivo</h3>
            <p>Escolha o arquivo do seu extrato bancário</p>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              id="file-upload"
              className="file-input"
            />
            <label htmlFor="file-upload" className="btn-upload">
              <Upload size={18} />
              Selecionar Arquivo
            </label>
            
            <span className="upload-formats">CSV, Excel (.xlsx, .xls)</span>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mapping-section">
          <div className="mapping-card">
            <h3>Mapeamento de Colunas</h3>
            <p>Associe as colunas do arquivo aos campos do sistema</p>

            <button onClick={autoDetectColumns} className="btn-auto-detect">
              <span>✨</span> Auto-detectar
            </button>

            <div className="mapping-fields">
              <div className="mapping-field">
                <label>Data</label>
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

              <div className="mapping-field">
                <label>Descrição</label>
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

              <div className="mapping-field">
                <label>Valor</label>
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

              <div className="mapping-field">
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

            <div className="preview-mini">
              <h4>Preview: {file?.name}</h4>
              <div className="preview-scroll">
                <table>
                  <thead>
                    <tr>
                      {columns.slice(0, 4).map(col => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 3).map((row, i) => (
                      <tr key={i}>
                        {columns.slice(0, 4).map(col => (
                          <td key={col}>{String(row[col]).substring(0, 20)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="step-actions">
              <button onClick={() => { setStep(1); setFile(null) }} className="btn-secondary">
                <ArrowLeft size={18} />
                Voltar
              </button>
              <button 
                onClick={processTransactions}
                disabled={!mapping.date || !mapping.description || !mapping.amount}
                className="btn-primary"
              >
                Continuar
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="review-section">
          <div className="review-card">
            <div className="review-header">
              <h3>Revisar Transações</h3>
              <span className="transaction-count">{transactions.length} encontradas</span>
            </div>

            <div className="transactions-review">
              {transactions.slice(0, 30).map((t, i) => (
                <div key={i} className="transaction-review-item">
                  <div className="review-info">
                    <span className="review-date">{t.date}</span>
                    <span className="review-desc">{t.description}</span>
                  </div>
                  <div className="review-right">
                    <span className={`review-amount ${t.type}`}>
                      {t.type === 'expense' ? '-' : '+'}{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(t.amount))}
                    </span>
                    {t.type === 'expense' && (
                      <select
                        value={t.category}
                        onChange={e => updateCategory(i, e.target.value)}
                        className="review-category"
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
              {transactions.length > 30 && (
                <div className="more-transactions">+ {transactions.length - 30} transações</div>
              )}
            </div>

            <div className="step-actions">
              <button onClick={() => setStep(2)} className="btn-secondary">
                <ArrowLeft size={18} />
                Voltar
              </button>
              <button onClick={handleImport} disabled={importing} className="btn-primary">
                <Save size={18} />
                {importing ? 'Importando...' : `Importar ${transactions.length}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
