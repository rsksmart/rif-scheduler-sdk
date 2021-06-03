import { BigNumber, BigNumberish, utils } from 'ethers'
import { IExecutionRequest } from './types'
import dayjs from 'dayjs'

const executionId = (requestor: string, plan: BigNumberish, executionContractAddress: string, encodedTransactionCall: utils.BytesLike, gas: BigNumberish, executionTimestamp: Date, value: BigNumberish):string => {
  const executionTimestampBigNumber = BigNumber.from(dayjs(executionTimestamp).unix())

  const encoder = new utils.AbiCoder()
  const paramTypes = ['address', 'uint256', 'address', 'bytes', 'uint256', 'uint256', 'uint256']
  const paramValues = [requestor, plan.toString(), executionContractAddress, encodedTransactionCall, gas.toString(), executionTimestampBigNumber.toString(), value.toString()]
  const encodedData = encoder.encode(paramTypes, paramValues)
  return utils.keccak256(encodedData)
}

const executionFactory = (
  plan: BigNumberish,
  executionContractAddress: string,
  encodedTransactionCall: utils.BytesLike,
  gas: BigNumberish,
  executionTimestamp: Date,
  value: BigNumberish,
  requestor: string
): IExecutionRequest => {
  const executionTimestampBigNumber = BigNumber.from(dayjs(executionTimestamp).unix())

  return ({
    requestor,
    plan,
    gas,
    value,
    data: encodedTransactionCall,
    id: executionId(requestor, plan, executionContractAddress, encodedTransactionCall, gas, executionTimestamp, value),
    timestamp: executionTimestampBigNumber,
    to: executionContractAddress
  })
}

export { executionFactory, executionId }
