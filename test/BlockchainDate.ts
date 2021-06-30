import { providers } from 'ethers'

/**
 * This module gets the timestamp of the current block.
 */
export class BlockchainDate {
  static async now (provider: providers.Provider): Promise<Date> {
    const blockNumber = await provider.getBlockNumber()

    const { timestamp } = await provider.getBlock(blockNumber)

    return new Date(+timestamp * 1000)
  }
}
