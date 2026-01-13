import React from 'react'
import {useWindowDimensions} from 'react-native'
import {createPortal} from 'react-dom'
import QRCode from 'react-qr-code'

import * as Toast from '#/view/com/util/Toast'

type Props = {
  open: boolean
  onClose: () => void
  address: string
  chain: 'base' | 'ethereum'
}

const formatAddress = (address: string) => {
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export default function WalletReceiveModal({
  open,
  onClose,
  address,
  chain,
}: Props) {
  const {width} = useWindowDimensions()
  if (!open) return null
  const label = chain === 'base' ? 'Base' : 'Ethereum'
  const isCompact = width < 520
  const qrFrame = 92
  const qrPadding = 8
  const qrSize = qrFrame - qrPadding * 2

  const onCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(address)
        Toast.show('Adresse copiee', 'clipboard-check')
      }
    } catch (err) {
      Toast.show('Impossible de copier', 'error')
    }
  }

  const content = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2,6,23,0.65)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          borderRadius: 28,
          padding: 20,
          color: '#e2e8f0',
          background:
            'linear-gradient(135deg, #0b1220 0%, #111827 55%, #0f172a 100%)',
          border: '1px solid rgba(148,163,184,0.2)',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.45)',
        }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 16,
          }}>
          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <div
              style={{
                height: 40,
                width: 40,
                borderRadius: 14,
                background:
                  'linear-gradient(140deg, rgba(56,189,248,0.3), rgba(16,185,129,0.25))',
                border: '1px solid rgba(148,163,184,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                color: '#f8fafc',
              }}>
              W
            </div>
            <div>
              <div
                style={{
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.2em',
                  color: '#94a3b8',
                }}>
                Wallet / Payer
              </div>
              <div style={{fontSize: 16, fontWeight: 600}}>{label}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            style={{
              border: '1px solid rgba(148,163,184,0.3)',
              background: 'transparent',
              color: '#e2e8f0',
              padding: '6px 10px',
              borderRadius: 999,
              fontSize: 12,
            }}>
            Fermer
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 16,
            flexDirection: isCompact ? 'column' : 'row',
            alignItems: isCompact ? 'stretch' : 'center',
          }}>
          <div style={{flex: 1, minWidth: 0}}>
            <div style={{fontSize: 12, opacity: 0.7, marginBottom: 4}}>
              Reseau
            </div>
            <div style={{fontWeight: 600, marginBottom: 12}}>{label}</div>
            <div style={{fontSize: 12, opacity: 0.7, marginBottom: 4}}>
              Adresse
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}>
              <span style={{fontFamily: 'monospace', fontSize: 14}}>
                {formatAddress(address)}
              </span>
              <button
                onClick={onCopy}
                type="button"
                style={{
                  border: '1px solid rgba(148,163,184,0.3)',
                  background: 'rgba(15,23,42,0.6)',
                  color: '#e2e8f0',
                  padding: '4px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                }}>
                Copier
              </button>
            </div>
          </div>

          <div
            style={{
              width: qrFrame,
              height: qrFrame,
              padding: qrPadding,
              borderRadius: 18,
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: isCompact ? 'flex-start' : 'center',
            }}>
            <QRCode value={address} size={qrSize} />
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') {
    return content
  }

  return createPortal(content, document.body)
}
