import { ContractReceipt } from 'ethers'
import { Plan } from '../src/model/Plan'

export function hasEvent (receipt: ContractReceipt, eventName:string):boolean {
  return (receipt?.events) ? receipt.events.findIndex(e => e.event === eventName) > -1 : false
}

export type ScheduledExecution = {
  id:string;
  timestamp: Date
}

export function equalPlans (p1:Plan, p2:Plan):boolean {
  return (
    p1.pricePerExecution.toString() === p2.pricePerExecution.toString() &&
    p1.token.address === p2.token.address &&
    p1.window.toString() === p2.window.toString() &&
    p1.gasLimit.toString() === p2.gasLimit.toString()
  )
}
