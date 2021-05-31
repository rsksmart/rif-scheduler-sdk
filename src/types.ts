import { BigNumber, BytesLike } from 'ethers'
export interface IPlan {
  pricePerExecution: BigNumber;
  window: BigNumber;
  token: string;
  active: boolean;
}

export interface IExecutionRequest {
  requestor: string;
  plan: BigNumber;
  to: string;
  data: BytesLike;
  gas: BigNumber;
  timestamp: BigNumber;
  value: BigNumber;
}
export interface IExecution extends IExecutionRequest {
  id:string;
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

export type ScheduledExecution = {
  id:string;
  timestamp: Date
}
