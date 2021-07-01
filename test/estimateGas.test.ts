import { BigNumber } from 'ethers'
import { RIFScheduler, IPlanResponse } from '../src'
import { getUsers, contractsSetUp, plansSetup, encodedCallSamples } from './setup'

/// this tests give a log message: Duplicate definition of Transfer (Transfer(address,address,uint256,bytes), Transfer(address,address,uint256))
/// don't worry: https://github.com/ethers-io/ethers.js/issues/905

jest.setTimeout(27000)

describe('SDK - utils', function (this: {
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

  test('should be able to estimateGas for a valid tx', async () => {
    const encodedMethodCall = this.encodedTxSamples.successful

    const gasResult = await this.schedulerSDK
      .estimateGas(this.contracts.tokenAddress, encodedMethodCall)

    expect(gasResult).toBeDefined()
    expect(gasResult?.gte(BigNumber.from(0))).toBe(true)
  })

  test('should not estimateGas for invalid method/parameter', async () => {
    const encodedMethodCall = this.encodedTxSamples.failing

    const gasResult = await this.schedulerSDK
      .estimateGas(this.contracts.tokenAddress, encodedMethodCall)

    expect(gasResult).not.toBeDefined()
  })
})
