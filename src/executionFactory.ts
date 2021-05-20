import { BigNumber, BigNumberish, utils } from 'ethers'
import { IExecution } from './types'
import dayjs from 'dayjs'

const executionFactory = (
  plan: BigNumberish,
  executionContractAddress: string,
  encodedTransactionCall: utils.BytesLike,
  gas: BigNumberish,
  executionTimestamp: Date,
  value: BigNumberish,
  from:string
): IExecution => {
  const execution:IExecution = {
    requestor: from,
    plan: BigNumber.from(plan),
    data: encodedTransactionCall,
    gas: BigNumber.from(gas),
    timestamp: BigNumber.from(dayjs(executionTimestamp).unix()),
    value: BigNumber.from(value),
    to: executionContractAddress
  }
  return execution
}

export default executionFactory
