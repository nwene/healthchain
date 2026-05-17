import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { BrowserProvider } from 'ethers'
import { connectWallet, SEPOLIA_CHAIN_ID, SEPOLIA_CHAIN_ID_HEX } from '../lib/contract'

const WalletContext = createContext(null)

function getEthereum() {
  return typeof window !== 'undefined' ? window.ethereum : undefined
}

async function readWalletSnapshot() {
  const ethereum = getEthereum()

  if (!ethereum) {
    return {
      hasMetaMask: false,
      address: null,
      chainId: null,
      isSepolia: false,
    }
  }

  const [accounts, chainId] = await Promise.all([
    ethereum.request({ method: 'eth_accounts' }),
    ethereum.request({ method: 'eth_chainId' }),
  ])

  return {
    hasMetaMask: true,
    address: accounts?.[0] ?? null,
    chainId,
    isSepolia: chainId?.toLowerCase() === SEPOLIA_CHAIN_ID_HEX,
  }
}

export function WalletProvider({ children }) {
  const [hasMetaMask, setHasMetaMask] = useState(false)
  const [address, setAddress] = useState(null)
  const [chainId, setChainId] = useState(null)
  const [isSepolia, setIsSepolia] = useState(false)
  const [status, setStatus] = useState('checking')
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const snapshot = await readWalletSnapshot()
      setHasMetaMask(snapshot.hasMetaMask)
      setAddress(snapshot.address)
      setChainId(snapshot.chainId)
      setIsSepolia(snapshot.isSepolia)
      setStatus(snapshot.address ? 'connected' : 'disconnected')
      setError(null)
    } catch (caught) {
      setStatus('error')
      setError(caught)
    }
  }, [])

  const connect = useCallback(async () => {
    setStatus('connecting')
    setError(null)

    try {
      const wallet = await connectWallet()
      setHasMetaMask(true)
      setAddress(wallet.address)
      setChainId(SEPOLIA_CHAIN_ID_HEX)
      setIsSepolia(true)
      setStatus('connected')

      return wallet
    } catch (caught) {
      setStatus('error')
      setError(caught)
      throw caught
    }
  }, [])

  const disconnect = useCallback(() => {
    setAddress(null)
    setStatus('disconnected')
    setError(null)
  }, [])

  const getBrowserProvider = useCallback(() => {
    const ethereum = getEthereum()

    if (!ethereum) {
      throw new Error('MetaMask is required.')
    }

    return new BrowserProvider(ethereum)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const ethereum = getEthereum()

    if (!ethereum?.on) {
      return undefined
    }

    const handleAccountsChanged = (accounts) => {
      setAddress(accounts?.[0] ?? null)
      setStatus(accounts?.[0] ? 'connected' : 'disconnected')
      setError(null)
    }

    const handleChainChanged = (nextChainId) => {
      setChainId(nextChainId)
      setIsSepolia(nextChainId?.toLowerCase() === SEPOLIA_CHAIN_ID_HEX)
    }

    const handleDisconnect = () => {
      setAddress(null)
      setStatus('disconnected')
    }

    ethereum.on('accountsChanged', handleAccountsChanged)
    ethereum.on('chainChanged', handleChainChanged)
    ethereum.on('disconnect', handleDisconnect)

    return () => {
      ethereum.removeListener?.('accountsChanged', handleAccountsChanged)
      ethereum.removeListener?.('chainChanged', handleChainChanged)
      ethereum.removeListener?.('disconnect', handleDisconnect)
    }
  }, [])

  const value = useMemo(() => ({
    hasMetaMask,
    address,
    chainId,
    isSepolia,
    status,
    error,
    isConnected: Boolean(address),
    isConnecting: status === 'connecting' || status === 'checking',
    connect,
    disconnect,
    refresh,
    getBrowserProvider,
  }), [address, chainId, connect, disconnect, error, getBrowserProvider, hasMetaMask, isSepolia, refresh, status])

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)

  if (!context) {
    throw new Error('useWallet must be used within WalletProvider.')
  }

  return context
}
