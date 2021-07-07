import { ContractReceipt } from 'ethers'

function hasEvent (receipt: ContractReceipt, eventName:string):boolean {
  return (receipt?.events) ? receipt.events.findIndex(e => e.event === eventName) > -1 : false
}

export default hasEvent
