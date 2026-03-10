import { useState, useRef } from "react";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";

export function AppHeader() {
  const [date, setDate] = useState<Date>(new Date());
  const [inputValue, setInputValue] = useState(format(new Date(), "dd/MM/yyyy"));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    const parsed = parse(val, "dd/MM/yyyy", new Date());
    if (isValid(parsed)) {
      setDate(parsed);
    }
  };

  const handleDateSelect = (d: Date | undefined) => {
    if (d) {
      setDate(d);
      setInputValue(format(d, "dd/MM/yyyy"));
    }
    setCalendarOpen(false);
  };

  return (
    <div className="relative">
      <header className="flex h-14 items-center justify-end border-b border-border bg-card px-4 gap-4">
        {/* Date block */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Posição em:</span>
          <div className="flex items-center gap-1 rounded-md border border-border px-2 py-1 bg-background">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
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
        </div>

        {/* Notifications */}
        <button className="relative text-muted-foreground hover:text-primary" style={{ transition: "color 120ms linear" }}>
          <Bell size={18} strokeWidth={1.5} />
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
        </button>
      </header>

      {calendarOpen && (
        <div className="border-b border-border bg-card flex justify-end px-4 py-2">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            locale={ptBR}
            className="pointer-events-auto"
          />
        </div>
      )}
    </div>
  );
}
