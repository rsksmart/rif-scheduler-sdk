import { RIFScheduler__factory as RIFSchedulerFactory } from '@rsksmart/rif-scheduler-contracts/dist/ethers-contracts/factories/RIFScheduler__factory'
import type { RIFScheduler as RIFSchedulerContract } from '@rsksmart/rif-scheduler-contracts/types/ethers-contracts'
import { ERC677__factory as ERC677Factory } from './contracts/types/factories/ERC677__factory'
import ERC677Data from './contracts/ERC677.json'
import { utils, Signer, BigNumber, constants, providers } from 'ethers'
import { Plan } from '../src/Plan'
import { Token } from '../src/token'

const Config = {
  BLOCKCHAIN_HTTP_URL: 'HTTP://127.0.0.1:8545',
  MINIMUM_TIME_BEFORE_EXECUTION: 16 // sec
}

const getJsonRpcProvider = async function (): Promise<providers.JsonRpcProvider> {
  return new providers.JsonRpcProvider(Config.BLOCKCHAIN_HTTP_URL)
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

const contractsSetUp = async function (): Promise<{schedulerAddress:string, tokenAddress:string, tokenAddress677:string}> {
  utils.Logger.setLogLevel(utils.Logger.levels.OFF)
  const users = await getUsers()
  const rifSchedulerFactory = new RIFSchedulerFactory(users.admin)

  const erc677Factory = new ERC677Factory(users.admin)
  const erc677 = await erc677Factory.deploy(await users.admin.getAddress(), BigNumber.from(100000), 'RIF', 'RIF')
  await erc677.transfer(await users.serviceConsumer.getAddress(), BigNumber.from(50000))

  // using ERC677__factory that supports ERC20 to set totalSupply
  const erc20 = await erc677Factory.deploy(await users.admin.getAddress(), BigNumber.from(100000), 'DOC', 'DOC')
  await erc20.transfer(await users.serviceConsumer.getAddress(), BigNumber.from(50000))

  const schedulerContract = await rifSchedulerFactory.deploy(
    await users.serviceProvider.getAddress(),
    await users.payee.getAddress(),
    Config.MINIMUM_TIME_BEFORE_EXECUTION
  )

  const result = { schedulerAddress: schedulerContract.address, tokenAddress: erc20.address, tokenAddress677: erc677.address }

  return result
}

const plansSetup = async function (oneShotScheduleContract:string, tokenAddress:string, tokenAddress677:string):Promise<Plan[]> {
  const users = await getUsers()
  const initialGasLimit = BigNumber.from(10000)

  const config = {
    contractAddress: oneShotScheduleContract,
    providerOrSigner: users.serviceConsumer,
    supportedERC677Tokens: [tokenAddress677]
  }
  const plans: Plan[] = [
    new Plan(config, 0, new Token(config, tokenAddress), BigNumber.from(10000), BigNumber.from(3), initialGasLimit),
    new Plan(config, 1, new Token(config, tokenAddress677), BigNumber.from(300), BigNumber.from(4), initialGasLimit.mul(10)),
    new Plan(config, 2, new Token(config, constants.AddressZero), BigNumber.from(200), BigNumber.from(4), initialGasLimit.mul(100))
  ]

  const oneShotScheduleContractProvider: RIFSchedulerContract = RIFSchedulerFactory.connect(oneShotScheduleContract, users.serviceProvider)

  for (const plan of plans) {
    await oneShotScheduleContractProvider.addPlan(plan.pricePerExecution, plan.window, plan.gasLimit, plan.token.address)
  }

  return plans
}

const encodedCallSamples = async function () : Promise<{successful:string, failing:string}> {
  // tx call encoded
  const users = await getUsers()
  const consumerAddress = await users.serviceConsumer.getAddress()
  const successful = new utils.Interface(ERC677Data.abi).encodeFunctionData('balanceOf', [consumerAddress])
  const failing = new utils.Interface(ERC677Data.abi).encodeFunctionData('transferFrom', [constants.AddressZero, constants.AddressZero, '400000000'])

  return {
    successful,
    failing
  }
}

export {
  Config,
  getJsonRpcProvider,
  getUsers,
  contractsSetUp,
  plansSetup,
  encodedCallSamples
}
