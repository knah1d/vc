import { createContext, useContext, type ReactNode } from 'react';

import { useCalls } from '@/lib/useCalls';

type CallsState = ReturnType<typeof useCalls>;

const CallsContext = createContext<CallsState | null>(null);

export function CallsProvider({ children }: { children: ReactNode }) {
  const calls = useCalls();
  return <CallsContext.Provider value={calls}>{children}</CallsContext.Provider>;
}

export function useCallsContext(): CallsState {
  const ctx = useContext(CallsContext);
  if (!ctx) throw new Error('useCallsContext must be used within CallsProvider');
  return ctx;
}
