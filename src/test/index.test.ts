import Scheduler from '..'
import { BigNumber, ethers } from 'ethers'
import { Plan } from '../types'
import { getUsers, contractsSetUp, plans } from './setup'
import ERC677Data from '../contracts/ERC677.json'

/// this tests give an log message: Duplicate definition of Transfer (Transfer(address,address,uint256,bytes), Transfer(address,address,uint256))
/// don't worry: https://github.com/ethers-io/ethers.js/issues/905

jest.setTimeout(27000)

function equalPlans (p1:Plan, p2:Plan):boolean {
  return (
    p1.active === p2.active &&
    p1.pricePerExecution.toString() === p2.pricePerExecution.toString() &&
    p1.token === p2.token &&
    p1.window.toString() === p2.window.toString()
  )
}

describe('RifScheduler', function (this: {
    schedulerSDK: Scheduler,
    contracts: {
      schedulerAddress: string;
      tokenAddress: string;
    }
  }) {
  beforeEach(async () => {
    const users = await getUsers()
    this.contracts = await contractsSetUp()

    this.schedulerSDK = await Scheduler.create(ethers, this.contracts.schedulerAddress, users.serviceConsumer)
  })

  test('should return plan info', async () => {
    const selectedPlan = { ...plans[0] }

    selectedPlan.token = this.contracts.tokenAddress

    const plan = await this.schedulerSDK.getPlan(0)

    expect(equalPlans(plan, selectedPlan)).toBe(true)
  })
  test('purchase plan ERC20', async () => {
    const selectedPlan = { ...plans[0] }

    selectedPlan.token = this.contracts.tokenAddress

    await this.schedulerSDK
      .approveToken(
        selectedPlan.token,
        BigNumber.from(selectedPlan.pricePerExecution)
      )

    const purchaseResult = await this.schedulerSDK.purchasePlan(0, 1)

    expect(purchaseResult).toBeDefined()
  })

  test('should be able to estimateGas for a valid tx', async () => {
    const users = await getUsers()
    const consumerAddress = await users.serviceConsumer.getAddress()

    const gasResult = await this.schedulerSDK
      .estimateGas(ERC677Data.abi, this.contracts.tokenAddress, 'balanceOf', [consumerAddress])

    expect(gasResult).toBeDefined()
    expect(gasResult?.gte(BigNumber.from(0))).toBe(true)
  })

  test('should not estimateGas for invalid method', async () => {
    const users = await getUsers()
    const consumerAddress = await users.serviceConsumer.getAddress()

    const gasResult = await this.schedulerSDK
      .estimateGas(ERC677Data.abi, this.contracts.tokenAddress, 'method-no-exist', [consumerAddress])

    expect(gasResult).not.toBeDefined()
  })

  test('should not estimateGas for invalid parameter', async () => {
    const consumerAddress = 'not-address'

    const gasResult = await this.schedulerSDK
      .estimateGas(ERC677Data.abi, this.contracts.tokenAddress, 'balanceOf', [consumerAddress])

    expect(gasResult).not.toBeDefined()
  })
})
