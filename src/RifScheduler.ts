import { Provider } from '@ethersproject/providers'
import { OneShotSchedule } from '../typechain/OneShotSchedule'
import OneShotSchedulerBuild from './contracts/OneShotSchedule.json'
import { BigNumber, BytesLike, Signer } from 'ethers'
import { Plan, Execution} from './types'

export default class RifScheduler {
  hello (): string { return 'RIF Web SDK Template' }

  schedulerContract!: OneShotSchedule
  ethers: any
  provider!: Provider
  signer?: Signer
  /**
   * Creates an instance of the RifScheduler SDK.
   *
   * @param ethers - Ethers v5 library
   * @param contractAddress - The address RifScheduler contract
   * @param providerOrSigner - Ethers provider or signer. If this parameter is not passed, Ethers defaultProvider will be used.
   * @returns The RifScheduler SDK instance
   */
  static async create (
    ethers: any,
    contractAddress: string,
    providerOrSigner?: Provider | Signer
  ): Promise<RifScheduler> {
    const rifSchedulerSdk = new RifScheduler()
    await rifSchedulerSdk.init(ethers, contractAddress, providerOrSigner)
    return rifSchedulerSdk
  }

  /**
   * Initializes the Safe Core SDK instance.
   *
   * @param ethers - Ethers v5 library
   * @param contractAddress - The address of the OneShotSchedule contract
   * @param providerOrSigner - Ethers provider or signer. If this parameter is not passed, Ethers defaultProvider will be used.
   * @throws "Signer must be connected to a provider"
   * @throws "Safe contract is not deployed in the current network"
   */

  private async init (
    ethers: any,
    contractAddress: string,
    providerOrSigner?: Provider | Signer
  ): Promise<void> {
    const currentProviderOrSigner = providerOrSigner || (ethers.getDefaultProvider() as Provider)
    if (Signer.isSigner(currentProviderOrSigner)) {
      if (!currentProviderOrSigner.provider) {
        throw new Error('Signer must be connected to a provider')
      }
      this.provider = currentProviderOrSigner.provider
      this.signer = currentProviderOrSigner
    } else {
      this.provider = currentProviderOrSigner
      this.signer = undefined
    }
    const oneSchedulerContract = await this.provider.getCode(contractAddress)
    if (oneSchedulerContract === '0x') {
      throw new Error('Safe contract is not deployed in the current network')
    }
    this.ethers = ethers
    this.schedulerContract = new this.ethers.Contract(contractAddress, OneShotSchedulerBuild.abi, currentProviderOrSigner)
  }

  async getPlan (index:number):Promise<Plan> {
    return this.schedulerContract.plans(index) as Plan
  }
}
