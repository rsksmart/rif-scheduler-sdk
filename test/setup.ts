import { RIFScheduler__factory as RIFSchedulerFactory } from '@rsksmart/rif-scheduler-contracts/dist/ethers-contracts/factories/RIFScheduler__factory'
import type { RIFScheduler as RIFSchedulerContract } from '@rsksmart/rif-scheduler-contracts/types/ethers-contracts'
import { ERC677__factory as ERC677Factory } from './contracts/types/factories/ERC677__factory'
import ERC677Data from './contracts/ERC677.json'
import { utils, Signer, BigNumber, constants, providers } from 'ethers'
import { IPlanResponse } from '../src'

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

  return { schedulerAddress: schedulerContract.address, tokenAddress: erc20.address, tokenAddress677: erc677.address }
}

const plansSetup = async function (oneShotScheduleContract:string, tokenAddress:string, tokenAddress677:string):Promise<IPlanResponse[]> {
  const users = await getUsers()
  const initialGasLimit = BigNumber.from(10000)
  const plans: IPlanResponse[] = [
    { pricePerExecution: BigNumber.from(3), window: BigNumber.from(10000), token: tokenAddress, active: true, gasLimit: initialGasLimit },
    { pricePerExecution: BigNumber.from(4), window: BigNumber.from(300), token: tokenAddress677, active: true, gasLimit: initialGasLimit.mul(10) },
    { pricePerExecution: BigNumber.from(4), window: BigNumber.from(200), token: constants.AddressZero, active: true, gasLimit: initialGasLimit.mul(100) }
  ]

  const oneShotScheduleContractProvider: RIFSchedulerContract = RIFSchedulerFactory.connect(oneShotScheduleContract, users.serviceProvider)
  await oneShotScheduleContractProvider.addPlan(plans[0].pricePerExecution, plans[0].window, plans[0].gasLimit, tokenAddress)
  await oneShotScheduleContractProvider.addPlan(plans[1].pricePerExecution, plans[1].window, plans[1].gasLimit, tokenAddress677)
  await oneShotScheduleContractProvider.addPlan(plans[2].pricePerExecution, plans[2].window, plans[2].gasLimit, constants.AddressZero)
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
