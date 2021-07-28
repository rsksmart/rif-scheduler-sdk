import { BigNumber, BigNumberish, ContractTransaction, providers, utils } from 'ethers'
import dayjs from 'dayjs'
import * as cronParser from 'cron-parser'
import { Plan } from './Plan'
import { Base, Config } from './Base'

export enum EExecutionState {
  NotScheduled = 0,
  Scheduled = 1,
  ExecutionSuccessful = 2,
  ExecutionFailed = 3,
  Overdue = 4,
  Refunded = 5,
  Cancelled = 6
}

class Execution extends Base {
  public executeAtBigNumber: BigNumber;
  public value: BigNumber;

  constructor (
    public config: Config,
    public plan: Plan,
    public contractAddress: string,
    public contractFunctionEncoded: utils.BytesLike,
    public executeAt: Date,
    value: BigNumberish,
    public requestor: string
  ) {
    super(config)

    this.value = BigNumber.from(value)
    this.executeAtBigNumber = BigNumber.from(dayjs(executeAt).unix())
  }

  public getId (): string {
    const encoder = new utils.AbiCoder()

    const paramTypes = ['address', 'uint256', 'address', 'bytes', 'uint256', 'uint256']
    const paramValues = [
      this.requestor,
      this.plan.index.toString(),
      this.contractAddress,
      this.contractFunctionEncoded,
      this.executeAtBigNumber.toString(),
      this.value.toString()
    ]
    const encodedData = encoder.encode(paramTypes, paramValues)
    return utils.keccak256(encodedData)
  }

  public encode (): string {
    const encoder = new utils.AbiCoder()

    const paramTypes = ['uint256', 'address', 'bytes', 'uint256', 'uint256']
    const paramValues = [
      this.plan.index,
      this.contractAddress,
      this.contractFunctionEncoded,
      this.executeAtBigNumber,
      this.value
    ]

    return encoder.encode(paramTypes, paramValues)
  }

  public async estimateGas (provider: providers.Provider): Promise<BigNumber | null> {
    try {
      const gas = await provider
        .estimateGas({
          to: this.contractAddress,
          data: this.contractFunctionEncoded
        })

      return gas
    } catch {
      // cannot estimate the gas
      // could result in a failed execution
      return null
    }
  }

  public async getState (): Promise<EExecutionState> {
    return this.schedulerContract.getState(this.getId())
  }

  public async cancel (): Promise<ContractTransaction> {
    return this.schedulerContract.cancelScheduling(this.getId())
  }

  public async refund (): Promise<ContractTransaction> {
    return this.schedulerContract.requestExecutionRefund(this.getId())
  }

  public static fromCronExpression (
    execution: Execution,
    cronExpression: string,
    quantity: BigNumberish
  ): Execution[] {
    const parser = cronParser.parseExpression(cronExpression, {
      currentDate: execution.executeAt,
      iterator: true
    })

    const requestedExecutions: Execution[] = []

    let nextExecuteAt = execution.executeAt // first execution

    for (let i = 0; i < quantity; i++) {
      requestedExecutions.push(
        new Execution(
          execution.config,
          execution.plan,
          execution.contractAddress,
          execution.contractFunctionEncoded,
          nextExecuteAt,
          execution.value,
          execution.requestor
        )
      )

      const nextDate = parser.next()
      nextExecuteAt = nextDate.value.toDate()
    }

    return requestedExecutions
  }
}

export { Execution }
