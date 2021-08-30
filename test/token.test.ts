import { RIFScheduler, Token } from '../src'
import { Plan } from '../src/Plan'
import { getUsers, contractsSetUp, plansSetup, encodedCallSamples } from './setup'
// eslint-disable-next-line camelcase
import { constants } from 'ethers'

jest.setTimeout(27000)

describe('Token', function (this: {
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

  test('should get decimals with RBTC', async () => {
    const token = new Token(this.rifScheduler.config, constants.AddressZero)

    const decimals = await token.decimals()

    expect(decimals).toBeGreaterThan(0)
  })

  test('should get symbol with RBTC', async () => {
    const token = new Token(this.rifScheduler.config, constants.AddressZero)

    const symbol = await token.symbol()

    expect(symbol).toBe('RBTC')
  })

  test('should get the balance with RBTC', async () => {
    const token = new Token(this.rifScheduler.config, constants.AddressZero)

    const balance = await token.balanceOf(this.consumerAddress)

    expect(balance.gt(0)).toBeTruthy()
  })

  test('should get the allowance with RBTC', async () => {
    const token = new Token(this.rifScheduler.config, constants.AddressZero)

    expect(async () => {
      await token.allowance(this.consumerAddress, this.contracts.schedulerAddress)
    }).rejects.toThrow("This token doesn't allowance")
  })
})
