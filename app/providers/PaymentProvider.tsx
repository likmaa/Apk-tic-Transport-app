import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PaymentMethod = 'cash' | 'mobile_money' | 'card' | 'wallet' | 'qr';
export type PaymentStatus = 'idle' | 'processing' | 'ready' | 'failed';

type PaymentState = {
  method: PaymentMethod;
  setMethod: (m: PaymentMethod) => void;
  walletBalance: number; // FCFA
  refreshWallet: () => Promise<void>;
  paymentStatus: PaymentStatus;
  setPaymentStatus: (s: PaymentStatus) => void;
  walletLoading: boolean;
};

const Ctx = createContext<PaymentState | null>(null);

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export function PaymentProvider({ children }: { children: React.ReactNode }) {
  const [method, setMethodState] = useState<PaymentMethod>('cash');
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [walletLoading, setWalletLoading] = useState(false);

  // Fetch real wallet balance from backend
  const refreshWallet = useCallback(async () => {
    try {
      if (!API_URL) return;
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      setWalletLoading(true);
      const res = await fetch(`${API_URL}/passenger/wallet`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setWalletBalance(data.balance ?? 0);
      }
    } catch (e) {
      console.warn('Wallet fetch error:', e);
    } finally {
      setWalletLoading(false);
    }
  }, []);

  // Load saved method + fetch wallet balance on mount
  useEffect(() => {
    (async () => {
      try {
        const m = await AsyncStorage.getItem('payment_method');
        if (m) setMethodState(m as PaymentMethod);
      } catch { }
    })();
    refreshWallet();
  }, [refreshWallet]);

  // Persist selected method
  useEffect(() => {
    (async () => {
      try { await AsyncStorage.setItem('payment_method', method); } catch { }
    })();
  }, [method]);

  const setMethod = (m: PaymentMethod) => {
    setMethodState(m);
    setPaymentStatus('idle');
  };

  const value = useMemo<PaymentState>(() => ({
    method,
    setMethod,
    walletBalance,
    refreshWallet,
    paymentStatus,
    setPaymentStatus,
    walletLoading,
  }), [method, walletBalance, paymentStatus, walletLoading, refreshWallet]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePaymentStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePaymentStore must be used within PaymentProvider');
  return ctx;
}
