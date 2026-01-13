"use client";
import React from "react";

export default function AppShell({
  children,
  sidebarWidth = 272, // Change si ta sidebar ≠ 272
}: React.PropsWithChildren<{ sidebarWidth?: number }>) {
  return (
    <div className="min-h-dvh bg-bg text-text">
      <main
        className="main-with-sidebar lg:ml-[272px]"
        style={{ marginLeft: `var(--sidebar-w, ${sidebarWidth}px)` }}
      >
        {/* header sticky (reste visible quand on scrolle) */}
        <div className="sticky top-0 z-10 border-b border-border/60 bg-bg/75 backdrop-blur">
          <div className="container-dashboard flex items-center justify-between py-4">
            <h1 className="text-2xl font-semibold tracking-tight">Wallet</h1>
            <div className="flex items-center gap-2">
              <button className="rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:bg-surface2">Actualiser</button>
            </div>
          </div>
        </div>
        {/* corps centré */}
        <div className="container-dashboard">{children}</div>
      </main>

      {/* Source de vérité de la largeur sidebar */}
      <style>{`:root{--sidebar-w:${sidebarWidth}px}`}</style>
    </div>
  );
}
