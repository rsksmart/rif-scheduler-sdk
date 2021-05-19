// eslint-disable-next-line camelcase
import { OneShotSchedule__factory } from '../typechain/factories/OneShotSchedule__factory'
// eslint-disable-next-line camelcase
import { ERC677__factory } from '../typechain/factories/ERC677__factory'
import { ethers, Signer, Wallet, BigNumber } from 'ethers'
import { JsonRpcProvider, WebSocketProvider } from '@ethersproject/providers'
import { Plan } from '../src/types'

const Config = {
// contractAddress: '0x80DA26B793709162721cd8782CBaD9549d1Db9a4',
//   providerUrl: 'HTTP://127.0.0.1:7545',
  providerUrl: 'https://public-node.testnet.rsk.co',
  tokens: { RIF: '0x19f64674D8a5b4e652319F5e239EFd3bc969a1FE', DOC: '0xcb46c0ddc60d18efeb0e586c17af6ea36452dae0' },
  mnemonic: 'ginger gap live vanish develop monitor pattern cruise nation damage master never'
}

const plans: Plan[] = [
  { pricePerExecution: BigNumber.from(3), window: BigNumber.from(10000), token: Config.tokens.RIF, active: true },
  { pricePerExecution: BigNumber.from(4), window: BigNumber.from(300), token: Config.tokens.DOC, active: true }
]

const getJsonRpcProvider = async function (): Promise<JsonRpcProvider> {
  return await new ethers.providers.JsonRpcProvider(Config.providerUrl)
}

const getProvider = async function (): Promise<WebSocketProvider> {
  return await new ethers.providers.WebSocketProvider(Config.providerUrl)
}

const getWalletSigner = function ():Signer {
  return Wallet.fromMnemonic(Config.mnemonic)
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
  getProvider,
  getUsers,
  getWalletSigner,
  contractsSetUp,
  plans
}
