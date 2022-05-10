import React, { useState, useEffect, useMemo } from "react"
import { Card, Result } from "antd"
import { BigNumber, ethers } from "ethers"
import claimManagerData from "../../assets/abis/ClaimManager.json"
import useProvider from "../bootstrap/useProvider"

type Errored = {
  title: string
  subTitle: string
}

type Parameters = {
  arbitrableContractAddress: string
  arbitratorContractAddress: string
  disputeID: string
  arbitrableChainID: string
  arbitrableJsonRpcUrl: string
}

type ClaimData = {
  claimant: string
  beneficiary: string
  coverage: BigNumber
  endTime: BigNumber
  documentIpfsCidV1: string
}

const ClaimFrame: React.FC = () => {
  const [parameters, setParameters] = useState<Parameters>()
  const [errored, setErrored] = useState<Errored>()
  const [claimData, setClaimData] = useState<ClaimData | undefined>()
  const { provider: fallbackProvider, error: fallbackProviderError } =
    useProvider()

  // Read query parameters.
  useEffect(() => {
    if (window.location.search[0] !== "?" || parameters) return
    const message = JSON.parse(
      window.location.search
        .substring(1)
        .replace(/%22/g, '"')
        .replace(/%7B/g, "{")
        .replace(/%3A/g, ":")
        .replace(/%2C/g, ",")
        .replace(/%7D/g, "}")
        .replace(/%2F/g, "/")
    )

    const {
      disputeID,
      arbitrableContractAddress,
      arbitratorContractAddress,
      arbitrableChainID,
      arbitrableJsonRpcUrl,
    } = message

    if (!arbitrableContractAddress || !disputeID || !arbitratorContractAddress)
      return

    setParameters({
      arbitrableContractAddress,
      arbitratorContractAddress,
      disputeID,
      arbitrableChainID,
      arbitrableJsonRpcUrl,
    })
  }, [parameters])

  const arbitrableSigner = useMemo(() => {
    if (!parameters) return

    const { arbitrableJsonRpcUrl } = parameters
    if (!arbitrableJsonRpcUrl && !fallbackProvider) return

    let provider = fallbackProvider
    if (arbitrableJsonRpcUrl)
      provider = new ethers.providers.JsonRpcProvider(arbitrableJsonRpcUrl)

    // Using a random signer because provider does not have getChainId for
    // whatever reason.
    return new ethers.Wallet("0x123123123123123123123132123123", provider)
  }, [fallbackProvider, parameters])

  const claimManager = useMemo(() => {
    if (!parameters) return
    if (!arbitrableSigner) return
    const { arbitrableContractAddress } = parameters

    try {
      return new ethers.Contract(
        arbitrableContractAddress,
        claimManagerData.abi,
        arbitrableSigner
      )
    } catch (err: any) {
      console.error(`Error instantiating gtcr contract`, err)
      setErrored({
        title: "Error loading item. Are you in the correct network?",
        subTitle: err.message,
      })
      return null
    }
  }, [arbitrableSigner, parameters])

  // Fetch claimData.
  useEffect(() => {
    if (!claimManager || claimData || !parameters || !arbitrableSigner) return
    const { arbitratorContractAddress, disputeID, arbitrableChainID } =
      parameters
    ;(async () => {
      try {
        const chainID = await arbitrableSigner.getChainId()
        if (chainID !== Number(arbitrableChainID))
          throw new Error(
            `Mismatch on chain Id. Injected: ${arbitrableChainID}, provider ${chainID}`
          )
      } catch (err: any) {
        console.error(`Error fetching item`, err)
        setErrored({
          title: `Invalid. Mismatch between injected and provider chainID`,
          subTitle: err.message,
        })
      }
      try {
        const disputeFilter = await claimManager.filters.Dispute(
          null,
          BigNumber.from(disputeID),
          null,
          null
        )
        const disputeEvents = await claimManager.queryFilter(disputeFilter)
        if (!disputeEvents[0].args) {
          throw new Error(`No result from: Dispute`)
        }
        const claimId = disputeEvents[0].args[3]
        const claimCreatedFilter = claimManager.filters.CreatedClaim(claimId)
        const claimCreatedEvents = await claimManager.queryFilter(
          claimCreatedFilter
        )
        if (!claimCreatedEvents[0].args) {
          throw new Error(`No result from: CreatedClaim`)
        }
        const policyHash = disputeEvents[0].args[2]
        const policyCreatedFilter =
          claimManager.filters.CreatedPolicy(policyHash)
        const policyCreatedEvents = await claimManager.queryFilter(
          policyCreatedFilter
        )
        if (!policyCreatedEvents[0].args) {
          throw new Error(`No result from: CreatedPolicy`)
        }

        const [_, claimant, beneficiary, coverage, endTime, documentIpfsCidV1] =
          policyCreatedEvents[0].args

        const claimReceived: ClaimData = {
          claimant,
          beneficiary,
          coverage: BigNumber.from(coverage),
          endTime: BigNumber.from(endTime),
          documentIpfsCidV1,
        }
        setClaimData(claimReceived)
      } catch (err: any) {
        console.error("Error fetching claimData", err)
        setErrored({
          title: "Error fetching claimData. Are you in the correct network?",
          subTitle: err.message,
        })
      }
    })()
  }, [arbitrableSigner, claimManager, parameters])

  if (errored)
    return (
      <Card bordered>
        <Result
          status="warning"
          title={errored.title}
          subTitle={errored.subTitle}
        />
      </Card>
    )

  if (fallbackProviderError && !claimManager)
    return (
      <Card bordered>
        <Result status="warning" title={fallbackProviderError} />
      </Card>
    )

  if (!claimData || !parameters) return <Card loading bordered />

  // hmm... how to make a pretty frame? im only knowledgeable enough to display the data
  return (
    <Card bordered>
      <>
        <p>Beneficiary: {claimData.beneficiary}</p>
        <p>Claimant: {claimData.claimant}</p>
        <p>Coverage: {claimData.coverage.toString()}</p>
        <p>End Time: {claimData.endTime.toString()}</p>
        <p>IPFS link to Policy: {claimData.documentIpfsCidV1}</p>
      </>
    </Card>
  )
}

export default ClaimFrame
