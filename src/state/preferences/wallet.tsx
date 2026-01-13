import React from 'react'

import * as persisted from '#/state/persisted'

type WalletSettings = {
  showInSidebar: boolean
}

type WalletSettingsApi = {
  setShowInSidebar: (value: boolean) => void
}

const DEFAULT_SHOW_IN_SIDEBAR =
  persisted.defaults.wallet?.showInSidebar ?? true

const StateContext = React.createContext<WalletSettings>({
  showInSidebar: DEFAULT_SHOW_IN_SIDEBAR,
})
StateContext.displayName = 'WalletSettingsStateContext'

const ApiContext = React.createContext<WalletSettingsApi>({
  setShowInSidebar() {},
})
ApiContext.displayName = 'WalletSettingsApiContext'

function resolveShowInSidebar(value?: persisted.Schema['wallet']) {
  return value?.showInSidebar ?? DEFAULT_SHOW_IN_SIDEBAR
}

export function Provider({children}: React.PropsWithChildren<{}>) {
  const [showInSidebar, setShowInSidebarState] = React.useState(() =>
    resolveShowInSidebar(persisted.get('wallet')),
  )

  const setShowInSidebar = React.useCallback((value: boolean) => {
    setShowInSidebarState(value)
    const current = persisted.get('wallet') ?? {}
    persisted.write('wallet', {...current, showInSidebar: value})
  }, [])

  React.useEffect(() => {
    return persisted.onUpdate('wallet', next => {
      setShowInSidebarState(resolveShowInSidebar(next))
    })
  }, [])

  const state = React.useMemo(
    () => ({showInSidebar}),
    [showInSidebar],
  )
  const api = React.useMemo(
    () => ({setShowInSidebar}),
    [setShowInSidebar],
  )

  return (
    <StateContext.Provider value={state}>
      <ApiContext.Provider value={api}>{children}</ApiContext.Provider>
    </StateContext.Provider>
  )
}

export function useWalletSettings() {
  return React.useContext(StateContext)
}

export function useWalletSettingsApi() {
  return React.useContext(ApiContext)
}
