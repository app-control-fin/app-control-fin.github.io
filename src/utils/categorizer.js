const DEFAULT_KEYWORDS = {
  'Alimentação': ['mercado', 'supermercado', ' Restaurante', 'lanchonete', 'pizza', 'hamburguer', 'ifood', 'uber eats', ' Rappi', 'cafe', 'café', 'padaria', 'panificadora'],
  'Transporte': ['uber', '99', 'taxi', 'combustível', 'gasolina', 'etanol', 'diesel', 'posto', 'metrô', 'ônibus', 'trem', 'rodoviária', 'estacionamento', 'pedágio'],
  'Lazer': ['cinema', 'theatro', 'teatro', 'show', 'concerto', 'Netflix', 'Spotify', 'HBO', 'Disney', 'steam', 'playstation', 'xbox', 'game', 'jogo'],
  'Saúde': ['farmácia', 'drogaria', 'hospital', 'clínica', 'médico', 'dentista', 'laboratório', 'exame', 'vacina', 'plano de saúde'],
  'Educação': ['curso', 'escola', 'universidade', 'faculdade', 'livraria', 'amazon', 'ebook', 'assinatura'],
  'Moradia': ['aluguel', 'condomínio', 'IPTU', 'luz', 'água', 'gás', 'internet', 'telefone', 'net', 'vivo', 'claro', 'oi'],
  'Salário': ['salário', 'holerite', 'pagamento', 'depósito', 'transferência', 'recebimento'],
  'Investimento': ['investimento', 'rendimento', 'juros', 'aplicação', 'CDB', 'Tesouro', 'Fundos', 'Ações', 'criptomoeda', 'bitcoin'],
  'Cartão': ['cartão', 'credito', 'débito', 'parcelamento', 'anuidade'],
  'Outros': []
}

export const getCategoryFromDescription = (description, customKeywords = {}) => {
  const keywords = { ...DEFAULT_KEYWORDS, ...customKeywords }
  const desc = description.toLowerCase()

  for (const [category, words] of Object.entries(keywords)) {
    if (category === 'Outros') continue
    for (const word of words) {
      if (desc.includes(word.toLowerCase())) {
        return category
      }
    }
  }

  return 'Não categorizado'
}

export const getDefaultCategories = () => Object.keys(DEFAULT_KEYWORDS)
