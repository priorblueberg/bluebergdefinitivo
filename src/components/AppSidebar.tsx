import { useLocation, Link } from "react-router-dom";
import {
  LayoutGrid,
  ArrowLeftRight,
  DollarSign,
  Plus,
  Settings,
  User,
  Shield,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ElementType;
  children?: { title: string; url: string }[];
}

const menuItems: MenuItem[] = [
  { title: "Carteira de Investimentos", url: "/carteira", icon: LayoutGrid },
  { title: "Movimentações", url: "/movimentacoes", icon: ArrowLeftRight },
  { title: "Proventos Recebidos", url: "/proventos", icon: DollarSign },
  { title: "Cadastrar Transação", url: "/cadastrar-transacao", icon: Plus },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
  { title: "Usuário", url: "/usuario", icon: User },
];

export function AppSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const location = useLocation();
  const isActive = (url: string) =>
    url === "/carteira" ? location.pathname.startsWith("/carteira") : location.pathname === url;

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 z-30 flex flex-col bg-[hsl(213,60%,20%)]"
      style={{
        width: collapsed ? 56 : 220,
        transition: "width 120ms linear",
      }}
    >
      <div className="flex h-14 items-center gap-2 border-b border-[hsl(213,40%,28%)] px-4">
        {!collapsed && (
          <span className="text-base font-bold tracking-tight text-white">Blueberg</span>
        )}
        {collapsed && (
          <span className="text-base font-bold text-white">B</span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        {menuItems.map((item) => {
          const active = isActive(item.url);
          const Icon = item.icon;

          return (
            <Link
              key={item.title}
              to={item.url}
              className="group relative flex h-9 items-center gap-3 px-3 text-xs font-medium transition-colors"
              style={{ transition: "color 120ms linear" }}
            >
              {active && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-[hsl(210,100%,60%)]" />
              )}
              <Icon
                size={18}
                strokeWidth={1.5}
                className={active ? "text-[hsl(210,100%,60%)] shrink-0" : "text-[hsl(210,25%,60%)] shrink-0 group-hover:text-white"}
                style={{ transition: "color 120ms linear" }}
              />
              {!collapsed && (
                <span
                  className={`truncate ${active ? "text-white" : "text-[hsl(210,25%,60%)] group-hover:text-white"}`}
                >
                  {item.title}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={onToggle}
        className="flex h-10 items-center justify-center border-t border-[hsl(213,40%,28%)] text-[hsl(210,25%,60%)] hover:text-white"
        style={{ transition: "color 120ms linear" }}
      >
        {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
      </button>
    </aside>
  );
}
