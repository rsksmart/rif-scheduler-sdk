import { BigNumber, BigNumberish, constants, ContractTransaction } from 'ethers'
import { insensitiveIsEqualTo } from '../../scripts'
import { Base, Config } from '../Base'
// eslint-disable-next-line camelcase
import { ERC20, ERC20__factory } from './types'

export enum TokenType {
    ERC20,
    ERC677,
    RBTC
}

class Token extends Base {
  private tokenContract: ERC20

  constructor (config: Config, public address: string) {
    super(config)

    this.tokenContract = ERC20__factory.connect(address, this.currentProviderOrSigner)
  }

  public getType (): TokenType {
    if (this.address === constants.AddressZero) {
      return TokenType.RBTC
    }

    if (this.supportedERC677Tokens.find(insensitiveIsEqualTo(this.address))) {
      return TokenType.ERC677
    }

    // defaults to ERC20
    return TokenType.ERC20
  }

  public async approve (amount: BigNumberish): Promise<ContractTransaction> {
    if (this.getType() !== TokenType.ERC20) {
      throw new Error("This token doesn't requires approval")
    }

    return this.tokenContract.approve(this.schedulerContract.address, amount)
  }

  public async needsApproval (amount: BigNumberish): Promise<boolean> {
    if (this.getType() !== TokenType.ERC20) {
      return false
    }

    const signerAddress = await this.signer!.getAddress()
    const allowance = await this.tokenContract.allowance(signerAddress, this.schedulerContract.address)

    const hasEnoughAllowance = allowance.lt(amount)

    return !hasEnoughAllowance
  }

  public async decimals (): Promise<number> {
    return this.tokenContract.decimals()
  }

  public async symbol (): Promise<string> {
    return this.tokenContract.symbol()
  }

  public async balanceOf (address: string): Promise<BigNumber> {
    return this.tokenContract.balanceOf(address)
  }

  public async allowance (ownerAddress: string, expenderAddress: string): Promise<BigNumber> {
    return this.tokenContract.allowance(ownerAddress, expenderAddress)
  }
}

export { Token }
