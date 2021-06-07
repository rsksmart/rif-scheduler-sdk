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

With the RIF Scheduler SDK you can schedule transactions in the RSK network.

Features:
- Query and purchase plans
- Schedule transactions
- Schedule recurrent transactions
- Cancel a scheduling
- Query transactions scheduled and statuses

This is the official SDK for [`@rsksmart/rif-scheduler-contracts`](https://github.com/rsksmart/rif-scheduler-contracts) smart contract. Use it to interact with the `OneShootScheduler` smart contract in a more simple way.

## Getting Started

`@rsksmart/rif-scheduler-sdk` is built on top of [`ethers`](https://docs.ethers.io/). 

### Installation

```
npm i @rsksmart/rif-scheduler-sdk ethers
```

### Initialization

In order to create an instance of `RifScheduler` you will need an ethers provider or signer.

The provider will only allow `read-only` operations, such as `getPlan`. In the other hand the signer will allow all operations, such as `purchasePlan`, `schedule`, etc.

#### with metamask

```javascript
import { RifScheduler } from "@rsksmart/rif-scheduler-sdk";
import { providers } from "ethers";

const provider = new providers.Web3Provider(web3.currentProvider);

// Creates instance with provider, you can execute read-only operations
const rifScheduler = new RifScheduler(serviceProviderContractAddress, provider);

const signer = provider.getSigner();

// Creates instance with signer, you can execute any kind of operation
const rifScheduler = new RifScheduler(serviceProviderContractAddress, signer);
```

#### with RPC / Ganache

```javascript
import { RifScheduler } from "@rsksmart/rif-scheduler-sdk";
import { providers } from "ethers";

const url = "http://localhost:8545";

const provider = new providers.JsonRpcProvider(url);

// Creates instance with provider, you can execute read-only operations
const rifScheduler = new RifScheduler(serviceProviderContractAddress, provider);

const signer = provider.getSigner();

// Creates instance with signer, you can execute any kind of operation
const rifScheduler = new RifScheduler(serviceProviderContractAddress, signer);
```

What you can do with this sdk?

- [Purchasing Plans](https://developers.rsk.co/rif/scheduler/sdk/purchasing-plans)
- [Scheduling Executions](https://developers.rsk.co/rif/scheduler/sdk/scheduling)
- [Canceling](https://developers.rsk.co/rif/scheduler/sdk/canceling)

## How to contribute

If you want to contribute, here are the steps you need to run this project locally.

### Run for development

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
