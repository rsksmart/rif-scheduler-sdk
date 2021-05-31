import RifScheduler from '../RifScheduler'
import { BigNumber } from 'ethers'
import { ContractReceipt } from '@ethersproject/contracts'
import { ExecutionState, IPlan } from '../types'
import { getUsers, contractsSetUp, plansSetup, encodedCallSamples } from './setup'
import ERC677Data from '../contracts/ERC677.json'
import dayjs from 'dayjs'
import * as cronParser from 'cron-parser'
import { executionFactory } from '../executionFactory'

/// this tests give a log message: Duplicate definition of Transfer (Transfer(address,address,uint256,bytes), Transfer(address,address,uint256))
/// don't worry: https://github.com/ethers-io/ethers.js/issues/905

jest.setTimeout(27000)

function equalPlans (p1:IPlan, p2:IPlan):boolean {
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
    plans: IPlan[],
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
  test('should return plan info', async () => {
    const plan = await this.schedulerSDK.getPlan(0)
    expect(equalPlans(plan, this.plans[0])).toBe(true)
  })

  test('purchase plan ERC20', async () => {
    const selectedPlan = this.plans[0]
    await this.schedulerSDK
      .approveToken(
        selectedPlan.token,
        BigNumber.from(selectedPlan.pricePerExecution)
      )

    const purchaseResult = await this.schedulerSDK.purchasePlan(0, 1)
    const receipt = await purchaseResult.wait(1)
    expect(hasEvent(receipt, 'ExecutionPurchased')).toBe(true)
    const remainingExecutions = await this.schedulerSDK.remainingExecutions(BigNumber.from(0))
    expect(remainingExecutions.toString(10)).toBe('1')
  })

  test('purchase plan ERC667', async () => {
    const selectedPlan = this.plans[1]
    selectedPlan.token = this.contracts.tokenAddress677
    await this.schedulerSDK.purchasePlan(1, 1)
    const remainingExecutions = await this.schedulerSDK.remainingExecutions(BigNumber.from(1))
    expect(remainingExecutions.toString(10)).toBe('1')
  })

  test('should be able to estimateGas for a valid tx', async () => {
    const gasResult = await this.schedulerSDK
      .estimateGas(ERC677Data.abi, this.contracts.tokenAddress, 'balanceOf', [this.consumerAddress])

    expect(gasResult).toBeDefined()
    expect(gasResult?.gte(BigNumber.from(0))).toBe(true)
  })

  test('should not estimateGas for invalid method', async () => {
    const gasResult = await this.schedulerSDK
      .estimateGas(ERC677Data.abi, this.contracts.tokenAddress, 'method-no-exist', [this.consumerAddress])

    expect(gasResult).not.toBeDefined()
  })

  test('should not estimateGas for invalid parameter', async () => {
    const gasResult = await this.schedulerSDK
      .estimateGas(ERC677Data.abi, this.contracts.tokenAddress, 'balanceOf', ['not-address'])

    expect(gasResult).not.toBeDefined()
  })

  test('should schedule transaction', async () => {
    const planId = 1
    const remainingExecutionsInitial = await this.schedulerSDK.remainingExecutions(BigNumber.from(planId))
    await this.schedulerSDK.purchasePlan(planId, 1)
    const encodedMethodCall = this.encodedTxSamples.successful
    const gas = await this.schedulerSDK.estimateGas(ERC677Data.abi, this.contracts.tokenAddress, 'balanceOf', [this.consumerAddress])
    const timestamp = dayjs().add(1, 'day').toDate()
    const valueToTransfer = BigNumber.from(1)

    const execution = executionFactory(planId, this.contracts.tokenAddress, encodedMethodCall, gas!, timestamp, valueToTransfer, this.consumerAddress)
    const scheduledExecution = await this.schedulerSDK.schedule(execution)
    const receipt = await scheduledExecution.wait(1)
    expect(hasEvent(receipt, 'ExecutionRequested')).toBe(true)
    const remainingExecutionsFinal = await this.schedulerSDK.remainingExecutions(BigNumber.from(planId))
    expect(remainingExecutionsFinal - remainingExecutionsInitial).toBe(0)
  })

  test('should get scheduled transaction state', async () => {
    const planId = 1
    await this.schedulerSDK.purchasePlan(planId, 1)

    const encodedMethodCall = this.encodedTxSamples.successful
    const gas = await this.schedulerSDK.estimateGas(ERC677Data.abi, this.contracts.tokenAddress, 'balanceOf', [this.consumerAddress])
    const timestamp = dayjs().add(1, 'day').toDate()
    const valueToTransfer = BigNumber.from(1)

    const execution = executionFactory(planId, this.contracts.tokenAddress, encodedMethodCall, gas!, timestamp, valueToTransfer, this.consumerAddress)
    const scheduleExecution = await this.schedulerSDK.schedule(execution)

    const state = await this.schedulerSDK.getExecutionState(execution)

    expect(scheduleExecution).toBeDefined()
    expect(state).toBe(ExecutionState.Scheduled)
  })

  test('should get scheduled multiple transactions', async () => {
    const planId = 1
    const cronExpression = '*/15 * * * *'
    const quantity = 5
    await this.schedulerSDK.purchasePlan(planId, quantity)

    const encodedMethodCall = this.encodedTxSamples.successful
    const gas = await this.schedulerSDK.estimateGas(ERC677Data.abi, this.contracts.tokenAddress, 'balanceOf', [this.consumerAddress])
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

    expect(count).toBeGreaterThan(0)
    expect(count).toBe(this.plans.length)
  })

  test('should be able to cancel a scheduled tx', async () => {
    const planId = 1
    await this.schedulerSDK.purchasePlan(planId, 1)

    const encodedMethodCall = this.encodedTxSamples.successful
    const gas = await this.schedulerSDK.estimateGas(ERC677Data.abi, this.contracts.tokenAddress, 'balanceOf', [this.consumerAddress])
    const timestamp = dayjs().add(1, 'day').toDate()
    const valueToTransfer = BigNumber.from(1)

    const execution = executionFactory(planId, this.contracts.tokenAddress, encodedMethodCall, gas!, timestamp, valueToTransfer, this.consumerAddress)
    const scheduledExecution = await this.schedulerSDK.schedule(execution)
    await scheduledExecution.wait(1)

    const initialState = await this.schedulerSDK.getExecutionState(execution)

    await this.schedulerSDK.cancelScheduling(execution)

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

    await expect(this.schedulerSDK.cancelScheduling(execution))
      .rejects
      .toThrow('VM Exception while processing transaction: revert Transaction not scheduled')
  })
})
