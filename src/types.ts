import { BigNumber, BigNumberish, BytesLike } from 'ethers'
export interface IPlanResponse {
  pricePerExecution: BigNumber;
  window: BigNumber;
  token: string;
  active: boolean;
  gasLimit: BigNumber;
}

export interface IExecutionRequest {
  id: string;
  requestor: string;
  plan: BigNumberish;
  to: string;
  data: BytesLike;
  timestamp: BigNumberish;
  value: BigNumberish;
}

export interface IExecutionResponse {
  id: string;
  requestor: string;
  plan: BigNumber;
  to: string;
  data: BytesLike;
  timestamp: Date;
  value: BigNumber;
}

export enum ExecutionState {
  Nonexistent = 0,
  Scheduled = 1,
  ExecutionSuccessful = 2,
  ExecutionFailed = 3,
  Overdue = 4,
  Refunded = 5,
  Cancelled = 6
}

export const ErrorMessages = {
  SIGNER_REQUIRED: ''
}

export type ScheduledExecution = {
  id:string;
  timestamp: Date
}
