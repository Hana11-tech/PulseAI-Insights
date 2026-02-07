import * as React from "react";

type SelectedEmployeeContextValue = {
  selectedEmployeeId: number | null;
  setSelectedEmployeeId: (id: number | null) => void;
};

const STORAGE_KEY = "pulseai:selectedEmployeeId";

const SelectedEmployeeContext = React.createContext<SelectedEmployeeContextValue | null>(null);

export function SelectedEmployeeProvider({ children }: { children: React.ReactNode }) {
  const [selectedEmployeeId, setSelectedEmployeeIdState] = React.useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = Number(stored);
    return Number.isFinite(parsed) ? parsed : null;
  });

  const setSelectedEmployeeId = React.useCallback((id: number | null) => {
    setSelectedEmployeeIdState(id);
    if (typeof window === "undefined") return;
    if (id === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, String(id));
    }
  }, []);

  return (
    <SelectedEmployeeContext.Provider value={{ selectedEmployeeId, setSelectedEmployeeId }}>
      {children}
    </SelectedEmployeeContext.Provider>
  );
}

export function useSelectedEmployee() {
  const context = React.useContext(SelectedEmployeeContext);
  if (!context) {
    throw new Error("useSelectedEmployee must be used within SelectedEmployeeProvider");
  }
  return context;
}
