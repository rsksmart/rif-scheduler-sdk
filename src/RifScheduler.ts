import { Provider } from '@ethersproject/providers'
import { OneShotSchedule } from './contracts/types/OneShotSchedule'
import OneShotSchedulerBuild from './contracts/OneShotSchedule.json'
import { BigNumber, BigNumberish, ContractTransaction, Signer, utils } from 'ethers'
import { ExecutionState, IPlan, IExecution } from './types'
import dayjs from 'dayjs'
import * as cronParser from 'cron-parser'

// eslint-disable-next-line camelcase
import { ERC20__factory, ERC677__factory } from './contracts/types'
import { JsonFragment } from '@ethersproject/abi'

type Options = {
  supportedER677Tokens: string[]
}
export default class RifScheduler {
  schedulerContract!: OneShotSchedule
  ethers: any
  provider!: Provider
  signer?: Signer
  signerAddress?: string
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
   * @param options
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
      this.signerAddress = await this.signer.getAddress()
    } else {
      this.provider = currentProviderOrSigner
      this.signer = undefined
      this.signerAddress = undefined
    }
    const oneSchedulerContract = await this.provider.getCode(contractAddress)
    if (oneSchedulerContract === '0x') {
      throw new Error('Safe contract is not deployed in the current network')
    }
    this.ethers = ethers
    this.schedulerContract = new this.ethers.Contract(contractAddress, OneShotSchedulerBuild.abi, currentProviderOrSigner)
    this.options = options
  }

  async getPlan (index:number):Promise<IPlan> {
    const plan = await this.schedulerContract.plans(BigNumber.from(index))
    return plan as IPlan
  }

  async approveToken (tokenAddress:string, amount: BigNumber): Promise<ContractTransaction> {
    const tokenFactory = new ERC20__factory(this.signer)
    const token = tokenFactory.attach(tokenAddress)
    return await token.approve(this.schedulerContract.address, amount)
  }

  private async _erc20Purchase (planId:number, quantity:number, tokenAddress:string, valueToTransfer: BigNumber): Promise<ContractTransaction> {
    if (this.signerAddress === undefined) throw new Error('Signer required')
    const tokenFactory = new ERC20__factory(this.signer)
    const token = tokenFactory.attach(tokenAddress)
    const allowance = await token.allowance(this.signerAddress, this.schedulerContract.address)

    const hasAllowance = allowance.lt(valueToTransfer)

    if (hasAllowance) throw new Error(`The account ${this.signerAddress} has not enough allowance`)
    return await this.schedulerContract.purchase(planId, quantity)
  }

  private async _erc677Purchase (planId: number, quantity: number, tokenAddress:string, valueToTransfer: BigNumber): Promise<ContractTransaction> {
    if (this.signerAddress === undefined) throw new Error('Signer required')
    const encoder = new this.ethers.utils.AbiCoder()
    const encodedData = encoder.encode(['uint256', 'uint256'], [planId.toString(), quantity.toString()])
    const tokenFactory = new ERC677__factory(this.signer)
    const token = tokenFactory.attach(tokenAddress)

    return await token.transferAndCall(this.schedulerContract.address, valueToTransfer, encodedData)
  }

  private _supportsTransferAndCall (tokenAddress:string) : boolean {
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

  async estimateGas (
    abi: string | readonly (string | utils.Fragment | JsonFragment)[],
    contractAddress: string,
    methodName: string,
    methodParams: string[]
  ): Promise<BigNumber | undefined> {
    try {
      const executeMethod = new this.ethers.utils
        .Interface(abi)
        .encodeFunctionData(methodName, methodParams)

      return this.provider
        .estimateGas({
          to: contractAddress,
          data: executeMethod
        })
    } catch {
      // couldn't estimate the gas
      // it might be an invalid transaction
      return undefined
    }
  }

  executionId (e:IExecution):string {
    const encoder = new this.ethers.utils.AbiCoder()
    const paramTypes = ['address', 'uint256', 'address', 'bytes', 'uint256', 'uint256', 'uint256']
    const paramValues = [e.requestor, e.plan.toString(), e.to, e.data, e.gas.toString(), e.timestamp.toString(), e.value]
    const encodedData = encoder.encode(paramTypes, paramValues)
    return this.ethers.utils.keccak256(encodedData)
  }

  getExecution (plan: BigNumberish, executionContractAddress: string, encodedTransactionCall: utils.BytesLike, gas: BigNumberish, executionTimeInSeconds: BigNumberish, value: BigNumberish, from?:string):IExecution {
    if (from === undefined && this.signerAddress === undefined) throw new Error('You need to specify the requestorAddress')
    const execution:IExecution = {
      requestor: from || this.signerAddress!,
      plan: BigNumber.from(plan),
      data: encodedTransactionCall,
      gas: BigNumber.from(gas),
      timestamp: BigNumber.from(executionTimeInSeconds),
      value: BigNumber.from(value),
      to: executionContractAddress
    }
    return execution
  }

  async schedule (execution:IExecution):Promise<ContractTransaction> {
    if (this.signer === undefined) throw new Error('Signer required')
    return this.schedulerContract.schedule(execution.plan, execution.to, execution.data, execution.gas, execution.timestamp, { value: execution.value })
  }
  
  scheduleMany (execution:IExecution, cronExpression:string, quantity:number):Promise<ContractTransaction>[] {
    if (this.signer === undefined) throw new Error('Signer required')
    const scheduledTransactions:Promise<ContractTransaction>[] = []
    let next:any;
    for(let i=0;i<quantity;i++){
      try{
        next = cronParser.parseExpression(cronExpression).next()
      } catch(e){
        break;
      }
      const nextTimestamp = dayjs(next.toDate()).unix()
      const nextExecution: IExecution = {...execution,timestamp:BigNumber.from(nextTimestamp)}
      scheduledTransactions.push(this.schedule(nextExecution))
    }
    return scheduledTransactions
  }

  async getExecutionState (execution: string | IExecution): Promise<ExecutionState> {
    const id = typeof execution === 'string' ? execution : this.executionId(execution)
    const stateResult:ExecutionState = await this.schedulerContract.getState(id)
    return stateResult
  }
}
