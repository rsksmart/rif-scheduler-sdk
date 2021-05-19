import { BigNumber, BytesLike } from 'ethers'
export interface Plan {
  pricePerExecution: BigNumber;
  window: BigNumber;
  token: string;
  active: boolean;
}

export interface Execution {
  requestor: string;
  plan: BigNumber;
  to: string;
  data: BytesLike;
  gas: BigNumber;
  timestamp: BigNumber;
  value: BigNumber;
  state: BigNumber;
}
