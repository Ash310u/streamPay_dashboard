import { create } from "zustand";

interface Wallet {
  id: string;
  balance_crypto: string;
  balance_inr_equivalent: string;
  currency_code: string;
}

type Transaction = {
  id: string;
  type: string;
  inr_amount: number;
  created_at: string;
  status: string;
};

interface AppState {
  activeSessionId: string | null;
  liveChargeInr: number;
  wallet: Wallet | null;
  walletTransactions: Transaction[] | null;
  setActiveSession: (sessionId: string | null) => void;
  setLiveCharge: (amount: number) => void;
  setWallet: (wallet: Wallet) => void;
  setTransactions: (txns: Transaction[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeSessionId: null,
  liveChargeInr: 0,
  wallet: null,
  walletTransactions: null,
  setActiveSession: (activeSessionId) => set({ activeSessionId }),
  setLiveCharge: (liveChargeInr) => set({ liveChargeInr }),
  setWallet: (wallet) => set({ wallet }),
  setTransactions: (walletTransactions) => set({ walletTransactions })
}));

