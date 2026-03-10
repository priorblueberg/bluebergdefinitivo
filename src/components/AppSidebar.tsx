import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  LayoutGrid,
  ArrowLeftRight,
  DollarSign,
  Plus,
  Settings,
  User,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import blueberg from "@/assets/blueberg-logo.png";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ElementType;
  children?: { title: string; url: string }[];
}

const menuItems: MenuItem[] = [
  {
    title: "Carteira de Investimentos",
    url: "/carteira",
    icon: LayoutGrid,
    children: [
      { title: "Visão Geral", url: "/carteira" },
      { title: "Renda Fixa", url: "/carteira/renda-fixa" },
      { title: "Renda Variável", url: "/carteira/renda-variavel" },
      { title: "Fundos de Investimentos", url: "/carteira/fundos" },
      { title: "Tesouro Direto", url: "/carteira/tesouro-direto" },
      { title: "Análise Individual por Produto", url: "/carteira/analise-individual" },
    ],
  },
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
  const [expandedMenu, setExpandedMenu] = useState<string | null>("Carteira de Investimentos");

  const isActive = (url: string) => location.pathname === url;
  const isInSection = (item: MenuItem) =>
    location.pathname === item.url ||
    item.children?.some((c) => location.pathname === c.url);

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 z-30 flex flex-col border-r border-border bg-card"
      style={{
        width: collapsed ? 56 : 220,
        transition: "width 120ms linear",
      }}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-3">
        <img src={blueberg} alt="Blueberg" className="h-8 w-auto" />
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        {menuItems.map((item) => {
          const active = isInSection(item);
          const Icon = item.icon;
          const hasChildren = !!item.children;
          const isExpanded = expandedMenu === item.title;

          return (
            <div key={item.title}>
              <Link
                to={item.url}
                onClick={(e) => {
                  if (hasChildren) {
                    e.preventDefault();
                    setExpandedMenu(isExpanded ? null : item.title);
                    if (collapsed) onToggle();
                  }
                }}
                className="group relative flex h-9 items-center gap-3 px-3 text-xs font-medium transition-colors"
                style={{ transition: "color 120ms linear" }}
              >
                {/* Active marker */}
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-primary" />
                )}
                <Icon
                  size={18}
                  strokeWidth={1.5}
                  className={active ? "text-primary shrink-0" : "text-muted-foreground shrink-0 group-hover:text-foreground"}
                  style={{ transition: "color 120ms linear" }}
                />
                {!collapsed && (
                  <span
                    className={`truncate ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}
                  >
                    {item.title}
                  </span>
                )}
                {!collapsed && hasChildren && (
                  <ChevronDown
                    size={14}
                    className={`ml-auto shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    style={{ transition: "transform 120ms linear" }}
                  />
                )}
              </Link>

              {/* Children */}
              {hasChildren && isExpanded && !collapsed && (
                <div className="ml-9 border-l border-border">
                  {item.children!.map((child) => (
                    <Link
                      key={child.url}
                      to={child.url}
                      className={`block py-1.5 pl-3 text-xs transition-colors ${
                        isActive(child.url)
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      style={{ transition: "color 120ms linear" }}
                    >
                      {child.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="flex h-10 items-center justify-center border-t border-border text-muted-foreground hover:text-foreground"
        style={{ transition: "color 120ms linear" }}
      >
        {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
      </button>
    </aside>
  );
}
