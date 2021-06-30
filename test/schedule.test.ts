import { BigNumber } from 'ethers'
import { RIFScheduler, executionFactory, IPlanResponse } from '../src'
import { getUsers, contractsSetUp, plansSetup, encodedCallSamples } from './setup'
import dayjs from 'dayjs'
import * as cronParser from 'cron-parser'
import hasEvent from './hasEvent'
import { BlockchainDate } from './BlockchainDate'

/// this tests give a log message: Duplicate definition of Transfer (Transfer(address,address,uint256,bytes), Transfer(address,address,uint256))
/// don't worry: https://github.com/ethers-io/ethers.js/issues/905

jest.setTimeout(27000)

describe('SDK - schedule', function (this: {
    schedulerSDK: RIFScheduler,
    contracts: {
      schedulerAddress: string;
      tokenAddress: string;
      tokenAddress677: string;
    },
    plans: IPlanResponse[],
    encodedTxSamples: { successful: string, failing: string },
    consumerAddress: string
  }) {
  beforeEach(async () => {
    const users = await getUsers()
    this.contracts = await contractsSetUp()
    this.schedulerSDK = new RIFScheduler(this.contracts.schedulerAddress, users.serviceConsumer, { supportedER677Tokens: [this.contracts.tokenAddress677] })
    this.plans = await plansSetup(this.contracts.schedulerAddress, this.contracts.tokenAddress, this.contracts.tokenAddress677)
    this.encodedTxSamples = await encodedCallSamples()
    this.consumerAddress = await users.serviceConsumer.getAddress()
  })

  test('should schedule execution', async () => {
    const planId = 1
    const remainingExecutionsInitial = await this.schedulerSDK.remainingExecutions(planId)
    const tx = await this.schedulerSDK.purchasePlan(planId, 1)
    await tx.wait()
    const encodedMethodCall = this.encodedTxSamples.successful
    // TODO: review this code
    // const gas = await this.schedulerSDK.estimateGas(this.contracts.tokenAddress, encodedMethodCall)
    const timestamp = dayjs(await BlockchainDate.now(this.schedulerSDK.provider)).add(1, 'day').toDate()
    const valueToTransfer = BigNumber.from(1)

    const execution = executionFactory(planId, this.contracts.tokenAddress, encodedMethodCall, timestamp, valueToTransfer, this.consumerAddress)
    const scheduledExecution = await this.schedulerSDK.schedule(execution)
    const receipt = await scheduledExecution.wait()
    expect(hasEvent(receipt, 'ExecutionRequested')).toBe(true)
    const remainingExecutionsFinal = await this.schedulerSDK.remainingExecutions(planId)
    expect(remainingExecutionsFinal.sub(remainingExecutionsInitial).eq(0)).toBeTruthy()
  })

  test('should schedule multiple executions', async () => {
    const planId = 1
    const cronExpression = '*/30 * * * *'
    const quantity = 5
    const purchaseTx = await this.schedulerSDK.purchasePlan(planId, quantity)
    await purchaseTx.wait()
    const encodedMethodCall = this.encodedTxSamples.successful
    // TODO: review this code
    // const gas = await this.schedulerSDK.estimateGas(this.contracts.tokenAddress, encodedMethodCall)
    const timestamp = cronParser.parseExpression(cronExpression, { startDate: dayjs(await BlockchainDate.now(this.schedulerSDK.provider)).add(1, 'day').toDate() }).next().toDate()
    const valueToTransfer = BigNumber.from(1)

    const execution = executionFactory(planId, this.contracts.tokenAddress, encodedMethodCall, timestamp, valueToTransfer, this.consumerAddress)
    const scheduleExecutions = await this.schedulerSDK.scheduleMany(execution, cronExpression, quantity)
    const receipt = await scheduleExecutions.wait()
    const parsedResponse = this.schedulerSDK.parseScheduleManyReceipt(receipt)
    expect(hasEvent(receipt, 'ExecutionRequested')).toBe(true)
    expect(parsedResponse.length).toBe(quantity)

    for (let i = 0; i < quantity; i++) {
      expect(dayjs(parsedResponse[i].timestamp).diff(dayjs(timestamp), 'minutes')).toBe(30 * i)
    }
  })

  test('should fail to schedule multiple executions with no plan balance', async () => {
    const encodedMethodCall = this.encodedTxSamples.successful

    const value = 10000

    const execution = executionFactory(0, this.contracts.tokenAddress, encodedMethodCall, dayjs(await BlockchainDate.now(this.schedulerSDK.provider)).toDate(), value, this.consumerAddress)
    expect(async () => {
      await this.schedulerSDK.scheduleMany(execution, '*/15 * * * *', 1)
    }).rejects.toThrow("You don't enough remaining executions.")
  })
})
