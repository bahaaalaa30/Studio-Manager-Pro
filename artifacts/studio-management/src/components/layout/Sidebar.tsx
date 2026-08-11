import { useState } from "react"
import { Link, useLocation } from "wouter"
import { 
  Camera, 
  MonitorPlay, 
  Printer, 
  PackageCheck, 
  LayoutDashboard, 
  UserPlus, 
  Search,
  LogOut,
  Settings,
  Menu,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { icon: UserPlus,       label: "Reception",      href: "/reception" },
  { icon: Camera,         label: "Photography",     href: "/photography" },
  { icon: MonitorPlay,    label: "Editing",         href: "/editing" },
  { icon: Printer,        label: "Printing",        href: "/printing" },
  { icon: PackageCheck,   label: "Delivery",        href: "/delivery" },
  { icon: LayoutDashboard,label: "Admin",           href: "/admin" },
  { icon: Search,         label: "Customer Track",  href: "/track" },
]

export function Sidebar() {
  const [location] = useLocation()
  const [open, setOpen] = useState(false)

  const logoBlock = (
    <div className="h-16 flex items-center px-6 border-b border-sidebar-border shrink-0">
      <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center mr-3">
        <Camera className="w-5 h-5 text-white" />
      </div>
      <h1 className="text-lg font-bold text-sidebar-foreground tracking-tight">Studio Hosny</h1>
    </div>
  )

  const navBlock = (
    <>
      <div className="flex-1 py-6 px-3 flex flex-col gap-1 overflow-y-auto">
        <div className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2 px-3">
          Stations
        </div>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
              location === item.href || (location === "/" && item.href === "/reception")
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {item.label}
          </Link>
        ))}
      </div>

      <div className="p-4 border-t border-sidebar-border shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground cursor-pointer rounded-md hover:bg-sidebar-accent/50 transition-colors">
          <Settings className="w-4 h-4" />
          Settings
        </div>
        <div className="flex items-center gap-3 px-3 py-2 text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground cursor-pointer rounded-md hover:bg-sidebar-accent/50 transition-colors">
          <LogOut className="w-4 h-4" />
          Logout
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* ── Mobile top header ── */}
      <header className="lg:hidden fixed top-0 inset-x-0 h-16 z-40 bg-sidebar border-b border-sidebar-border flex items-center px-4 gap-3">
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-md text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center">
          <Camera className="w-4 h-4 text-white" />
        </div>
        <span className="text-base font-bold text-sidebar-foreground tracking-tight">Studio Hub</span>
      </header>

      {/* ── Mobile backdrop ── */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar ── desktop: always visible | mobile: slide-in drawer ── */}
      <aside
        className={cn(
          "w-64 bg-sidebar border-r border-sidebar-border h-[100dvh] flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Desktop logo / mobile close button */}
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border shrink-0">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center mr-3">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold text-sidebar-foreground tracking-tight flex-1">Studio Hub</h1>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden p-1 rounded text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {navBlock}
      </aside>
    </>
  )
}
