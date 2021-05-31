import { Provider } from '@ethersproject/providers'
import { OneShotSchedule } from './contracts/types/OneShotSchedule'
import { BigNumber, ContractTransaction, Signer, utils, getDefaultProvider, ContractReceipt, Event } from 'ethers'
import { ExecutionState, IPlan, IExecutionRequest, IExecution, ScheduledExecution } from './types'
import dayjs from 'dayjs'
import * as cronParser from 'cron-parser'

// eslint-disable-next-line camelcase
import { ERC20__factory, ERC677__factory, OneShotSchedule__factory } from './contracts/types'
import { JsonFragment } from '@ethersproject/abi'

type Options = {
  supportedER677Tokens: string[]
}
export default class RifScheduler {
  schedulerContract!: OneShotSchedule
  provider!: Provider
  signer?: Signer
  options?: Options

  /**
   * Initializes the Safe Core SDK instance.
   *
   * @param contractAddress - The address of the OneShotSchedule contract
   * @param providerOrSigner - Ethers provider or signer. If this parameter is not passed, Ethers defaultProvider will be used.
   * @param options
   */

  constructor (
    contractAddress: string,
    providerOrSigner?: Provider | Signer,
    options?: Options
  ) {
    const currentProviderOrSigner = providerOrSigner || getDefaultProvider()
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
    this.schedulerContract = OneShotSchedule__factory.connect(contractAddress, currentProviderOrSigner)
    this.options = options
  }

  async getPlansCount (): Promise<number> {
    const count = await this.schedulerContract.plansCount()
    return count.toNumber()
  }

  async getPlan (index:number): Promise<IPlan> {
    const plan = await this.schedulerContract.plans(BigNumber.from(index))
    return plan as IPlan
  }

  async approveToken (tokenAddress:string, amount: BigNumber): Promise<ContractTransaction> {
    const tokenFactory = new ERC20__factory(this.signer)
    const token = tokenFactory.attach(tokenAddress)
    return await token.approve(this.schedulerContract.address, amount)
  }

  private async _erc20Purchase (planId:number, quantity:number, tokenAddress:string, valueToTransfer: BigNumber): Promise<ContractTransaction> {
    const signerAddress = await this.signer?.getAddress()
    if (signerAddress === undefined) throw new Error('Signer required')
    const tokenFactory = new ERC20__factory(this.signer)
    const token = tokenFactory.attach(tokenAddress)
    const allowance = await token.allowance(signerAddress, this.schedulerContract.address)

    const hasAllowance = allowance.lt(valueToTransfer)

    if (hasAllowance) throw new Error(`The account ${signerAddress} has not enough allowance`)
    return await this.schedulerContract.purchase(planId, quantity)
  }

  private async _erc677Purchase (planId: number, quantity: number, tokenAddress:string, valueToTransfer: BigNumber): Promise<ContractTransaction> {
    if (this.signer === undefined) throw new Error('Signer required')
    const encoder = new utils.AbiCoder()
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

  async remainingExecutions (planId:BigNumber):Promise<number> {
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
      const executeMethod = new utils
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

  async schedule (execution:IExecutionRequest):Promise<ContractTransaction> {
    if (this.signer === undefined) throw new Error('Signer required')
    return this.schedulerContract.schedule(execution.plan, execution.to, execution.data, execution.gas, execution.timestamp, { value: execution.value })
  }

  async scheduleMany (execution:IExecutionRequest, cronExpression:string, quantity:number): Promise<ContractTransaction> {
    if (this.signer === undefined) throw new Error('Signer required')
    const remainingExecutions = await this.remainingExecutions(execution.plan)
    if (remainingExecutions < quantity) throw new Error("You don't enough remaining executions.")

    const options = {
      currentDate: dayjs.unix(execution.timestamp.toNumber()).toDate(),
      iterator: true
    }
    const interval = cronParser.parseExpression(cronExpression, options)
    const requestedExecutions:string[] = []

    let next = execution.timestamp.toNumber() // first execution

    for (let i = 0; i < quantity; i++) {
      const encoder = new utils.AbiCoder()
      const encodedExecution = encoder.encode(['uint256', 'address', 'bytes', 'uint256', 'uint256', 'uint256'], [execution.plan, execution.to, execution.data, execution.gas, BigNumber.from(next), execution.value])
      requestedExecutions.push(encodedExecution)
      try {
        const nextDate:any = interval.next()
        next = dayjs(nextDate.value.toDate()).unix()
      } catch (e) {
        break
      }
    }
    if (requestedExecutions.length !== quantity) throw new Error(`You cannot schedule transactions using ${cronExpression}`)
    const totalValue = execution.value.mul(requestedExecutions.length)
    return this.schedulerContract.batchSchedule(requestedExecutions, { value: totalValue })
  }

  parseScheduleManyReceipt (receipt:ContractReceipt):ScheduledExecution[] {
    return (receipt.events)
      ? receipt.events.filter((ev:Event) => ev.args?.id !== undefined && ev.args?.timestamp !== undefined)
        .map(ev => (({ id: ev.args!.id, timestamp: dayjs.unix(ev!.args!.timestamp).toDate() }) as ScheduledExecution))
      : []
  }

  async getExecutionState (execution: string | IExecution): Promise<ExecutionState> {
    const id = typeof execution === 'string' ? execution : execution.id
    const stateResult:ExecutionState = await this.schedulerContract.getState(id)
    return stateResult
  }

  async cancelScheduling (execution: string | IExecution): Promise<void> {
    const id = typeof execution === 'string' ? execution : this.executionId(execution)
    await this.schedulerContract.cancelScheduling(id)
  }
}
