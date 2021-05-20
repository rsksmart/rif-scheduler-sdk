import { BigNumber, BytesLike } from 'ethers'
export interface IPlan {
  pricePerExecution: BigNumber;
  window: BigNumber;
  token: string;
  active: boolean;
}

export interface IExecution {
  requestor: string;
  plan: BigNumber;
  to: string;
  data: BytesLike;
  gas: BigNumber;
  timestamp: BigNumber;
  value: BigNumber;
  state?: BigNumber;
}

export enum ExecutionState {
  Scheduled = 0,
  ExecutionSuccessful = 1,
  ExecutionFailed = 2,
  Overdue = 3,
  Refunded = 4,
  Cancelled = 5
}

export const ErrorMessages = {
  SIGNER_REQUIRED: ''

}
