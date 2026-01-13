import {Connection, LAMPORTS_PER_SOL, PublicKey} from '@solana/web3.js'

import {SOLANA} from '../../config/chains'

export async function getSolBalance(
  address: string,
  rpcUrl: string = SOLANA.rpcUrl,
): Promise<number> {
  const pubkey = new PublicKey(address)
  const connection = new Connection(rpcUrl, 'confirmed')
  const lamports = await connection.getBalance(pubkey)
  return lamports / LAMPORTS_PER_SOL
}
