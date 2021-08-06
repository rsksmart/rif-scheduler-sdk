import { getDefaultProvider, providers, Signer } from 'ethers'
import type { RIFScheduler as RIFSchedulerContract } from '@rsksmart/rif-scheduler-contracts/types/ethers-contracts'
import { RIFScheduler__factory as RIFSchedulerFactory } from '@rsksmart/rif-scheduler-contracts/dist/ethers-contracts/factories/RIFScheduler__factory'

export type Config = {
    supportedERC677Tokens?: string[]
    contractAddress: string,
    providerOrSigner?: providers.Provider | Signer
}

export class Base {
  public providerOrSigner: providers.Provider | Signer

  public schedulerContract!: RIFSchedulerContract
  public supportedERC677Tokens: string[]

  get signer (): Signer | null {
    return Signer.isSigner(this.providerOrSigner) ? this.providerOrSigner : null
  }

  get provider (): providers.Provider {
    return Signer.isSigner(this.providerOrSigner) ? this.providerOrSigner.provider! : this.providerOrSigner
  }

  constructor (public config: Config) {
    this.providerOrSigner = config.providerOrSigner || getDefaultProvider()
    this.supportedERC677Tokens = config.supportedERC677Tokens ?? []
    this.schedulerContract = RIFSchedulerFactory.connect(config.contractAddress, this.providerOrSigner)
  }
}
