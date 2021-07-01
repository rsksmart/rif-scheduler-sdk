import { BigNumber } from 'ethers'
import { RIFScheduler, executionFactory, ExecutionState, IExecutionRequest, IExecutionResponse, IPlanResponse } from '../src'
import { getUsers, contractsSetUp, plansSetup, encodedCallSamples } from './setup'
import dayjs from 'dayjs'
import { timeLatest } from './timeLatest'

/// this tests give a log message: Duplicate definition of Transfer (Transfer(address,address,uint256,bytes), Transfer(address,address,uint256))
/// don't worry: https://github.com/ethers-io/ethers.js/issues/905

jest.setTimeout(27000)

describe('SDK - execution', function (this: {
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

  describe('should get scheduled execution state', () => {
    let state: ExecutionState
    let execution: IExecutionRequest

    beforeEach(async () => {
      const planId = 1
      const purchaseTx = await this.schedulerSDK.purchasePlan(planId, 1)
      await purchaseTx.wait()
      const encodedMethodCall = this.encodedTxSamples.successful
      // TODO: review this code
      // const gas = await this.schedulerSDK.estimateGas(this.contracts.tokenAddress, encodedMethodCall)
      const timestamp = dayjs(await timeLatest()).add(1, 'day').toDate()
      const valueToTransfer = BigNumber.from(1)

      execution = executionFactory(planId, this.contracts.tokenAddress, encodedMethodCall, timestamp, valueToTransfer, this.consumerAddress)
      const tx = await this.schedulerSDK.schedule(execution)
      await tx.wait()
    })

    test('using execution as parameter', async () => { state = await this.schedulerSDK.getExecutionState(execution) })
    test('using execution id as parameter', async () => { state = await this.schedulerSDK.getExecutionState(execution.id) })

    afterEach(async () => {
      expect(state).toBe(ExecutionState.Scheduled)
    })
  })

  test('should get scheduled executions by requester', async () => {
    const planId = 1
    const cronExpression = '0 0 */1 * *'
    const quantity = 7
    const purchaseTx = await this.schedulerSDK.purchasePlan(planId, quantity)
    await purchaseTx.wait()
    const encodedMethodCall = this.encodedTxSamples.successful
    // TODO: review this code
    // const gas = await this.schedulerSDK.estimateGas(this.contracts.tokenAddress, encodedMethodCall)
    const today = await timeLatest()
    const startTimestamp = dayjs(new Date(today.getFullYear(), today.getMonth(), today.getDate())).add(1, 'day').toDate()
    const valueToTransfer = BigNumber.from(1)

    const execution = executionFactory(planId, this.contracts.tokenAddress, encodedMethodCall, startTimestamp, valueToTransfer, this.consumerAddress)
    const scheduleExecutionsTransaction = await this.schedulerSDK.scheduleMany(execution, cronExpression, quantity)
    await scheduleExecutionsTransaction.wait()

    const scheduledTransactionsCount = await this.schedulerSDK.getScheduledExecutionsCount(this.consumerAddress)
    const pageSize = 2

    let fromIndex = 0
    let toIndex = 0
    let pageNumber = 1
    let hasMore = true
    const result: IExecutionResponse[] = []
    while (hasMore) {
      fromIndex = (pageNumber - 1) * pageSize
      toIndex = pageNumber * pageSize

      if (scheduledTransactionsCount.lte(toIndex)) {
        hasMore = false
        toIndex = scheduledTransactionsCount.toNumber()
      }

      const scheduledTransactionsPage = await this.schedulerSDK.getScheduledExecutions(this.consumerAddress, fromIndex, toIndex)

      result.push(...scheduledTransactionsPage)

      pageNumber++
    }

    expect(scheduledTransactionsCount.eq(quantity)).toBeTruthy()
    expect(result.length).toBe(quantity)

    for (const execution of result) {
      expect(execution.id).toBeDefined()
      expect(execution.timestamp >= startTimestamp).toBeTruthy()
    }
  })
})
