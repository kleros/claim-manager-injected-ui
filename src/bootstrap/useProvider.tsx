import { ethers, providers } from "ethers"
import { useEffect, useState } from "react"

declare global {
  interface Window {
    web3: any
    ethereum: providers.ExternalProvider | undefined
  }
}

const useProvider = () => {
  const [error, setError] = useState<string | false>(false)
  const [provider, setProvider] = useState<providers.Provider>()

  useEffect(() => {
    ;(async () => {
      if (provider) return
      try {
        if (window.web3 && window.web3.currentProvider && window.ethereum) {
          setProvider(new ethers.providers.Web3Provider(window.ethereum))
        } else if (process.env.REACT_APP_ETHEREUM_PROVIDER)
          setProvider(
            new ethers.providers.JsonRpcProvider(
              process.env.REACT_APP_ETHEREUM_PROVIDER
            )
          )
        else setError("No ethereum provider available.")
      } catch (err) {
        setError("Error setting up provider")
        console.error(err)
      }
    })()
  }, [provider])

  return { provider, error }
}

export default useProvider
