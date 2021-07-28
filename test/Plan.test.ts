import { RIFScheduler } from '../src'
import { Plan } from '../src/model/Plan'
import { hasEvent } from '../test/utils'
import { getUsers, contractsSetUp, plansSetup, encodedCallSamples } from './setup'
// eslint-disable-next-line camelcase
import { ERC20__factory } from './contracts/types/factories/ERC20__factory'
import { constants, providers } from 'ethers'

jest.setTimeout(27000)

describe('Plan', function (this: {
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

  test('should be able to get the plan status', async () => {
    const plan = await this.rifScheduler.getPlan(0)

    const isActive = await plan.isActive()

    expect(isActive).toBe(true)
  })

  test('purchase plan ERC20', async () => {
    const plan = await this.rifScheduler.getPlan(0)

    const approveTx = await plan.token.approve(plan.pricePerExecution)
    await approveTx.wait()

    const purchaseResult = await plan.purchase(1)
    const receipt = await purchaseResult.wait()

    const remainingExecutions = await plan.getRemainingExecutions()

    expect(hasEvent(receipt, 'ExecutionPurchased')).toBe(true)
    expect(remainingExecutions.eq(1)).toBeTruthy()
  })

  test('cannot purchase plan ERC20 without enough tokens', async () => {
    const plan = await this.rifScheduler.getPlan(0)

    const approveTx = await plan.token.approve(plan.pricePerExecution)
    await approveTx.wait()

    const token = ERC20__factory.connect(this.contracts.tokenAddress, this.rifScheduler.signer!)

    const accountAddressWithoutFunds = await new providers.JsonRpcProvider().getSigner(7).getAddress()

    const transferTx = await token.transfer(accountAddressWithoutFunds, await token.balanceOf(this.consumerAddress))
    await transferTx.wait()
    expect(
      () => plan.purchase(1)
    ).rejects.toThrow()
  })

  test('cannot purchase plan ERC20 without enough approval', async () => {
    const plan = await this.rifScheduler.getPlan(0)

    const token = ERC20__factory.connect(this.contracts.tokenAddress, this.rifScheduler.signer!)
    const approveTx = await token.approve(
      this.rifScheduler.schedulerContract!.address,
      plan.pricePerExecution.sub(1)
    )
    await approveTx.wait()

    expect(
      () => plan.purchase(1)
    ).rejects.toThrow()
  })

  test('purchase plan ERC667', async () => {
    const plan = await this.rifScheduler.getPlan(1)

    const purchaseTx = await plan.purchase(1)
    await purchaseTx.wait()

    const remainingExecutions = await plan.getRemainingExecutions()

    expect(plan.token.address).toBe(this.contracts.tokenAddress677)
    expect(remainingExecutions.eq(1)).toBeTruthy()
  })

  test('purchase plan rBTC', async () => {
    const plan = await this.rifScheduler.getPlan(2)

    const purchaseTx = await plan.purchase(1)
    await purchaseTx.wait()

    const remainingExecutions = await plan.getRemainingExecutions()

    expect(plan.token.address).toBe(constants.AddressZero)
    expect(remainingExecutions.eq(1)).toBeTruthy()
  })

  test('cannot purchase plan rBTC without balance', async () => {
    // this test needs different accounts, thus test run simultaneously
    // and the testing account should never go to balance 0
    const provider = new providers.JsonRpcProvider()
    const other = provider.getSigner(7)
    const consumer = provider.getSigner(8)

    const rifScheduler = new RIFScheduler({
      contractAddress: this.contracts.schedulerAddress,
      providerOrSigner: consumer,
      supportedERC677Tokens: [this.contracts.tokenAddress677]
    })

    const tx = await consumer.sendTransaction({
      to: await other.getAddress(),
      value: (await provider.getBalance(await consumer.getAddress())),
      gasPrice: 0
    })
    await tx.wait()

    const plan = await rifScheduler.getPlan(2)

    await expect(
      () => plan.purchase(1)
    ).rejects.toThrow()

    await other.sendTransaction({
      to: await consumer.getAddress(),
      value: (await provider.getBalance(await other.getAddress())),
      gasPrice: 0
    })
  })

  test('should be able to get the plan remaining executions', async () => {
    const quantity = 4

    const plan = await this.rifScheduler.getPlan(1)

    const purchaseTx = await plan.purchase(quantity)
    await purchaseTx.wait()

    const remainingExecutions = await plan.getRemainingExecutions()

    expect(remainingExecutions.eq(quantity)).toBeTruthy()
  })
})
