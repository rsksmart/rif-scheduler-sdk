<p align="middle">
  <img src="https://www.rifos.org/assets/img/logo.svg" alt="logo" height="100" >
</p>
<h3 align="middle"><code>@rsksmart/rif-scheduler-sdk</code></h3>
<p align="middle">
  RIF Scheduler SDK
</p>
<p align="middle">
  <a href="https://badge.fury.io/js/%40rsksmart%2Frif-scheduler-sdk">
    <img src="https://badge.fury.io/js/%40rsksmart%2Frif-scheduler-sdk.svg" alt="npm" />
  </a>
  <a href="https://github.com/rsksmart/rif-scheduler-sdk/actions/workflows/ci.yml" alt="ci">
    <img src="https://github.com/rsksmart/rif-scheduler-sdk/actions/workflows/ci.yml/badge.svg" alt="ci" />
  </a>
  <a href="https://developers.rsk.co/rif/scheduler/sdk">
    <img src="https://img.shields.io/badge/-docs-brightgreen" alt="docs" />
  </a>
  <a href="https://lgtm.com/projects/g/rsksmart/rif-scheduler-sdk/context:javascript">
    <img src="https://img.shields.io/lgtm/grade/javascript/github/rsksmart/rif-scheduler-sdk" />
  </a>
  <a href='https://coveralls.io/github/rsksmart/rif-scheduler-sdk?branch=main'>
    <img src='https://coveralls.io/repos/github/rsksmart/rif-scheduler-sdk/badge.svg?branch=main' alt='Coverage Status' />
  </a>
  <a href="https://hits.seeyoufarm.com">
    <img src="https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2Fgithub.com%2Filanolkies%2Frif-scheduler-sdk&count_bg=%2379C83D&title_bg=%23555555&icon=&icon_color=%23E7E7E7&title=hits&edge_flat=false"/>
  </a>
</p>

# rif-scheduler-sdk

This is the sdk for the OneShootScheduler smart contract.

## Getting Started

### Installation

```
npm i @rsksmart/rif-scheduler-sdk ethers
```

### Initialization with metamask

```javascript
import { RifScheduler } from "@rsksmart/rif-scheduler-sdk";
import { providers } from "ethers";

const provider = new providers.Web3Provider(web3.currentProvider);

// Creates instance with provider, you can only do get operations
const rifScheduler = new RifScheduler(serviceProviderContractAddress, provider);

const signer = provider.getSigner();

// Creates instance with signer, you can do any kind of operation
const rifScheduler = new RifScheduler(serviceProviderContractAddress, signer);
```

### Initialization with RPC / Ganache

```javascript
import { RifScheduler } from "@rsksmart/rif-scheduler-sdk";
import { providers } from "ethers";

const url = "http://localhost:8545";

const provider = new providers.JsonRpcProvider(url);

// Creates instance with provider, you can only do get operations
const rifScheduler = new RifScheduler(serviceProviderContractAddress, provider);

const signer = provider.getSigner();

// Creates instance with signer, you can do any kind of operation
const rifScheduler = new RifScheduler(serviceProviderContractAddress, signer);
```

### Getting a plan

```javascript
const rifScheduler = new RifScheduler(serviceProviderContractAddress, provider);

const planIndex = 0;
const plan = await rifScheduler.getPlan(planIndex);

//  {
//    pricePerExecution: 10000000000000;
//    window: 300;
//    token: 0x...;
//    active: true;
//  }
```

## Purchasing executions

```javascript
const rifScheduler = new RifScheduler(serviceProviderContractAddress, signer);

const executionsQuantity = 2;
const totalAmount = plan.pricePerExecution.mul(executionsQuantity)

// first you need to approve the totalAmount of tokens
await this.schedulerSDK.approveToken(plan.token, totalAmount)

const purchaseTransaction = await this.schedulerSDK.purchasePlan(planIndex, executionsQuantity)

// we recommend to wait at least 10 confirmations to be sure tha your transaction was processed ok.
await purchaseTransaction.wait(12)
```

## Verifying your remaining executions

```javascript
const rifScheduler = new RifScheduler(serviceProviderContractAddress, signer);

const remainingExecutions = await this.schedulerSDK.remainingExecutions(planIndex)

//  2
```

## Scheduling a single execution

```javascript
const rifScheduler = new RifScheduler(serviceProviderContractAddress, signer);

const encodedFunctionCall = new utils.Interface(MyContract.abi).encodeFunctionData('<MyContractFunction>', [arrayOfMyContractFunctionParameters])

const execution = executionFactory(planIndex, myContractAddress, encodedMethodCall, gas, executeAt, BigNumber.from(0), yourAccountAddress)
const scheduledExecutionTransaction = await this.schedulerSDK.schedule(execution)

// we recommend to wait at least 10 confirmations to be sure tha your transaction was processed ok.
await scheduledExecutionTransaction.wait(12)
```

## Run for development

Install dependencies:

```
npm i
```

### Run unit tests

```
npm test
```

Coverage report with:

```
npm run test:coverage
```

### Run linter

```
npm run lint
```

Auto-fix:

```
npm run lint:fix
```

### Build for production

```
npm run build
```
