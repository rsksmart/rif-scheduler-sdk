import dayjs from 'dayjs'
import { BigNumber, providers } from 'ethers'
import { Execution, EExecutionState, RIFScheduler } from '../src'
import { Plan } from '../src/Plan'
import { timeLatest } from '../test/timeLatest'
import { getUsers, contractsSetUp, plansSetup, encodedCallSamples } from './setup'
import { equalPlans } from './utils'

jest.setTimeout(27000)

describe('RIFScheduler', function (this: {
    rifScheduler: RIFScheduler,
    contracts: {
      schedulerAddress: string;
      tokenAddress: string;
      tokenAddress677: string;
    },
    plans: Plan[],
    encodedTxSamples: { successful: string, failing: string },
    consumerAddress: string
  }) {
  beforeEach(async () => {
    const users = await getUsers()
    this.contracts = await contractsSetUp()
    this.rifScheduler = new RIFScheduler({
      contractAddress: this.contracts.schedulerAddress,
      providerOrSigner: users.serviceConsumer,
      supportedERC677Tokens: [this.contracts.tokenAddress677]
    })
    this.plans = await plansSetup(this.contracts.schedulerAddress, this.contracts.tokenAddress, this.contracts.tokenAddress677)
    this.encodedTxSamples = await encodedCallSamples()
    this.consumerAddress = await users.serviceConsumer.getAddress()
  })

  test('should allow to setup without provider', () => {
    const otherInstance = new RIFScheduler({
      contractAddress: this.contracts.schedulerAddress,
      providerOrSigner: undefined
    })
    expect(otherInstance.provider).toBeDefined()
  })

  test('should allow provider with no signer', () => {
    const otherInstance = new RIFScheduler({
      contractAddress: this.contracts.schedulerAddress,
      providerOrSigner: new providers.JsonRpcProvider()
    })
    expect(otherInstance.provider).toBeDefined()
  })

  test('should return a plan 0', async () => {
    const plan = await this.rifScheduler.getPlan(0)
    expect(equalPlans(plan, this.plans[0])).toBeTruthy()
  })

  test('should return plans count', async () => {
    const plansCount = await this.rifScheduler.getPlansCount()
    expect(plansCount.eq(this.plans.length)).toBeTruthy()
  })

  test('should return all plans', async () => {
    const plans = await this.rifScheduler.getPlans()

    expect(BigNumber.from(plans.length).eq(this.plans.length)).toBeTruthy()

    for (let index = 0; index < this.plans.length; index++) {
      expect(equalPlans(plans[index], this.plans[index])).toBeTruthy()
    }
  })

  test('should be able to schedule an execution', async () => {
    const encodedMethodCall = this.encodedTxSamples.successful
    const timestamp = dayjs(await timeLatest()).add(1, 'day').toDate()
    const valueToTransfer = BigNumber.from(1)
    const plan = await this.rifScheduler.getPlan(1)

    const execution = new Execution(
      this.rifScheduler.config,
      plan,
      this.contracts.tokenAddress,
      encodedMethodCall,
      timestamp,
      valueToTransfer,
      this.consumerAddress
    )

    const initialState = await execution.getState()

    const approveTx = await plan.purchase(1)
    await approveTx.wait()

    const scheduleTx = await this.rifScheduler.schedule(execution)
    await scheduleTx.wait()

    const resultState = await execution.getState()

    expect(initialState).toBe(EExecutionState.NotScheduled)
    expect(resultState).toBe(EExecutionState.Scheduled)
  })

  test('should get scheduled execution by id', async () => {
    const plan = await this.rifScheduler.getPlan(1)
    const quantity = 3

    const purchaseTx = await plan.purchase(quantity)
    await purchaseTx.wait()

    const encodedMethodCall = this.encodedTxSamples.successful
    const today = await timeLatest()
    const startTimestamp = dayjs(new Date(today.getFullYear(), today.getMonth(), today.getDate())).add(1, 'day').toDate()
    const valueToTransfer = BigNumber.from(1)

    const executionToSchedule = new Execution(
      this.rifScheduler.config,
      plan,
      this.contracts.tokenAddress,
      encodedMethodCall,
      startTimestamp,
      valueToTransfer,
      this.consumerAddress
    )

    const scheduleTx = await this.rifScheduler.schedule(executionToSchedule)
    await scheduleTx.wait()

    const scheduledExecution = await this.rifScheduler.getExecution(executionToSchedule.getId())
    const state = await scheduledExecution.getState()

    expect(scheduledExecution.getId()).toBe(executionToSchedule.getId())
    expect(state).toBe(EExecutionState.Scheduled)
  })

  test('should get scheduled executions by requester', async () => {
    const plan = await this.rifScheduler.getPlan(1)
    const cronExpression = '0 0 */1 * *'
    const quantity = 3

    const purchaseTx = await plan.purchase(quantity)
    await purchaseTx.wait()

    const encodedMethodCall = this.encodedTxSamples.successful
    const today = await timeLatest()
    const startTimestamp = dayjs(new Date(today.getFullYear(), today.getMonth(), today.getDate())).add(1, 'day').toDate()
    const valueToTransfer = BigNumber.from(1)

    const execution = new Execution(
      this.rifScheduler.config,
      plan,
      this.contracts.tokenAddress,
      encodedMethodCall,
      startTimestamp,
      valueToTransfer,
      this.consumerAddress
    )

    const executionsToSchedule = Execution.fromCronExpression(execution, cronExpression, quantity)

    const scheduleTx = await this.rifScheduler.scheduleMany(executionsToSchedule)
    await scheduleTx.wait()

    const executionsCount = await this.rifScheduler.getExecutionsCount(this.consumerAddress)
    const pageSize = 2

    let fromIndex = 0
    let toIndex = 0
    let pageNumber = 1
    let hasMore = true
    let result: Execution[] = []
    while (hasMore) {
      fromIndex = (pageNumber - 1) * pageSize
      toIndex = pageNumber * pageSize

      if (executionsCount.lte(toIndex)) {
        hasMore = false
        toIndex = executionsCount.toNumber()
      }

      const scheduledTransactionsPage = await this.rifScheduler
        .getExecutions(this.consumerAddress, fromIndex, toIndex)

      result = result.concat(scheduledTransactionsPage)

      pageNumber++
    }

    expect(executionsCount.eq(quantity)).toBeTruthy()
    expect(result.length).toBe(quantity)

    for (const execution of result) {
      expect(execution.getId()).toBeDefined()
      expect(execution.executeAt >= startTimestamp).toBeTruthy()
    }
  })

  test('should be able to get the minimum time to schedule', async () => {
    const minimumTime = await this.rifScheduler
      .getMinimumTimeBeforeScheduling()

    expect(minimumTime.gt(0)).toBeTruthy()
  })

  test('should fail to schedule multiple executions with no remaining executions', async () => {
    const plan = await this.rifScheduler.getPlan(1)
    const encodedMethodCall = this.encodedTxSamples.successful

    const value = 10000

    const execution = new Execution(
      this.rifScheduler.config,
      plan,
      this.contracts.tokenAddress,
      encodedMethodCall,
      dayjs(await timeLatest()).toDate(),
      value,
      this.consumerAddress
    )

    const executionsToSchedule = Execution.fromCronExpression(execution, '*/15 * * * *', 1)

    expect(async () => {
      await this.rifScheduler.scheduleMany(executionsToSchedule)
    }).rejects.toThrow('VM Exception while processing transaction: revert No balance available')
  })
})
