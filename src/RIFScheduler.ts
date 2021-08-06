import { BigNumber, BigNumberish, ContractTransaction } from 'ethers'
import dayjs from 'dayjs'
import { Execution } from './Execution'
import { Base } from './Base'
import { Plan } from './Plan'
import { Token } from './token'

export class RIFScheduler extends Base {
  async getPlansCount (): Promise<BigNumber> {
    return this.schedulerContract.plansCount()
  }

  async getPlan (planIndex: BigNumberish): Promise<Plan> {
    const plan = await this.schedulerContract.plans(planIndex)

    return new Plan(this.config, planIndex, new Token(this.config, plan.token), plan.window, plan.pricePerExecution, plan.gasLimit)
  }

  async getPlans (): Promise<Plan[]> {
    const plansCount = await this.getPlansCount()

    const plansList: Plan[] = []

    for (let index = BigNumber.from(0); index.lt(plansCount); index = index.add(1)) {
      const plan = await this.getPlan(index)
      plansList.push(plan)
    }

    return plansList
  }

  public async getExecutionsCount (accountAddress: string): Promise<BigNumber> {
    return this.schedulerContract.executionsByRequestorCount(accountAddress)
  }

  public async getExecution (executionId: string): Promise<Execution> {
    const execution = await this.schedulerContract.getExecutionById(executionId)
    const executionTimestampDate = dayjs.unix(BigNumber.from(execution.timestamp).toNumber()).toDate()

    const plan = await this.getPlan(execution.plan)

    return new Execution(
      this.config,
      plan,
      execution.to,
      execution.data,
      executionTimestampDate,
      execution.value,
      execution.requestor
    )
  }

  public async getExecutions (accountAddress: string, fromIndex: BigNumberish, toIndex: BigNumberish): Promise<Execution[]> {
    const executions = await this.schedulerContract.getExecutionsByRequestor(accountAddress, fromIndex, toIndex)
    const plansCache: Plan[] = []
    return Promise.all(executions.map(async (execution) => {
      const executionTimestampDate = dayjs.unix(BigNumber.from(execution.timestamp).toNumber()).toDate()

      let plan = plansCache.find(x => x.index.eq(execution.plan))

      if (!plan) {
        plan = await this.getPlan(execution.plan)
        plansCache.push(plan)
      }

      return new Execution(
        this.config,
        plan,
        execution.to,
        execution.data,
        executionTimestampDate,
        execution.value,
        execution.requestor
      )
    }))
  }

  public async getMinimumTimeBeforeScheduling (): Promise<BigNumber> {
    // this is the minimum quantity of seconds required to schedule an execution
    return this.schedulerContract.minimumTimeBeforeExecution()
  }

  public async schedule (execution: Execution): Promise<ContractTransaction> {
    return this.schedulerContract.schedule(
      execution.plan.index,
      execution.contractAddress,
      execution.contractFunctionEncoded,
      execution.executeAtBigNumber,
      { value: execution.value }
    )
  }

  public async scheduleMany (executions: Execution[]): Promise<ContractTransaction> {
    const encodedExecutions = executions.map(x => x.encode())

    const totalValue = executions.reduce((total, execution) => total.add(execution.value), BigNumber.from(0))

    return this.schedulerContract.batchSchedule(encodedExecutions, { value: totalValue })
  }
}
