// eslint-disable-next-line camelcase
import { OneShotSchedule__factory } from '../typechain/factories/OneShotSchedule__factory'
// eslint-disable-next-line camelcase
import { ERC677__factory } from '../typechain/factories/ERC677__factory'
import { ethers, Signer, BigNumber } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Plan } from '../src/types'

const Config = {
  BLOCKCHAIN_HTTP_URL: 'HTTP://127.0.0.1:8545'
}

const plans: Plan[] = [
  { pricePerExecution: BigNumber.from(3), window: BigNumber.from(10000), token: '', active: true },
  { pricePerExecution: BigNumber.from(4), window: BigNumber.from(300), token: '', active: true }
]

const getJsonRpcProvider = async function (): Promise<JsonRpcProvider> {
  return new ethers.providers.JsonRpcProvider(Config.BLOCKCHAIN_HTTP_URL)
}

interface users {
    admin:Signer;
    serviceProvider:Signer,
    payee:Signer,
    serviceConsumer:Signer
}

const getUsers = async function ():Promise<users> {
  const provider = await getJsonRpcProvider()
  return {
    admin: provider.getSigner(0),
    serviceProvider: provider.getSigner(1),
    payee: provider.getSigner(2),
    serviceConsumer: provider.getSigner(3)
  }
}

const contractsSetUp = async function (): Promise<{schedulerAddress:string, tokenAddress:string}> {
  const users = await getUsers()
  const oneShotScheduleFactory = new OneShotSchedule__factory(users.admin)
  const erc677Factory = new ERC677__factory(users.admin)
  const erc677 = await erc677Factory.deploy(await users.admin.getAddress(), BigNumber.from(100000), 'RIF', 'RIF')

  await erc677.transfer(await users.serviceConsumer.getAddress(), BigNumber.from(50000))

  const oneShotScheduleContract = await oneShotScheduleFactory.deploy()
  await oneShotScheduleContract.initialize(await users.serviceProvider.getAddress(), await users.payee.getAddress())

  const oneShotScheduleContractProvider = OneShotSchedule__factory.connect(oneShotScheduleContract.address, users.serviceProvider)
  await oneShotScheduleContractProvider.addPlan(plans[0].pricePerExecution, plans[0].window, erc677.address)

  return { schedulerAddress: oneShotScheduleContract.address, tokenAddress: erc677.address }
}

export {
  Config,
  getJsonRpcProvider,
  getUsers,
  contractsSetUp,
  plans
}
