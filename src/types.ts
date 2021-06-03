import { BigNumber, BigNumberish, BytesLike } from 'ethers'
export interface IPlanResponse {
  pricePerExecution: BigNumber;
  window: BigNumber;
  token: string;
  active: boolean;
}

export interface IExecutionRequest {
  id: string;
  requestor: string;
  plan: BigNumberish;
  to: string;
  data: BytesLike;
  gas: BigNumberish;
  timestamp: BigNumberish;
  value: BigNumberish;
}

export interface IExecutionResponse {
  id: string;
  requestor: string;
  plan: BigNumber;
  to: string;
  data: BytesLike;
  gas: BigNumber;
  timestamp: Date;
  value: BigNumber;
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
