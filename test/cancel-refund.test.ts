import { BigNumber } from 'ethers'
import { RIFScheduler, executionFactory, ExecutionState, IPlanResponse } from '../src'
import { getUsers, contractsSetUp, plansSetup, encodedCallSamples } from './setup'
import dayjs from 'dayjs'
import { time } from '@openzeppelin/test-helpers'
import { timeLatest } from './timeLatest'

/// this tests give a log message: Duplicate definition of Transfer (Transfer(address,address,uint256,bytes), Transfer(address,address,uint256))
/// don't worry: https://github.com/ethers-io/ethers.js/issues/905

jest.setTimeout(27000)

describe('SDK - cancel/refund', function (this: {
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

  test('should be able to cancel a scheduled execution', async () => {
    const planId = 1
    const purchaseTx = await this.schedulerSDK.purchasePlan(planId, 1)
    purchaseTx.wait()
    const encodedMethodCall = this.encodedTxSamples.successful
    // TODO: review this code
    // const gas = await this.schedulerSDK.estimateGas(this.contracts.tokenAddress, encodedMethodCall)
    const timestamp = dayjs(await timeLatest()).add(1, 'day').toDate()
    const valueToTransfer = BigNumber.from(1)

    const execution = executionFactory(planId, this.contracts.tokenAddress, encodedMethodCall, timestamp, valueToTransfer, this.consumerAddress)
    const scheduledExecution = await this.schedulerSDK.schedule(execution)
    await scheduledExecution.wait()

    const initialState = await this.schedulerSDK.getExecutionState(execution)

    await this.schedulerSDK.cancelExecution(execution)

    const stateAfterCancel = await this.schedulerSDK.getExecutionState(execution)

    expect(initialState).toBe(ExecutionState.Scheduled)
    expect(stateAfterCancel).toBe(ExecutionState.Cancelled)
  })

  test('should be able to refund an overdue scheduled execution', async () => {
    const EXTRA_MINUTES = 15
    const planId = 1
    const purchaseTx = await this.schedulerSDK.purchasePlan(planId, 1)
    purchaseTx.wait()
    const encodedMethodCall = this.encodedTxSamples.successful

    // TODO: review this code
    // const gas = await this.schedulerSDK.estimateGas(this.contracts.tokenAddress, encodedMethodCall)
    const timestamp = dayjs(await timeLatest()).add(EXTRA_MINUTES, 'minutes').toDate()
    const valueToTransfer = BigNumber.from(1)

    const execution = executionFactory(planId, this.contracts.tokenAddress, encodedMethodCall, timestamp, valueToTransfer, this.consumerAddress)
    const scheduledExecution = await this.schedulerSDK.schedule(execution)
    await scheduledExecution.wait()

    await time.increaseTo(dayjs(timestamp).add(2, 'days').unix())
    await time.advanceBlock()

    const initialState = await this.schedulerSDK.getExecutionState(execution)

    await this.schedulerSDK.requestExecutionRefund(execution)

    const stateAfterCancel = await this.schedulerSDK.getExecutionState(execution)

    expect(initialState).toBe(ExecutionState.Overdue)
    expect(stateAfterCancel).toBe(ExecutionState.Refunded)
  })

  test('refund should fail with a not scheduled execution', async () => {
    const planId = 1
    const purchaseTx = await this.schedulerSDK.purchasePlan(planId, 1)
    purchaseTx.wait()
    const encodedMethodCall = this.encodedTxSamples.successful

    // TODO: review this code
    // const gas = await this.schedulerSDK.estimateGas(this.contracts.tokenAddress, encodedMethodCall)
    const timestamp = dayjs(await timeLatest()).add(1, 'day').toDate()
    const valueToTransfer = BigNumber.from(1)

    const execution = executionFactory(planId, this.contracts.tokenAddress, encodedMethodCall, timestamp, valueToTransfer, this.consumerAddress)
    const scheduledExecution = await this.schedulerSDK.schedule(execution)
    await scheduledExecution.wait()

    await expect(this.schedulerSDK.requestExecutionRefund(execution))
      .rejects
      .toThrow('VM Exception while processing transaction: revert Not overdue')
  })

  test('cancel should fail with a not scheduled execution', async () => {
    const planId = 1

    const encodedMethodCall = this.encodedTxSamples.successful
    const timestamp = dayjs(await timeLatest()).add(1, 'day').toDate()
    const valueToTransfer = BigNumber.from(1)

    const execution = executionFactory(planId, this.contracts.tokenAddress, encodedMethodCall, timestamp, valueToTransfer, this.consumerAddress)

    await expect(this.schedulerSDK.cancelExecution(execution))
      .rejects
      .toThrow('VM Exception while processing transaction: revert Not scheduled')
  })
})
