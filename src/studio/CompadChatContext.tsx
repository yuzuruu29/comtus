import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

const CompadChatContext = createContext<{
  target: HTMLElement | null;
  setTarget: (target: HTMLElement | null) => void;
}>({ target: null, setTarget: () => {} });

export function CompadChatProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ target, setTarget }), [target]);
  return <CompadChatContext.Provider value={value}>{children}</CompadChatContext.Provider>;
}

export function useCompadChat() {
  return useContext(CompadChatContext);
}
