import { useState, useRef } from "react";
import { format, parse, isValid, subDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, RotateCcw, RefreshCw } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useDataReferencia } from "@/contexts/DataReferenciaContext";
import { recalculateAllForDataReferencia } from "@/lib/syncEngine";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppHeader() {
  const { dataReferencia, setDataReferencia, applyDataReferencia, setIsRecalculating } = useDataReferencia();
  const [inputValue, setInputValue] = useState(format(dataReferencia, "dd/MM/yyyy"));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const applyDate = async (date: Date) => {
    if (!user) return;
    setDataReferencia(date);
    setInputValue(format(date, "dd/MM/yyyy"));
    setIsRecalculating(true);
    try {
      await recalculateAllForDataReferencia(user.id, format(date, "yyyy-MM-dd"));
      applyDataReferencia();
      toast.success("Data de referência aplicada com sucesso");
    } catch (err) {
      console.error("Erro ao aplicar data de referência", err);
      toast.error("Erro ao aplicar data de referência");
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
    let formatted = raw;
    if (raw.length > 2 && raw.length <= 4) {
      formatted = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    } else if (raw.length > 4) {
      formatted = `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4)}`;
    }
    setInputValue(formatted);
    if (raw.length === 8) {
      const parsed = parse(formatted, "dd/MM/yyyy", new Date());
      if (isValid(parsed)) {
        setDataReferencia(parsed);
      }
    }
  };

  const commitInput = () => {
    const parsed = parse(inputValue, "dd/MM/yyyy", new Date());
    if (isValid(parsed)) {
      applyDate(parsed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      inputRef.current?.blur();
      commitInput();
    }
  };

  const handleDateSelect = (d: Date | undefined) => {
    if (d) {
      applyDate(d);
    }
    setCalendarOpen(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="relative">
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground outline-none" style={{ transition: "color 120ms linear" }}>
            <span className="truncate max-w-[220px]">{user?.email}</span>
            <ChevronDown size={14} strokeWidth={1.5} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[180px]">
            <DropdownMenuItem onClick={() => navigate("/usuario")} className="text-xs cursor-pointer">
              Informações Pessoais
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="text-xs cursor-pointer text-destructive">
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Posição em:</span>
            <div className="flex items-center gap-1 rounded-md border border-border px-2 py-1 bg-background">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={commitInput}
                onKeyDown={handleKeyDown}
                className="w-[80px] bg-transparent text-foreground text-xs outline-none"
                placeholder="dd/mm/aaaa"
              />
              <button
                onClick={() => setCalendarOpen(!calendarOpen)}
                className="text-muted-foreground hover:text-primary"
                style={{ transition: "color 120ms linear" }}
              >
                <CalendarIcon size={14} strokeWidth={1.5} />
              </button>
            </div>
            <button
              onClick={() => applyDate(subDays(dataReferencia, 1))}
              className="rounded-md border border-border p-1 text-muted-foreground hover:text-primary hover:border-primary bg-background"
              style={{ transition: "all 120ms linear" }}
              title="Dia anterior"
            >
              <ChevronLeft size={14} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => applyDate(addDays(dataReferencia, 1))}
              className="rounded-md border border-border p-1 text-muted-foreground hover:text-primary hover:border-primary bg-background"
              style={{ transition: "all 120ms linear" }}
              title="Próximo dia"
            >
              <ChevronRight size={14} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => applyDate(subDays(new Date(), 1))}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-primary hover:border-primary bg-background"
              style={{ transition: "all 120ms linear" }}
              title="Desde o início (data padrão)"
            >
              <RotateCcw size={12} strokeWidth={1.5} />
              <span>Desde o início</span>
            </button>
          </div>

          <button className="relative text-muted-foreground hover:text-primary" style={{ transition: "color 120ms linear" }}>
            <Bell size={18} strokeWidth={1.5} />
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
          </button>
        </div>
      </header>

      {calendarOpen && (
        <div className="border-b border-border bg-card flex justify-end px-4 py-2">
          <Calendar
            mode="single"
            selected={dataReferencia}
            onSelect={handleDateSelect}
            locale={ptBR}
            className="pointer-events-auto"
          />
        </div>
      )}
    </div>
  );
}