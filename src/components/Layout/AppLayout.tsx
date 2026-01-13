"use client";
import React from "react";

import {SidebarProvider, Sidebar, SidebarInset} from "#/components/ui/sidebar";
import {Toaster} from "#/components/ui/sonner";

export default function AppLayout({children}: React.PropsWithChildren) {
  return (
    <SidebarProvider>
      <Sidebar />
      <SidebarInset className="min-h-dvh bg-background text-foreground">
        <div className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
          <div className="container-dashboard flex items-center justify-center py-4">
            <h1 className="text-2xl font-semibold tracking-tight">Wallet</h1>
          </div>
        </div>
        <div className="container-dashboard">{children}</div>
        <Toaster />
      </SidebarInset>
    </SidebarProvider>
  )
}
