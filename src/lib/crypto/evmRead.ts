import {createPublicClient, formatEther, http} from 'viem'

import {
  DEFAULT_EVM,
  EVM_NETWORKS,
  type EvmNetworkKey,
} from '../../config/evm'

const erc20Abi = [
  {
    constant: true,
    inputs: [{name: '_owner', type: 'address'}],
    name: 'balanceOf',
    outputs: [{name: 'balance', type: 'uint256'}],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{name: '', type: 'uint8'}],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{name: '', type: 'string'}],
    type: 'function',
  },
] as const

function clientFor(net: EvmNetworkKey) {
  const cfg = EVM_NETWORKS[net]
  return createPublicClient({
    chain: {
      id: cfg.id,
      name: cfg.name,
      nativeCurrency: {
        name: cfg.nativeSymbol,
        symbol: cfg.nativeSymbol,
        decimals: 18,
      },
      rpcUrls: {default: {http: [cfg.rpcUrl]}},
    },
    transport: http(cfg.rpcUrl),
  })
}

export async function getEthBalance(
  addr: string,
  net: EvmNetworkKey = DEFAULT_EVM,
) {
  const cli = clientFor(net)
  const wei = await cli.getBalance({address: addr as `0x${string}`})
  return Number(formatEther(wei))
}

export async function getErc20Balance(
  addr: string,
  token: string,
  decimals: number,
  net: EvmNetworkKey = DEFAULT_EVM,
) {
  const cli = clientFor(net)
  const [raw] = (await cli.readContract({
    address: token as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [addr as `0x${string}`],
  })) as unknown as [bigint]
  return Number(raw) / 10 ** decimals
}
