import { providers } from 'ethers'
import { RIFScheduler, IPlanResponse } from '../src'
import { getUsers, contractsSetUp, plansSetup, encodedCallSamples } from './setup'
// eslint-disable-next-line camelcase
import { ERC20__factory } from './contracts/types/factories/ERC20__factory'
import hasEvent from './hasEvent'

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

describe('SDK - Plans', function (this: {
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

  test('should return plan info', async () => {
    const plan = await this.schedulerSDK.getPlan(0)
    expect(equalPlans(plan, this.plans[0])).toBe(true)
  })

  test('purchase plan ERC20', async () => {
    const selectedPlan = this.plans[0]
    const approveTx = await this.schedulerSDK
      .approveToken(
        selectedPlan.token,
        selectedPlan.pricePerExecution
      )
    await approveTx.wait()
    const purchaseResult = await this.schedulerSDK.purchasePlan(0, 1)
    const receipt = await purchaseResult.wait()
    expect(hasEvent(receipt, 'ExecutionPurchased')).toBe(true)
    const remainingExecutions = await this.schedulerSDK.remainingExecutions(0)
    expect(remainingExecutions.eq(1)).toBeTruthy()
  })

  test('cannot purchase plan ERC20 without enough tokens', async () => {
    const selectedPlan = this.plans[0]

    const approveTx = await this.schedulerSDK
      .approveToken(
        selectedPlan.token,
        selectedPlan.pricePerExecution
      )
    await approveTx.wait()
    const token = await ERC20__factory.connect(this.contracts.tokenAddress, this.schedulerSDK.signer!)
    const transferTx = await token.transfer(await new providers.JsonRpcProvider().getSigner(7).getAddress(), await token.balanceOf(this.consumerAddress))
    await transferTx.wait()
    expect(
      () => this.schedulerSDK.purchasePlan(0, 1)
    ).rejects.toThrow()
  })

  test('cannot purchase plan ERC20 without enough approval', async () => {
    const selectedPlan = this.plans[0]

    const token = await ERC20__factory.connect(this.contracts.tokenAddress, this.schedulerSDK.signer!)
    const approveTx = await token.approve(this.schedulerSDK.schedulerContract!.address, selectedPlan.pricePerExecution.sub('1'))
    await approveTx.wait()
    expect(
      () => this.schedulerSDK.purchasePlan(0, 1)
    ).rejects.toThrow()
  })

  test('purchase plan ERC667', async () => {
    const selectedPlan = this.plans[1]
    selectedPlan.token = this.contracts.tokenAddress677
    const purchaseTx = await this.schedulerSDK.purchasePlan(1, 1)
    await purchaseTx.wait()
    const remainingExecutions = await this.schedulerSDK.remainingExecutions(1)
    expect(remainingExecutions.eq(1)).toBeTruthy()
  })

  test('purchase plan rBTC', async () => {
    const purchaseTx = await this.schedulerSDK.purchasePlan(2, 1)
    await purchaseTx.wait()
    const remainingExecutions = await this.schedulerSDK.remainingExecutions(2)
    expect(remainingExecutions.eq(1)).toBeTruthy()
  })

  test('cannot purchase plan rBTC without balance', async () => {
    // this test needs different accounts, thus test run simultaneously
    // and the testing account should never go to balance 0
    const provider = new providers.JsonRpcProvider()
    const other = provider.getSigner(7)
    const consumer = provider.getSigner(8)

    const schedulerSDK = new RIFScheduler(this.contracts.schedulerAddress, consumer, { supportedER677Tokens: [this.contracts.tokenAddress677] })

    const tx = await consumer.sendTransaction({ to: await other.getAddress(), value: (await provider.getBalance(await consumer.getAddress())), gasPrice: 0 })
    await tx.wait()
    expect(
      () => schedulerSDK.purchasePlan(2, 1)
    ).rejects.toThrow()

    await other.sendTransaction({ to: await consumer.getAddress(), value: (await provider.getBalance(await other.getAddress())), gasPrice: 0 })
  })

  test('should return the plans count', async () => {
    const count = await this.schedulerSDK
      .getPlansCount()

    expect(count.gt(0)).toBeTruthy()
    expect(count.eq(this.plans.length)).toBeTruthy()
  })
})
