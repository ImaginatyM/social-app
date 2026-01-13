import React from 'react'

import * as Layout from '#/components/Layout'
import {useMetaMask} from '#/hooks/useMetaMask'
import {getWalletRecord, upsertWalletRecord} from '#/lib/walletRecord'
import {useWalletSettings, useWalletSettingsApi} from '#/state/preferences'
import {useSession, useAgent} from '#/state/session'
import {useWalletsStore} from '../state/walletsStore'

type StatusTone = 'info' | 'error' | 'success'

export default function SettingsWallets() {
  const agent = useAgent()
  const {currentAccount} = useSession()
  const {wallets, setWallets} = useWalletsStore()
  const {showInSidebar} = useWalletSettings()
  const {setShowInSidebar} = useWalletSettingsApi()

  const [evmAddr, setEvmAddr] = React.useState(wallets.evm?.address || '')
  const [evmNet, setEvmNet] = React.useState<'base' | 'ethereum'>(
    wallets.evm?.network || 'base',
  )
  const [enabled, setEnabled] = React.useState(Boolean(wallets.evm?.enabled))
  const [loadingRecord, setLoadingRecord] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [status, setStatus] = React.useState<{
    tone: StatusTone
    message: string
  } | null>(null)

  const {
    address: metaAddress,
    chainKey,
    chainId,
    isAvailable,
    isConnecting,
    connect,
  } = useMetaMask()
  const chainIdLabel =
    chainId && chainId.startsWith('0x')
      ? Number.parseInt(chainId, 16).toString()
      : chainId

  React.useEffect(() => {
    let mounted = true
    if (!currentAccount) return
    setLoadingRecord(true)
    getWalletRecord(agent, currentAccount.did)
      .then(record => {
        if (!mounted || !record) return
        setEvmAddr(record.evmAddress || '')
        setEvmNet(record.evmChain || 'base')
        setEnabled(record.enabled)
        setWallets({
          evm: {
            address: record.evmAddress || undefined,
            network: record.evmChain || 'base',
            enabled: record.enabled,
          },
        })
      })
      .catch(err => {
        if (!mounted) return
        console.error('wallet record load failed', err)
        setStatus({
          tone: 'error',
          message: 'Impossible de charger votre wallet.',
        })
      })
      .finally(() => {
        if (mounted) setLoadingRecord(false)
      })
    return () => {
      mounted = false
    }
  }, [agent, currentAccount, setWallets])

  const onConnectMetaMask = React.useCallback(async () => {
    setStatus(null)
    if (!isAvailable) {
      setStatus({
        tone: 'error',
        message: 'Installe MetaMask pour connecter un wallet.',
      })
      return
    }
    try {
      await connect()
      setStatus(null)
    } catch (err) {
      console.error('MetaMask connection failed', err)
      setStatus({
        tone: 'error',
        message: 'Impossible de connecter MetaMask.',
      })
    }
  }, [connect, isAvailable])

  React.useEffect(() => {
    if (!metaAddress) return
    setEvmAddr(metaAddress)
    if (chainKey === 'base' || chainKey === 'ethereum') {
      setEvmNet(chainKey)
      setWallets({
        evm: {
          address: metaAddress,
          network: chainKey,
          enabled,
        },
      })
      setStatus(null)
    }
    if (chainKey === 'unsupported' && chainId) {
      setStatus({
        tone: 'error',
        message: 'Réseau non supporté. Utilisez Base ou Ethereum.',
      })
    }
  }, [chainId, chainKey, enabled, metaAddress, setWallets])

  const save = React.useCallback(async () => {
    if (!currentAccount) return
    const address = evmAddr.trim()
    if (enabled && !address) {
      setStatus({
        tone: 'error',
        message: 'Renseignez une adresse EVM pour activer la réception.',
      })
      return
    }
    setSaving(true)
    setStatus(null)
    try {
      await upsertWalletRecord(agent, currentAccount.did, {
        $type: 'app.spark.wallet',
        enabled,
        evmAddress: address || undefined,
        evmChain: address ? evmNet : undefined,
        updatedAt: new Date().toISOString(),
      })
      setWallets({
        evm: {
          address: address || undefined,
          network: evmNet,
          enabled,
        },
      })
      setStatus({tone: 'success', message: 'Wallet enregistré.'})
    } catch (err) {
      console.error('wallet record save failed', err)
      setStatus({
        tone: 'error',
        message: "Erreur lors de l'enregistrement.",
      })
    } finally {
      setSaving(false)
    }
  }, [agent, currentAccount, enabled, evmAddr, evmNet, setWallets])

  return (
    <Layout.Screen noInsetTop style={{flex: 1}}>
      <Layout.Center
        ignoreTabletLayoutOffset
        style={{width: '100%', padding: '0 16px'}}>
        <div
          style={{
            maxWidth: 720,
            margin: '24px auto',
            padding: '0 16px',
            display: 'flex',
            flexDirection: 'column',
          }}>
          <h1>Wallet</h1>

          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 12,
              border: '1px solid #1f2937',
              background: '#0f172a',
              color: '#e2e8f0',
            }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}>
              <div>
                <div style={{fontSize: 14, fontWeight: 600}}>
                  Afficher Wallet dans la barre laterale
                </div>
                <div style={{fontSize: 12, opacity: 0.7, marginTop: 4}}>
                  Vous pouvez reactiver a tout moment.
                </div>
              </div>
              <input
                type="checkbox"
                role="switch"
                checked={showInSidebar}
                onChange={e => setShowInSidebar(e.target.checked)}
              />
            </label>
          </div>

          {!isAvailable && (
            <div style={{marginBottom: 12, fontSize: 13, opacity: 0.8}}>
              <div style={{marginBottom: 6}}>
                Installe MetaMask pour connecter un wallet.
              </div>
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noreferrer">
                Installer MetaMask
              </a>
            </div>
          )}

          <button
            type="button"
            style={{alignSelf: 'flex-start', marginBottom: 12}}
            onClick={onConnectMetaMask}
            disabled={isConnecting}>
            {isConnecting ? 'Connexion...' : 'Connecter MetaMask'}
          </button>

          {loadingRecord && (
            <div style={{marginBottom: 12, fontSize: 12, opacity: 0.7}}>
              Chargement du wallet...
            </div>
          )}

          <div style={{marginBottom: 12}}>
            <label style={{display: 'block', marginBottom: 6}}>
              Adresse EVM (Base/Ethereum)
            </label>
            <input
              placeholder="0x..."
              value={evmAddr}
              onChange={e => setEvmAddr(e.target.value)}
              style={{width: '100%', padding: '10px 12px'}}
            />
          </div>

          <div style={{marginBottom: 12}}>
            <label style={{display: 'block', marginBottom: 6}}>Réseau</label>
            <select
              value={evmNet}
              onChange={e => setEvmNet(e.target.value as 'base' | 'ethereum')}
              style={{width: '100%', padding: '10px 12px'}}>
              <option value="base">Base</option>
              <option value="ethereum">Ethereum</option>
            </select>
            {chainIdLabel && (
              <div style={{fontSize: 12, opacity: 0.65, marginTop: 6}}>
                ChainId: {chainIdLabel}
              </div>
            )}
          </div>

          <label
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              marginBottom: 12,
            }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
            />
            Activer réception
          </label>

          {status && (
            <div
              style={{
                marginBottom: 12,
                fontSize: 13,
                color:
                  status.tone === 'error'
                    ? '#dc2626'
                    : status.tone === 'success'
                      ? '#16a34a'
                      : '#3b82f6',
              }}>
              {status.message}
            </div>
          )}

          <div style={{display: 'flex', justifyContent: 'flex-end', gap: 12}}>
            <button onClick={save} disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
          <p style={{opacity: 0.7, fontSize: 12, marginTop: 12}}>
            Seules des infos PUBLIQUES sont stockées. Aucune clé privée.
          </p>
        </div>
      </Layout.Center>
    </Layout.Screen>
  )
}
