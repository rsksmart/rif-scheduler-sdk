import Scheduler from '../src'
import { Provider } from '@ethersproject/abstract-provider'
import ethers, { Signer, Wallet } from 'ethers'
import { Plan } from '../src/types'
import { OneShotSchedule } from '../typechain/OneShotSchedule'

const toBN = ethers.BigNumber.from

const Config = {
  contractAddress: '0x0',
  providerUrl: 'http/sss',
  tokens: { RIF: '', DOC: '' }
}

const plans: Plan[] = [
  { pricePerExecution: toBN(15), window: toBN(10000), token: Config.tokens.RIF, active: true },
  { pricePerExecution: toBN(4), window: toBN(300), token: Config.tokens.DOC, active: true }
]

function equalPlans (p1:Plan, p2:Plan):boolean {
  return (
    p1.active === p2.active &&
    p1.pricePerExecution === p2.pricePerExecution &&
    p1.token === p2.token &&
    p1.window === p2.window
  )
}

async function getProvider (): Promise<Provider> {
  return await new ethers.providers.WebSocketProvider(Config.providerUrl)
}

function getSigner ():Signer {
  const mnemonic = 'announce room limb pattern dry unit scale effort smooth jazz weasel alcohol'
  return Wallet.fromMnemonic(mnemonic)
}

describe('RifScheduler', function (this: {
    ethers: any
    provider: Provider
    signer: Signer
    schedulerSDK: OneShotSchedule
    testCoinAddr: (coinType: number, addr: string) => Promise<void>
  }) {
  test('should return plan info', async () => {
    const signer = getSigner()
    await signer.connect(await getProvider())
    const schedulerSDK = await Scheduler.create(ethers, Config.contractAddress, signer)
    const plan = await schedulerSDK.getPlan(0)
    expect(equalPlans(plan, plans[0])).toBe(true)
  })
})
