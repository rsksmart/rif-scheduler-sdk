import { BigNumber, BigNumberish, utils } from 'ethers'
import dayjs from 'dayjs'

class Execution {
  public executeAtBigNumber: BigNumber;

  constructor (
    public planIndex: BigNumberish,
    public contractAddress: string,
    public encodedFunction: utils.BytesLike,
    public executeAt: Date,
    public value: BigNumberish,
    public requestor: string
  ) {
    this.executeAtBigNumber = BigNumber.from(dayjs(executeAt).unix())
  }

  public getId () {
    const encoder = new utils.AbiCoder()
    const paramTypes = ['address', 'uint256', 'address', 'bytes', 'uint256', 'uint256']
    const paramValues = [
      this.requestor,
      this.planIndex.toString(),
      this.contractAddress,
      this.encodedFunction,
      this.executeAtBigNumber.toString(),
      this.value.toString()
    ]
    const encodedData = encoder.encode(paramTypes, paramValues)
    return utils.keccak256(encodedData)
  }
}

export { Execution }
