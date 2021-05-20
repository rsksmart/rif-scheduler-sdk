import RifScheduler from '../RifScheduler'
import { BigNumber } from 'ethers'
import { ExecutionState, IPlan } from '../types'
import { getUsers, contractsSetUp, plansSetup, encodedCallSamples } from './setup'
import ERC677Data from '../contracts/ERC677.json'
import dayjs from 'dayjs'
import * as cronParser from 'cron-parser'
import executionFactory from '../executionFactory'

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

    expect(purchaseResult).toBeDefined()
  })

  test('purchase plan ERC667', async () => {
    const selectedPlan = this.plans[1]
    selectedPlan.token = this.contracts.tokenAddress677
    const purchaseResult = await this.schedulerSDK.purchasePlan(1, 1)

    expect(purchaseResult).toBeDefined()
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
    await this.schedulerSDK.purchasePlan(planId, 1)

    const encodedMethodCall = this.encodedTxSamples.successful
    const gas = await this.schedulerSDK.estimateGas(ERC677Data.abi, this.contracts.tokenAddress, 'balanceOf', [this.consumerAddress])
    const timestamp = dayjs().add(1, 'day').toDate()
    const valueToTransfer = BigNumber.from(1)

    const execution = executionFactory(planId, this.contracts.tokenAddress, encodedMethodCall, gas!, timestamp, valueToTransfer, this.consumerAddress)
    const scheduledExecution = await this.schedulerSDK.schedule(execution)

    expect(scheduledExecution).toBeDefined()
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
    const scheduleExecutions = await Promise.all(await this.schedulerSDK.scheduleMany(execution, cronExpression, quantity))

    expect(scheduleExecutions).toBeDefined()
    expect(scheduleExecutions.length).toBe(quantity)
  })
})
