import React, {useState} from 'react'
import QRCode from 'react-qr-code'

import {BITCOIN, SOLANA} from '../config/chains'
import {EVM_NETWORKS} from '../config/evm'
import {toLightningUrl} from '../lib/crypto/lightning'

type AddressInput = string | undefined | {address: string; network?: string}

export default function TipModal({
  open,
  onClose,
  target,
}: {
  open: boolean
  onClose: () => void
  target: {
    evm?: AddressInput
    solana?: AddressInput
    bitcoin?: AddressInput
    lightning?: string
  }
}) {
  const [amountEth, setAmountEth] = useState('0.001')
  const [amountSats, setAmountSats] = useState('1000')
  const [amountSol, setAmountSol] = useState('0.1')
  const [amountBtc, setAmountBtc] = useState('0.0001')
  if (!open) return null
  const evmInput = target.evm
  const evmAddress =
    typeof evmInput === 'string' ? evmInput : evmInput?.address
  const evmNetwork =
    typeof evmInput === 'object' && evmInput?.network
      ? (evmInput.network as 'base' | 'ethereum')
      : 'base'
  const evmLink = evmAddress
    ? `ethereum:${evmAddress}?value=${encodeURIComponent(amountEth)}`
    : ''

  const solInput = target.solana
  const solAddress =
    typeof solInput === 'string' ? solInput : solInput?.address
  const solLink = solAddress
    ? `solana:${solAddress}?amount=${encodeURIComponent(amountSol)}`
    : ''

  const btcInput = target.bitcoin
  const btcAddress =
    typeof btcInput === 'string' ? btcInput : btcInput?.address
  const btcNetwork =
    typeof btcInput === 'object' && btcInput?.network
      ? (btcInput.network as 'mainnet' | 'testnet')
      : 'mainnet'
  const btcLink = btcAddress
    ? `bitcoin:${btcAddress}?amount=${encodeURIComponent(amountBtc)}`
    : ''
  const lnLink = target.lightning
    ? toLightningUrl(
        target.lightning,
        Number(amountSats) || undefined,
        'Tip Tellus',
      )
    : ''
  return (
    <div
      onClick={onClose}
      style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100}}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          background: '#fff',
          padding: 16,
          borderRadius: 12,
          minWidth: 320,
        }}>
        <h3>Soutenir</h3>

        {evmAddress && (
          <>
            <h4>EVM</h4>
            <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
              <label>ETH:</label>
              <input
                value={amountEth}
                onChange={e => setAmountEth(e.target.value)}
                style={{width: 100}}
              />
              <a href={evmLink}>
                <button>Ouvrir Wallet</button>
              </a>
            </div>
            <div
              style={{
                background: '#fff',
                padding: 12,
                display: 'inline-block',
                marginTop: 8,
              }}>
              <QRCode value={evmAddress} />
            </div>
            <div style={{marginTop: 8}}>
              <a
                href={`${EVM_NETWORKS[evmNetwork].explorer}/address/${evmAddress}`}
                target="_blank"
                rel="noreferrer">
                Explorer
              </a>
            </div>
          </>
        )}

        {target.lightning && (
          <>
            <h4 style={{marginTop: 12}}>Lightning</h4>
            <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
              <label>Sats:</label>
              <input
                value={amountSats}
                onChange={e => setAmountSats(e.target.value)}
                style={{width: 100}}
              />
              <a href={lnLink}>
                <button>Envoyer via wallet</button>
              </a>
            </div>
            <div
              style={{
                background: '#fff',
                padding: 12,
                display: 'inline-block',
                marginTop: 8,
              }}>
              <QRCode value={target.lightning} />
            </div>
          </>
        )}

        {solAddress && (
          <>
            <h4 style={{marginTop: 12}}>Solana</h4>
            <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
              <label>SOL:</label>
              <input
                value={amountSol}
                onChange={e => setAmountSol(e.target.value)}
                style={{width: 100}}
              />
              <a href={solLink}>
                <button>Ouvrir wallet</button>
              </a>
            </div>
            <div
              style={{
                background: '#fff',
                padding: 12,
                display: 'inline-block',
                marginTop: 8,
              }}>
              <QRCode value={solAddress} />
            </div>
            <div style={{marginTop: 8}}>
              <a
                href={`${SOLANA.explorer}/account/${solAddress}`}
                target="_blank"
                rel="noreferrer">
                Explorer
              </a>
            </div>
          </>
        )}

        {btcAddress && (
          <>
            <h4 style={{marginTop: 12}}>Bitcoin</h4>
            <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
              <label>BTC:</label>
              <input
                value={amountBtc}
                onChange={e => setAmountBtc(e.target.value)}
                style={{width: 100}}
              />
              <a href={btcLink}>
                <button>Ouvrir wallet</button>
              </a>
            </div>
            <div
              style={{
                background: '#fff',
                padding: 12,
                display: 'inline-block',
                marginTop: 8,
              }}>
              <QRCode value={btcAddress} />
            </div>
            <div style={{marginTop: 8}}>
              <a
                href={`${BITCOIN[btcNetwork].explorer}/address/${btcAddress}`}
                target="_blank"
                rel="noreferrer">
                Explorer
              </a>
            </div>
          </>
        )}

        {!evmAddress && !target.lightning && !solAddress && !btcAddress && (
          <div>L’utilisateur n’a pas renseigné de wallet public.</div>
        )}
        <div style={{textAlign: 'right', marginTop: 12}}>
          <button onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  )
}
