import { createContext, useContext, useState, type ReactNode } from "react";

export type ToneOption = "formal" | "friendly" | "apologetic";

interface ToneContextType {
  globalTone: ToneOption;
  setGlobalTone: (tone: ToneOption) => void;
}

const ToneContext = createContext<ToneContextType>({
  globalTone: "friendly",
  setGlobalTone: () => {},
});

export function ToneProvider({ children }: { children: ReactNode }) {
  const [globalTone, setGlobalTone] = useState<ToneOption>("friendly");
  return (
    <ToneContext.Provider value={{ globalTone, setGlobalTone }}>
      {children}
    </ToneContext.Provider>
  );
}

export const useTone = () => useContext(ToneContext);
