// eslint-disable-next-line camelcase
import { OneShotSchedule__factory } from '../typechain/factories/OneShotSchedule__factory'
// eslint-disable-next-line camelcase
import { ERC677__factory } from '../typechain/factories/ERC677__factory'
import { ethers, Signer, Wallet, BigNumber } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Plan } from '../src/types'
import * as dotenv from 'dotenv'
dotenv.config()

const Config = {
  REQUIRED_CONFIRMATIONS: parseInt(process.env.REQUIRED_CONFIRMATIONS as string),
  BLOCKCHAIN_HTTP_URL: process.env.BLOCKCHAIN_HTTP_URL as string,
  MNEMONIC_PHRASE: process.env.MNEMONIC_PHRASE as string
}

const plans: Plan[] = [
  { pricePerExecution: BigNumber.from(3), window: BigNumber.from(10000), token: '', active: true },
  { pricePerExecution: BigNumber.from(4), window: BigNumber.from(300), token: '', active: true }
]

const getJsonRpcProvider = async function (): Promise<JsonRpcProvider> {
  return new ethers.providers.JsonRpcProvider(Config.BLOCKCHAIN_HTTP_URL)
}

const getWalletSigner = function ():Signer {
  return Wallet.fromMnemonic(Config.MNEMONIC_PHRASE)
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
  getWalletSigner,
  contractsSetUp,
  plans
}
