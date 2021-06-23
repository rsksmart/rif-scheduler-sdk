import { Provider } from '@ethersproject/providers'
import type { RIFScheduler as RIFSchedulerContract } from '@rsksmart/rif-scheduler-contracts/dist/ethers-contracts'
// eslint-disable-next-line camelcase
import { RIFScheduler__factory } from '@rsksmart/rif-scheduler-contracts/dist/ethers-contracts/factories/RIFScheduler__factory'
import { BigNumber, ContractTransaction, Signer, utils, getDefaultProvider, ContractReceipt, Event, BigNumberish, constants } from 'ethers'
import { IPlanResponse, IExecutionRequest, ScheduledExecution, IExecutionResponse } from './types'
import dayjs from 'dayjs'
import * as cronParser from 'cron-parser'

// eslint-disable-next-line camelcase
import { ERC20__factory, ERC677__factory } from './contracts/types'
import { executionId } from './executionFactory'

type Options = {
  supportedER677Tokens: string[]
}

type ExecutionParam = string | IExecutionRequest
const executionIdFromParam = (execution: ExecutionParam) => typeof execution === 'string' ? execution : execution.id

export default class RifScheduler {
  schedulerContract!: RIFSchedulerContract
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
      this.provider = currentProviderOrSigner.provider!
      this.signer = currentProviderOrSigner
    } else {
      this.provider = currentProviderOrSigner
      this.signer = undefined
    }
    this.schedulerContract = RIFScheduler__factory.connect(contractAddress, currentProviderOrSigner)
    this.options = options
  }

  // plans
  getPlansCount = () => this.schedulerContract.plansCount()

  getPlan = (index: BigNumberish) => {
    const plan = this.schedulerContract.plans(index)
    return plan as IPlanResponse
  }

  remainingExecutions = (planId: BigNumberish) => this.signer!.getAddress()
    .then(signerAddress => this.schedulerContract.remainingExecutions(signerAddress, planId))

  // purchasing
  async approveToken (tokenAddress: string, amount: BigNumberish): Promise<ContractTransaction> {
    const tokenFactory = new ERC20__factory(this.signer)
    const token = tokenFactory.attach(tokenAddress)
    return await token.approve(this.schedulerContract.address, amount)
  }

  private async _erc20Purchase (planId: BigNumberish, quantity: BigNumberish, tokenAddress: string, valueToTransfer: BigNumberish): Promise<ContractTransaction> {
    const signerAddress = await this.signer!.getAddress()
    const token = ERC20__factory.connect(tokenAddress, this.signer!)
    const allowance = await token.allowance(signerAddress, this.schedulerContract.address)

    const hasAllowance = allowance.lt(valueToTransfer)

    if (hasAllowance) throw new Error(`The account ${signerAddress} has not enough allowance`)
    return await this.schedulerContract.purchase(planId, quantity)
  }

  private async _erc677Purchase (planId: BigNumberish, quantity: BigNumberish, tokenAddress: string, valueToTransfer: BigNumberish): Promise<ContractTransaction> {
    const encoder = new utils.AbiCoder()
    const encodedData = encoder.encode(['uint256', 'uint256'], [planId.toString(), quantity.toString()])
    const token = ERC677__factory.connect(tokenAddress, this.signer!)
    return await token.transferAndCall(this.schedulerContract.address, valueToTransfer, encodedData)
  }

  private async _rbtcPurchase (planId: BigNumberish, quantity: BigNumberish, valueToTransfer: BigNumberish): Promise<ContractTransaction> {
    const balance = await this.signer!.getBalance()
    if (balance.lt(valueToTransfer)) throw new Error('Not enough balance')
    return await this.schedulerContract.purchase(planId, quantity, { value: BigNumber.from(valueToTransfer) })
  }

  supportsApproveAndPurchase = (tokenAddress: string) => this.options && this.options.supportedER677Tokens
    .map(x => x.toLowerCase())
    .includes(tokenAddress.toLowerCase())

  async purchasePlan (planId: BigNumberish, quantity: BigNumberish): Promise<ContractTransaction> {
    const plan = await this.getPlan(planId)
    const purchaseCost = plan.pricePerExecution.mul(quantity)
    if (plan.token === constants.AddressZero) {
      return this._rbtcPurchase(planId, quantity, purchaseCost)
    } else {
      const token = ERC20__factory.connect(plan.token, this.signer!)
      const signerAddress = await this.signer!.getAddress()
      const balance = await token.balanceOf(signerAddress)

      if (balance.lt(purchaseCost)) throw new Error('Not enough balance')
      return (this.supportsApproveAndPurchase(plan.token))
        ? this._erc677Purchase(planId, quantity, plan.token, purchaseCost)
        : this._erc20Purchase(planId, quantity, plan.token, purchaseCost)
    }
  }

  // scheduling
  async estimateGas (
    contractAddress: string,
    encodedTransactionCall: utils.BytesLike
  ): Promise<BigNumber | undefined> {
    try {
      const gas = await this.provider
        .estimateGas({
          to: contractAddress,
          data: encodedTransactionCall
        })

      return gas
    } catch {
      // couldn't estimate the gas
      // it might be an invalid transaction
      return undefined
    }
  }

  schedule = (execution: IExecutionRequest) => this.schedulerContract.schedule(
    execution.plan,
    execution.to,
    execution.data,
    execution.gas,
    execution.timestamp,
    { value: execution.value }
  )

  async scheduleMany (execution: IExecutionRequest, cronExpression: string, quantity: BigNumberish): Promise<ContractTransaction> {
    const remainingExecutions = await this.remainingExecutions(execution.plan)
    if (remainingExecutions.lt(quantity)) throw new Error("You don't enough remaining executions.")

    const options = {
      currentDate: dayjs.unix(BigNumber.from(execution.timestamp).toNumber()).toDate(),
      iterator: true
    }
    const interval = cronParser.parseExpression(cronExpression, options)
    const requestedExecutions:string[] = []

    let next = BigNumber.from(execution.timestamp).toNumber() // first execution

    for (let i = 0; i < quantity; i++) {
      const encoder = new utils.AbiCoder()
      const encodedExecution = encoder.encode(['uint256', 'address', 'bytes', 'uint256', 'uint256', 'uint256'], [execution.plan, execution.to, execution.data, execution.gas, BigNumber.from(next), execution.value])
      requestedExecutions.push(encodedExecution)
      const nextDate: any = interval.next()
      next = dayjs(nextDate.value.toDate()).unix()
    }

    const totalValue = BigNumber.from(execution.value).mul(requestedExecutions.length)
    return await this.schedulerContract.batchSchedule(requestedExecutions, { value: totalValue })
  }

  parseScheduleManyReceipt = (receipt: ContractReceipt) =>
    receipt.events!.filter((ev:Event) => ev.args!.id !== undefined && ev.args!.timestamp !== undefined)
      .map(ev => (({ id: ev.args!.id, timestamp: dayjs.unix(ev!.args!.timestamp).toDate() }) as ScheduledExecution))

  // cancellation
  cancelExecution = (execution: string | IExecutionRequest) => this.schedulerContract.cancelScheduling(executionIdFromParam(execution))

  // querying executions
  getExecutionState = (execution: string | IExecutionRequest) => this.schedulerContract.getState(executionIdFromParam(execution))

  getScheduledExecutionsCount = (accountAddress: string) => this.schedulerContract.executionsByRequestorCount(accountAddress)

  getScheduledExecutions = async (accountAddress: string, fromIndex: BigNumberish, toIndex: BigNumberish) => {
    const executions = await this.schedulerContract.getExecutionsByRequestor(accountAddress, fromIndex, toIndex)
    return executions.map((x:IExecutionResponse) => {
      const executionTimestampDate = dayjs.unix(BigNumber.from(x.timestamp).toNumber()).toDate()

      const execution: IExecutionResponse = {
        data: x.data,
        gas: x.gas,
        plan: x.plan,
        requestor: x.requestor,
        to: x.to,
        value: x.value,
        id: executionId(x.requestor, x.plan, x.to, x.data, x.gas, executionTimestampDate, x.value),
        timestamp: executionTimestampDate
      }

      return execution
    })
  }
}
