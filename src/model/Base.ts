import { getDefaultProvider, providers, Signer } from 'ethers'
import type { RIFScheduler as RIFSchedulerContract } from '@rsksmart/rif-scheduler-contracts/types/ethers-contracts'
import { RIFScheduler__factory as RIFSchedulerFactory } from '@rsksmart/rif-scheduler-contracts/dist/ethers-contracts/factories/RIFScheduler__factory'

export type Config = {
    supportedERC677Tokens?: string[]
    contractAddress: string,
    providerOrSigner?: providers.Provider | Signer
}

export class Base {
  public schedulerContract!: RIFSchedulerContract
  public provider!: providers.Provider
  public currentProviderOrSigner: providers.Provider | Signer
  public signer?: Signer
  public supportedERC677Tokens: string[]

  constructor (public config: Config) {
    this.currentProviderOrSigner = config.providerOrSigner || getDefaultProvider()
    if (Signer.isSigner(this.currentProviderOrSigner)) {
      this.provider = this.currentProviderOrSigner.provider!
      this.signer = this.currentProviderOrSigner
    } else {
      this.provider = this.currentProviderOrSigner
      this.signer = undefined
    }
    this.supportedERC677Tokens = config.supportedERC677Tokens ?? []
    this.schedulerContract = RIFSchedulerFactory.connect(config.contractAddress, this.currentProviderOrSigner)
  }
}
