-- ControlFin - Script SQL para Supabase

-- Tabela de contas bancárias
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  bank TEXT NOT NULL,
  balance DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de transações
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para accounts
CREATE POLICY "Users can view own accounts" ON accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts" ON accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts" ON accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts" ON accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para transactions
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM accounts WHERE id = transactions.account_id)
  );

CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT user_id FROM accounts WHERE id = transactions.account_id)
  );

CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (
    auth.uid() IN (SELECT user_id FROM accounts WHERE id = transactions.account_id)
  );

CREATE POLICY "Users can delete own transactions" ON transactions
  FOR DELETE USING (
    auth.uid() IN (SELECT user_id FROM accounts WHERE id = transactions.account_id)
  );

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
