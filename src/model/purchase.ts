import { BigNumber, BigNumberish, Contract, ContractTransaction, utils } from 'ethers'
import { Base } from './Base'
import { Plan } from './Plan'
import { Token, TokenType } from './token'

export abstract class PurchaseStrategy extends Base {
  abstract purchase(token: Token, plan: Plan, quantity: BigNumberish): Promise<ContractTransaction>
}

export class PurchaseWithERC20 extends PurchaseStrategy {
  public async purchase (token: Token, plan: Plan, quantity: BigNumberish): Promise<ContractTransaction> {
    const signerAddress = await this.signer!.getAddress()
    const purchaseCost = BigNumber.from(plan.pricePerExecution).mul(quantity)

    const balance = await token.balanceOf(signerAddress)
    if (balance.lt(purchaseCost)) throw new Error('Not enough balance')

    const allowance = await token.allowance(signerAddress, this.schedulerContract.address)
    const hasAllowance = allowance.lt(purchaseCost)
    if (hasAllowance) throw new Error(`The account ${signerAddress} has not enough allowance`)

    return this.schedulerContract.purchase(plan.index, quantity)
  }
}

export class PurchaseWithERC677 extends PurchaseStrategy {
  public async purchase (token: Token, plan: Plan, quantity: BigNumberish): Promise<ContractTransaction> {
    const signerAddress = await this.signer!.getAddress()
    const purchaseCost = BigNumber.from(plan.pricePerExecution).mul(quantity)

    const balance = await token.balanceOf(signerAddress)
    if (balance.lt(purchaseCost)) throw new Error('Not enough balance')

    const encoder = new utils.AbiCoder()
    const encodedData = encoder.encode(['uint256', 'uint256'], [plan.index.toString(), quantity.toString()])
    const transferAndCallToken = new Contract(token.address, [
      'function transferAndCall(address to, uint amount, bytes data)'
    ], this.signer!)
    return transferAndCallToken.transferAndCall(this.schedulerContract.address, purchaseCost, encodedData)
  }
}

export class PurchaseWithRBTC extends PurchaseStrategy {
  public async purchase (token: Token, plan: Plan, quantity: BigNumberish): Promise<ContractTransaction> {
    const purchaseCost = BigNumber.from(plan.pricePerExecution).mul(quantity)

    const balance = await this.signer!.getBalance()
    if (balance.lt(purchaseCost)) throw new Error('Not enough balance')
    return await this.schedulerContract.purchase(plan.index, quantity, { value: BigNumber.from(purchaseCost) })
  }
}

export const purchaseStrategies = {
  [TokenType.ERC20]: PurchaseWithERC20,
  [TokenType.ERC677]: PurchaseWithERC677,
  [TokenType.RBTC]: PurchaseWithRBTC
}
