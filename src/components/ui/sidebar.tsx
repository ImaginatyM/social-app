"use client";
import React from "react";

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

type SidebarContextValue = {
  collapsed: boolean
  toggle: () => void
}

const SidebarContext = React.createContext<SidebarContextValue | undefined>(
  undefined,
)

export function useSidebar() {
  const ctx = React.useContext(SidebarContext)
  if (!ctx) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return ctx
}

export function SidebarProvider({children}: React.PropsWithChildren) {
  const [collapsed, setCollapsed] = React.useState(false)
  const toggle = React.useCallback(() => setCollapsed(prev => !prev), [])
  const value = React.useMemo(() => ({collapsed, toggle}), [collapsed, toggle])

  return (
    <SidebarContext.Provider value={value}>
      <div className="flex min-h-dvh w-full bg-background text-foreground">
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

export function Sidebar({
  children,
  className,
}: React.PropsWithChildren<{className?: string}>) {
  const {collapsed} = useSidebar()
  const widthClass = collapsed ? "w-[var(--sidebar-width-icon)]" : "w-[var(--sidebar-width)]"

  return (
    <aside
      className={cn(
        "hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex lg:flex-col",
        widthClass,
        className,
      )}
    >
      {children ?? <div className="flex flex-1 items-center justify-center text-sm text-sidebar-muted-foreground">Sidebar</div>}
    </aside>
  )
}

export function SidebarInset({
  className,
  children,
}: React.PropsWithChildren<{className?: string}>) {
  return (
    <div className={cn("flex min-h-dvh flex-1 flex-col", className)}>{children}</div>
  )
}
