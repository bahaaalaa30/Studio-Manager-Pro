import { ReactNode } from "react"
import { Sidebar } from "./Sidebar"
import { useLocation } from "wouter"

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation()

  // Track page is standalone (no sidebar)
  if (location === "/track") {
    return <>{children}</>
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <Sidebar />
      {/* pt-16 offsets the mobile top header; lg:pt-0 removes it on desktop where sidebar is fixed */}
      <main className="lg:pl-64 pt-16 lg:pt-0 flex flex-col min-h-[100dvh]">
        {children}
      </main>
    </div>
  )
}
