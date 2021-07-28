import { BigNumber, BigNumberish, ContractTransaction } from 'ethers'
import { Base, Config } from './Base'
import { purchaseStrategies, PurchaseWithERC20 } from './purchase'
import { Token } from './token'

class Plan extends Base {
  public index: BigNumber;
  public window: BigNumber;
  public pricePerExecution: BigNumber;
  public gasLimit: BigNumber;

  constructor (
    public config: Config,
    index: BigNumberish,
    public token: Token,
    window: BigNumberish,
    pricePerExecution: BigNumberish,
    gasLimit: BigNumberish
  ) {
    super(config)

    this.index = BigNumber.from(index)
    this.window = BigNumber.from(window)
    this.pricePerExecution = BigNumber.from(pricePerExecution)
    this.gasLimit = BigNumber.from(gasLimit)
  }

  public async isActive (): Promise<boolean> {
    const plan = await this.schedulerContract.plans(this.index)

    return plan.active
  }

  public async getRemainingExecutions (): Promise<BigNumber> {
    const signerAddress = await this.signer!.getAddress()

    return this.schedulerContract.remainingExecutions(signerAddress, this.index)
  }

  public async purchase (quantity: BigNumberish): Promise<ContractTransaction> {
    const PurchaseStrategy = purchaseStrategies[this.token.getType()] ?? PurchaseWithERC20

    const strategy = new PurchaseStrategy(this.config)

    return strategy.purchase(this.token, this, quantity)
  }
}

export { Plan }
