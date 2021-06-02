import { BigNumber, BigNumberish, utils } from 'ethers'
import { IExecution, IExecutionRequest } from './types'
import dayjs from 'dayjs'

const executionId = (e:IExecutionRequest):string => {
  const encoder = new utils.AbiCoder()
  const paramTypes = ['address', 'uint256', 'address', 'bytes', 'uint256', 'uint256', 'uint256']
  const paramValues = [e.requestor, e.plan.toString(), e.to, e.data, e.gas.toString(), e.timestamp.toString(), e.value]
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
  from:string
): IExecution => {
  const execution:IExecutionRequest = {
    requestor: from,
    plan: BigNumber.from(plan),
    data: encodedTransactionCall,
    gas: BigNumber.from(gas),
    timestamp: BigNumber.from(dayjs(executionTimestamp).unix()),
    value: BigNumber.from(value),
    to: executionContractAddress
  }
  return ({
    id: executionId(execution),
    ...execution
  })
}

export { executionFactory, executionId }
