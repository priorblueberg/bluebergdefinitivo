import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { format, subDays } from "date-fns";

interface DataReferenciaContextType {
  dataReferencia: Date;
  setDataReferencia: (date: Date) => void;
  dataReferenciaISO: string; // yyyy-MM-dd
}

const DataReferenciaContext = createContext<DataReferenciaContextType | null>(null);

export function DataReferenciaProvider({ children }: { children: ReactNode }) {
  const [dataReferencia, setDataReferencia] = useState<Date>(() => subDays(new Date(), 1));

  const dataReferenciaISO = format(dataReferencia, "yyyy-MM-dd");

  return (
    <DataReferenciaContext.Provider value={{ dataReferencia, setDataReferencia, dataReferenciaISO }}>
      {children}
    </DataReferenciaContext.Provider>
  );
}

export function useDataReferencia() {
  const ctx = useContext(DataReferenciaContext);
  if (!ctx) throw new Error("useDataReferencia must be used within DataReferenciaProvider");
  return ctx;
}
