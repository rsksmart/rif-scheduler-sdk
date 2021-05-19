import Scheduler from '../src'
import { ethers, Signer } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Plan } from '../src/types'
import { OneShotSchedule } from '../typechain/OneShotSchedule'
import { getUsers, contractsSetUp, plans } from './setup'

/// this tests give an log message: Duplicate definition of Transfer (Transfer(address,address,uint256,bytes), Transfer(address,address,uint256))
/// don't worry: https://github.com/ethers-io/ethers.js/issues/905

function equalPlans (p1:Plan, p2:Plan):boolean {
  return (
    p1.active === p2.active &&
    p1.pricePerExecution.toString() === p2.pricePerExecution.toString() &&
    p1.token === p2.token &&
    p1.window.toString() === p2.window.toString()
  )
}

describe('RifScheduler', function (this: {
    ethers: any
    provider: JsonRpcProvider
    signer: Signer
    schedulerSDK: OneShotSchedule
    testCoinAddr: (coinType: number, addr: string) => Promise<void>
  }) {
  test('should return plan info', async () => {
    const users = await getUsers()
    const contracts = await contractsSetUp()
    plans[0].token = contracts.tokenAddress

    const schedulerSDK = await Scheduler.create(ethers, contracts.schedulerAddress, users.serviceConsumer)
    const plan = await schedulerSDK.getPlan(0)

    expect(equalPlans(plan, plans[0])).toBe(true)
  })
  test('purchase plan ERC20', async () => {
    const users = await getUsers()
    const contracts = await contractsSetUp()
    plans[0].token = contracts.tokenAddress

    const schedulerSDK = await Scheduler.create(ethers, contracts.schedulerAddress, users.serviceConsumer)
    const purchasePlan = await schedulerSDK.purchasePlan(0, 1)
    console.log(purchasePlan)
  })
})
