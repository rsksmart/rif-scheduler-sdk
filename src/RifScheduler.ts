import { Provider } from '@ethersproject/providers'
import { OneShotSchedule } from '../typechain/OneShotSchedule'
import OneShotSchedulerBuild from './contracts/OneShotSchedule.json'
import { BigNumber, ContractTransaction, Signer } from 'ethers'
import { Plan } from './types'
import { ERC20__factory, ERC677__factory } from '../typechain'

type Options = {
  supportedER677Tokens: string[]
}
export default class RifScheduler {
  schedulerContract!: OneShotSchedule
  ethers: any
  provider!: Provider
  signer?: Signer
  options?: Options
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
    providerOrSigner?: Provider | Signer,
    options?: Options
  ): Promise<RifScheduler> {
    const rifSchedulerSdk = new RifScheduler()
    await rifSchedulerSdk.init(ethers, contractAddress, providerOrSigner, options)
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
    providerOrSigner?: Provider | Signer,
    options?: Options
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
    this.options = options
  }

  async getPlan (index:number):Promise<Plan> {
    const plan = await this.schedulerContract.plans(index)
    return plan as Plan
  }

  async approveToken (tokenAddress:string, amount: BigNumber): Promise<ContractTransaction> {
    const tokenFactory = new ERC20__factory(this.signer)
    const token = tokenFactory.attach(tokenAddress)
    return await token.approve(this.schedulerContract.address, amount)
  }

  async _erc20Purchase (planId:number, quantity:number, tokenAddress:string, valueToTransfer: BigNumber): Promise<ContractTransaction> {
    const signerAddress = await this.signer!.getAddress()
    const tokenFactory = new ERC20__factory(this.signer)
    const token = tokenFactory.attach(tokenAddress)
    const allowance = await token.allowance(signerAddress, this.schedulerContract.address)
    if (allowance.lt(valueToTransfer)) throw Error('Not enough allowance')
    return await this.schedulerContract.purchase(planId, quantity)
  }

  async _erc677Purchase (planId: number, quantity: number, tokenAddress:string, valueToTransfer: BigNumber): Promise<ContractTransaction> {
    const encodedData = this.ethers.abiCoder.encode(['uint256', 'uint256'], [planId.toString(), quantity.toString()])
    const tokenFactory = new ERC677__factory(this.signer)
    const token = tokenFactory.attach(tokenAddress)

    return await token.transferAndCall(this.schedulerContract.address, valueToTransfer, encodedData)
  }

  _supportsTransferAndCall (tokenAddress:string) : boolean {
    return this.options?.supportedER677Tokens.includes(tokenAddress) || false
  }

  async purchasePlan (planId: number, quantity:number): Promise<ContractTransaction> {
    if (this.signer === undefined) throw new Error('Signer required')
    const plan = await this.getPlan(planId)
    const purchaseCost = plan.pricePerExecution.mul(quantity)
    const tokenFactory = new ERC20__factory(this.signer)
    const token = tokenFactory.attach(plan.token)
    const signerAddress = await this.signer!.getAddress()
    const balance = await token.balanceOf(signerAddress)

    if (balance.lt(purchaseCost)) throw new Error('Not enough balance')
    return (this._supportsTransferAndCall(plan.token))
      ? this._erc677Purchase(planId, quantity, plan.token, purchaseCost)
      : this._erc20Purchase(planId, quantity, plan.token, purchaseCost)
  }

  async remainingExecutions (planId:number):Promise<number> {
    if (this.signer === undefined) throw new Error('Signer required')
    const signerAddress = await this.signer?.getAddress()
    const remainingExecutions = await this.schedulerContract.remainingExecutions(signerAddress, planId)
    return remainingExecutions.toNumber()
  }
}
