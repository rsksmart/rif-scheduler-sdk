import RifScheduler from '../RifScheduler'
import { BigNumber, providers } from 'ethers'
import { ContractReceipt } from '@ethersproject/contracts'
import { ExecutionState, IExecutionRequest, IExecutionResponse, IPlanResponse } from '../types'
import { getUsers, contractsSetUp, plansSetup, encodedCallSamples } from './setup'
import dayjs from 'dayjs'
import * as cronParser from 'cron-parser'
import { executionFactory } from '../executionFactory'
// eslint-disable-next-line camelcase
import { ERC20__factory } from '../contracts/types'

/// this tests give a log message: Duplicate definition of Transfer (Transfer(address,address,uint256,bytes), Transfer(address,address,uint256))
/// don't worry: https://github.com/ethers-io/ethers.js/issues/905

jest.setTimeout(27000)

function equalPlans (p1:IPlanResponse, p2:IPlanResponse):boolean {
  return (
    p1.active === p2.active &&
    p1.pricePerExecution.toString() === p2.pricePerExecution.toString() &&
    p1.token === p2.token &&
    p1.window.toString() === p2.window.toString()
  )
}

function hasEvent (receipt:ContractReceipt, eventName:string):boolean {
  return (receipt?.events) ? receipt.events.findIndex(e => e.event === eventName) > -1 : false
}

describe('RifScheduler', function (this: {
    schedulerSDK: RifScheduler,
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
    this.schedulerSDK = new RifScheduler(this.contracts.schedulerAddress, users.serviceConsumer, { supportedER677Tokens: [this.contracts.tokenAddress677] })
    this.plans = await plansSetup(this.contracts.schedulerAddress, this.contracts.tokenAddress, this.contracts.tokenAddress677)
    this.encodedTxSamples = await encodedCallSamples()
    this.consumerAddress = await users.serviceConsumer.getAddress()
  })

  describe('config', () => {
    test('should allow to setup without provider', () => {
      const otherInstance = new RifScheduler(this.contracts.schedulerAddress, undefined, { supportedER677Tokens: [this.contracts.tokenAddress677] })
      expect(otherInstance.provider).toBeDefined()
    })

    test('should allow provider with no signer', () => {
      const otherInstance = new RifScheduler(this.contracts.schedulerAddress, new providers.JsonRpcProvider(), { supportedER677Tokens: [this.contracts.tokenAddress677] })
      expect(otherInstance.provider).toBeDefined()
    })
  })

  test('should return plan info', async () => {
    const plan = await this.schedulerSDK.getPlan(0)
    expect(equalPlans(plan, this.plans[0])).toBe(true)
  })

  test('purchase plan ERC20', async () => {
    const selectedPlan = this.plans[0]
    await this.schedulerSDK
      .approveToken(
        selectedPlan.token,
        selectedPlan.pricePerExecution
      )

    const purchaseResult = await this.schedulerSDK.purchasePlan(0, 1)
    const receipt = await purchaseResult.wait(1)
    expect(hasEvent(receipt, 'ExecutionPurchased')).toBe(true)
    const remainingExecutions = await this.schedulerSDK.remainingExecutions(0)
    expect(remainingExecutions.eq(1)).toBeTruthy()
  })

  test('cannot purchase plan ERC20 without enough tokens', async () => {
    const selectedPlan = this.plans[0]

    await this.schedulerSDK
      .approveToken(
        selectedPlan.token,
        selectedPlan.pricePerExecution
      )

    const token = await ERC20__factory.connect(this.contracts.tokenAddress, this.schedulerSDK.signer!)
    await token.transfer(await new providers.JsonRpcProvider().getSigner(7).getAddress(), await token.balanceOf(this.consumerAddress))

    expect(
      () => this.schedulerSDK.purchasePlan(0, 1)
    ).rejects.toThrow()
  })

  test('cannot purchase plan ERC20 without enough approval', async () => {
    const selectedPlan = this.plans[0]

    const token = await ERC20__factory.connect(this.contracts.tokenAddress, this.schedulerSDK.signer!)
    await token.approve(this.schedulerSDK.schedulerContract!.address, selectedPlan.pricePerExecution.sub('1'))

    expect(
      () => this.schedulerSDK.purchasePlan(0, 1)
    ).rejects.toThrow()
  })

  test('purchase plan ERC667', async () => {
    const selectedPlan = this.plans[1]
    selectedPlan.token = this.contracts.tokenAddress677
    await this.schedulerSDK.purchasePlan(1, 1)
    const remainingExecutions = await this.schedulerSDK.remainingExecutions(1)
    expect(remainingExecutions.eq(1)).toBeTruthy()
  })

  test('purchase plan rBTC', async () => {
    await this.schedulerSDK.purchasePlan(2, 1)
    const remainingExecutions = await this.schedulerSDK.remainingExecutions(2)
    expect(remainingExecutions.eq(1)).toBeTruthy()
  })

  test('cannot purchase plan rBTC without balance', async () => {
    // this test needs different accounts, thus test run simultaneously
    // and the testing account should never go to balance 0
    const provider = new providers.JsonRpcProvider()
    const other = provider.getSigner(7)
    const consumer = provider.getSigner(8)

    const schedulerSDK = new RifScheduler(this.contracts.schedulerAddress, consumer, { supportedER677Tokens: [this.contracts.tokenAddress677] })

    await consumer.sendTransaction({ to: await other.getAddress(), value: (await provider.getBalance(await consumer.getAddress())), gasPrice: 0 })

    expect(
      () => schedulerSDK.purchasePlan(2, 1)
    ).rejects.toThrow()

    await other.sendTransaction({ to: await consumer.getAddress(), value: (await provider.getBalance(await other.getAddress())), gasPrice: 0 })
  })

  test('should be able to estimateGas for a valid tx', async () => {
    const encodedMethodCall = this.encodedTxSamples.successful

    const gasResult = await this.schedulerSDK
      .estimateGas(this.contracts.tokenAddress, encodedMethodCall)

    expect(gasResult).toBeDefined()
    expect(gasResult?.gte(BigNumber.from(0))).toBe(true)
  })

  test('should not estimateGas for invalid method/parameter', async () => {
    const encodedMethodCall = this.encodedTxSamples.failing

    const gasResult = await this.schedulerSDK
      .estimateGas(this.contracts.tokenAddress, encodedMethodCall)

    expect(gasResult).not.toBeDefined()
  })

  test('should schedule transaction', async () => {
    const planId = 1
    const remainingExecutionsInitial = await this.schedulerSDK.remainingExecutions(planId)
    await this.schedulerSDK.purchasePlan(planId, 1)
    const encodedMethodCall = this.encodedTxSamples.successful
    const gas = await this.schedulerSDK.estimateGas(this.contracts.tokenAddress, encodedMethodCall)
    const timestamp = dayjs().add(1, 'day').toDate()
    const valueToTransfer = BigNumber.from(1)

    const execution = executionFactory(planId, this.contracts.tokenAddress, encodedMethodCall, gas!, timestamp, valueToTransfer, this.consumerAddress)
    const scheduledExecution = await this.schedulerSDK.schedule(execution)
    const receipt = await scheduledExecution.wait(1)
    expect(hasEvent(receipt, 'ExecutionRequested')).toBe(true)
    const remainingExecutionsFinal = await this.schedulerSDK.remainingExecutions(planId)
    expect(remainingExecutionsFinal.sub(remainingExecutionsInitial).eq(0)).toBeTruthy()
  })

  describe('should get scheduled transaction state', () => {
    let state: ExecutionState
    let execution: IExecutionRequest

    beforeEach(async () => {
      const planId = 1
      await this.schedulerSDK.purchasePlan(planId, 1)

      const encodedMethodCall = this.encodedTxSamples.successful
      const gas = await this.schedulerSDK.estimateGas(this.contracts.tokenAddress, encodedMethodCall)
      const timestamp = dayjs().add(1, 'day').toDate()
      const valueToTransfer = BigNumber.from(1)

      execution = executionFactory(planId, this.contracts.tokenAddress, encodedMethodCall, gas!, timestamp, valueToTransfer, this.consumerAddress)
      const tx = await this.schedulerSDK.schedule(execution)
      await tx.wait()
    })

    test('using execution as parameter', async () => { state = await this.schedulerSDK.getExecutionState(execution) })
    test('using execution id as parameter', async () => { state = await this.schedulerSDK.getExecutionState(execution.id) })

    afterEach(async () => {
      expect(state).toBe(ExecutionState.Scheduled)
    })
  })

  test('should get scheduled multiple transactions', async () => {
    const planId = 1
    const cronExpression = '*/15 * * * *'
    const quantity = 5
    await this.schedulerSDK.purchasePlan(planId, quantity)

    const encodedMethodCall = this.encodedTxSamples.successful
    const gas = await this.schedulerSDK.estimateGas(this.contracts.tokenAddress, encodedMethodCall)
    const timestamp = cronParser.parseExpression(cronExpression, { startDate: dayjs().add(1, 'day').toDate() }).next().toDate()
    const valueToTransfer = BigNumber.from(1)

    const execution = executionFactory(planId, this.contracts.tokenAddress, encodedMethodCall, gas!, timestamp, valueToTransfer, this.consumerAddress)
    const scheduleExecutions = await this.schedulerSDK.scheduleMany(execution, cronExpression, quantity)
    const receipt = await scheduleExecutions.wait(1)
    const parsedResponse = this.schedulerSDK.parseScheduleManyReceipt(receipt)
    expect(hasEvent(receipt, 'ExecutionRequested')).toBe(true)
    expect(parsedResponse.length).toBe(quantity)

    for (let i = 0; i < quantity; i++) {
      expect(dayjs(parsedResponse[i].timestamp).diff(dayjs(timestamp), 'minutes')).toBe(15 * i)
    }
  })

  test('should fail to scheduled multiple transactions with no plan balance', async () => {
    const encodedMethodCall = this.encodedTxSamples.successful
    const execution = executionFactory(0, this.contracts.tokenAddress, encodedMethodCall, 1000, dayjs().toDate(), 10000, this.consumerAddress)
    expect(async () => {
      await this.schedulerSDK.scheduleMany(execution, '*/15 * * * *', 1)
    }).rejects.toThrow("You don't enough remaining executions.")
  })

  test('should return the plans count', async () => {
    const count = await this.schedulerSDK
      .getPlansCount()

    expect(count.gt(0)).toBeTruthy()
    expect(count.eq(this.plans.length)).toBeTruthy()
  })

  test('should be able to cancel a scheduled tx', async () => {
    const planId = 1
    await this.schedulerSDK.purchasePlan(planId, 1)

    const encodedMethodCall = this.encodedTxSamples.successful
    const gas = await this.schedulerSDK.estimateGas(this.contracts.tokenAddress, encodedMethodCall)
    const timestamp = dayjs().add(1, 'day').toDate()
    const valueToTransfer = BigNumber.from(1)

    const execution = executionFactory(planId, this.contracts.tokenAddress, encodedMethodCall, gas!, timestamp, valueToTransfer, this.consumerAddress)
    const scheduledExecution = await this.schedulerSDK.schedule(execution)
    await scheduledExecution.wait(1)

    const initialState = await this.schedulerSDK.getExecutionState(execution)

    await this.schedulerSDK.cancelExecution(execution)

    const stateAfterCancel = await this.schedulerSDK.getExecutionState(execution)

    expect(initialState).toBe(ExecutionState.Scheduled)
    expect(stateAfterCancel).toBe(ExecutionState.Cancelled)
  })

  test('cancel should fail with a not scheduled tx', async () => {
    const planId = 1

    const encodedMethodCall = this.encodedTxSamples.successful
    const gas = 100
    const timestamp = dayjs().add(1, 'day').toDate()
    const valueToTransfer = BigNumber.from(1)

    const execution = executionFactory(planId, this.contracts.tokenAddress, encodedMethodCall, gas!, timestamp, valueToTransfer, this.consumerAddress)

    await expect(this.schedulerSDK.cancelExecution(execution))
      .rejects
      .toThrow('VM Exception while processing transaction: revert Transaction not scheduled')
  })

  test('should get scheduled transactions by requester', async () => {
    const planId = 1
    const cronExpression = '*/15 * * * *'
    const quantity = 7
    await this.schedulerSDK.purchasePlan(planId, quantity)

    const encodedMethodCall = this.encodedTxSamples.successful
    const gas = await this.schedulerSDK.estimateGas(this.contracts.tokenAddress, encodedMethodCall)
    const startTimestamp = cronParser.parseExpression(cronExpression, { startDate: dayjs().add(1, 'day').toDate() }).next().toDate()
    const valueToTransfer = BigNumber.from(1)

    const execution = executionFactory(planId, this.contracts.tokenAddress, encodedMethodCall, gas!, startTimestamp, valueToTransfer, this.consumerAddress)
    const scheduleExecutionsTransaction = await this.schedulerSDK.scheduleMany(execution, cronExpression, quantity)
    await scheduleExecutionsTransaction.wait(1)

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
