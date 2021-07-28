import dayjs from 'dayjs'
import { BigNumber } from 'ethers'
import { Execution, EExecutionState, RIFScheduler } from '../src'
import { Plan } from '../src/model/Plan'
import { timeLatest } from '../test/timeLatest'
import { getUsers, contractsSetUp, plansSetup, encodedCallSamples } from './setup'
import { time } from '@openzeppelin/test-helpers'

jest.setTimeout(27000)

describe('Execution', function (this: {
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

  test('should be able to get the execution id (off-chain)', async () => {
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

    expect(execution.getId()).toBeDefined()
    expect(execution.getId()).not.toBe('')
  })

  test('should be able to encode the execution (off-chain)', async () => {
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

    expect(execution.encode()).toBeDefined()
    expect(execution.encode()).not.toBe('')
  })

  test('should be able to estimate the gas for the execution', async () => {
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

    const gas = await execution.estimateGas(this.rifScheduler.provider)

    expect(gas).not.toBeNull()

    expect(gas!.gt(0)).toBeTruthy()
  })

  test('should not estimateGas for invalid method/parameter', async () => {
    const plan = await this.rifScheduler.getPlan(1)
    const encodedMethodCall = this.encodedTxSamples.failing
    const timestamp = dayjs(await timeLatest()).add(1, 'day').toDate()
    const valueToTransfer = BigNumber.from(1)

    const execution = new Execution(
      this.rifScheduler.config,
      plan,
      this.contracts.tokenAddress,
      encodedMethodCall,
      timestamp,
      valueToTransfer,
      this.consumerAddress
    )

    const gasResult = await execution.estimateGas(this.rifScheduler.provider)

    expect(gasResult).toBeNull()
  })

  test('should generate executions from cron expression (off-chain)', async () => {
    const encodedMethodCall = this.encodedTxSamples.successful
    const startTimestamp = dayjs(await timeLatest()).add(1, 'day').toDate()
    const valueToTransfer = BigNumber.from(1)
    const plan = await this.rifScheduler.getPlan(1)
    const cronExpression = '0 0 */1 * *'
    const quantity = 7

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

    expect(executionsToSchedule.length).toBe(quantity)

    for (const execution of executionsToSchedule) {
      expect(execution.getId()).toBeDefined()
      expect(execution.executeAt >= startTimestamp).toBeTruthy()
    }
  })

  test('should be able to cancel a scheduled execution', async () => {
    const plan = await this.rifScheduler.getPlan(1)
    const purchaseTx = await plan.purchase(1)
    purchaseTx.wait()
    const encodedMethodCall = this.encodedTxSamples.successful
    const timestamp = dayjs(await timeLatest()).add(1, 'day').toDate()
    const valueToTransfer = BigNumber.from(1)

    const execution = new Execution(
      this.rifScheduler.config,
      plan,
      this.contracts.tokenAddress,
      encodedMethodCall,
      timestamp,
      valueToTransfer,
      this.consumerAddress
    )

    const scheduleTx = await this.rifScheduler.schedule(execution)
    await scheduleTx.wait()

    const initialState = await execution.getState()

    const cancelTx = await execution.cancel()
    await cancelTx.wait()

    const stateAfterCancel = await execution.getState()

    expect(initialState).toBe(EExecutionState.Scheduled)
    expect(stateAfterCancel).toBe(EExecutionState.Cancelled)
  })

  test('should be able to refund an overdue scheduled execution', async () => {
    const EXTRA_MINUTES = 15
    const plan = await this.rifScheduler.getPlan(1)
    const purchaseTx = await plan.purchase(1)
    purchaseTx.wait()
    const encodedMethodCall = this.encodedTxSamples.successful

    const timestamp = dayjs(await timeLatest()).add(EXTRA_MINUTES, 'minutes').toDate()
    const valueToTransfer = BigNumber.from(1)

    const execution = new Execution(
      this.rifScheduler.config,
      plan,
      this.contracts.tokenAddress,
      encodedMethodCall,
      timestamp,
      valueToTransfer,
      this.consumerAddress
    )
    const scheduleTx = await this.rifScheduler.schedule(execution)
    await scheduleTx.wait()

    await time.increaseTo(dayjs(timestamp).add(2, 'days').unix())
    await time.advanceBlock()

    const initialState = await execution.getState()

    const refundTx = await execution.refund()
    await refundTx.wait()

    const stateAfterCancel = await execution.getState()

    expect(initialState).toBe(EExecutionState.Overdue)
    expect(stateAfterCancel).toBe(EExecutionState.Refunded)
  })

  test('refund should fail with a not scheduled execution', async () => {
    const plan = await this.rifScheduler.getPlan(1)
    const purchaseTx = await plan.purchase(1)
    purchaseTx.wait()
    const encodedMethodCall = this.encodedTxSamples.successful

    const timestamp = dayjs(await timeLatest()).add(1, 'day').toDate()
    const valueToTransfer = BigNumber.from(1)

    const execution = new Execution(
      this.rifScheduler.config,
      plan,
      this.contracts.tokenAddress,
      encodedMethodCall,
      timestamp,
      valueToTransfer,
      this.consumerAddress
    )
    const scheduleTx = await this.rifScheduler.schedule(execution)
    await scheduleTx.wait()

    await expect(execution.refund())
      .rejects
      .toThrow('VM Exception while processing transaction: revert Not overdue')
  })

  test('cancel should fail with a not scheduled execution', async () => {
    const plan = await this.rifScheduler.getPlan(1)
    const purchaseTx = await plan.purchase(1)
    purchaseTx.wait()

    const encodedMethodCall = this.encodedTxSamples.successful
    const timestamp = dayjs(await timeLatest()).add(1, 'day').toDate()
    const valueToTransfer = BigNumber.from(1)

    const execution = new Execution(
      this.rifScheduler.config,
      plan,
      this.contracts.tokenAddress,
      encodedMethodCall,
      timestamp,
      valueToTransfer,
      this.consumerAddress
    )

    await expect(execution.cancel())
      .rejects
      .toThrow('VM Exception while processing transaction: revert Not scheduled')
  })
})
