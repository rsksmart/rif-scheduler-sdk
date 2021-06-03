// eslint-disable-next-line camelcase
import { ERC677__factory, OneShotSchedule__factory } from '../contracts/types'
import ERC677Data from '../contracts/ERC677.json'
import { ethers, Signer, BigNumber } from 'ethers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { IPlanResponse } from '../types'

const Config = {
  BLOCKCHAIN_HTTP_URL: 'HTTP://127.0.0.1:8545'
}

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

const contractsSetUp = async function (): Promise<{schedulerAddress:string, tokenAddress:string, tokenAddress677:string}> {
  ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.OFF)
  const users = await getUsers()
  const oneShotScheduleFactory = new OneShotSchedule__factory(users.admin)

  const erc677Factory = new ERC677__factory(users.admin)
  const erc677 = await erc677Factory.deploy(await users.admin.getAddress(), BigNumber.from(100000), 'RIF', 'RIF')
  await erc677.transfer(await users.serviceConsumer.getAddress(), BigNumber.from(50000))

  // using ERC677__factory that supports ERC20 to set totalSupply
  const erc20 = await erc677Factory.deploy(await users.admin.getAddress(), BigNumber.from(100000), 'DOC', 'DOC')
  await erc20.transfer(await users.serviceConsumer.getAddress(), BigNumber.from(50000))

  const oneShotScheduleContract = await oneShotScheduleFactory.deploy()
  await oneShotScheduleContract.initialize(await users.serviceProvider.getAddress(), await users.payee.getAddress())
  // ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.WARNING)
  return { schedulerAddress: oneShotScheduleContract.address, tokenAddress: erc20.address, tokenAddress677: erc677.address }
}

const plansSetup = async function (oneShotScheduleContract:string, tokenAddress:string, tokenAddress677:string):Promise<IPlanResponse[]> {
  const users = await getUsers()
  const plans: IPlanResponse[] = [
    { pricePerExecution: BigNumber.from(3), window: BigNumber.from(10000), token: tokenAddress, active: true },
    { pricePerExecution: BigNumber.from(4), window: BigNumber.from(300), token: tokenAddress677, active: true }
  ]
  const oneShotScheduleContractProvider = OneShotSchedule__factory.connect(oneShotScheduleContract, users.serviceProvider)
  await oneShotScheduleContractProvider.addPlan(plans[0].pricePerExecution, plans[0].window, tokenAddress)
  await oneShotScheduleContractProvider.addPlan(plans[1].pricePerExecution, plans[1].window, tokenAddress677)
  return plans
}

const encodedCallSamples = async function () : Promise<{successful:string, failing:string}> {
  // tx call encoded
  const users = await getUsers()
  const consumerAddress = await users.serviceConsumer.getAddress()
  const successful = new ethers.utils.Interface(ERC677Data.abi).encodeFunctionData('balanceOf', [consumerAddress])
  const failing = new ethers.utils.Interface(ERC677Data.abi).encodeFunctionData('transferFrom', [ethers.constants.AddressZero, ethers.constants.AddressZero, '400000000'])

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
