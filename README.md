# Uniswap V3 Indexer

An multi-chain indexer for Uniswap V3 smart contracts.
Built with envio by Jack Landon of [SvelteKit.io](https://sveltekit.io).
Inspired by the [Uniswap V3 Subgraph](https://github.com/Uniswap/v3-subgraph).

Supported chains:

- Ethereum
- Arbitrum One
- Base Mainnet

The indexer is flexible enough to support all chains that Uniswap V3 is deployed on.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Example Queries](#example-queries)
- [Contributing](#contributing)
- [License](#license)

## Features

- Fast indexing of smart contract events and state changes
- Support for multiple blockchain networks
- Real-time updates with websocket subscriptions
- Flexible query API for indexed data
- Scalable architecture for high-volume processing

## Installation

1. Clone the repository:
   `git clone https://github.com/yourusername/smart-contract-indexer.git`
2. Install dependencies:
   `cd smart-contract-indexer`
   `pnpm install`
3. Run Codegen:
   `pnpm run codegen`

## Usage

Start the indexer:
`pnpm run dev`

This will begin indexing smart contracts on all chains.

Envio will open up your browser to `http://localhost:8080/`, which is where you can view the data and make queries.

The local password is `testing`.

## Example Queries

### Get pools

```graphql
query GetPoolsOnEthMainnet {
  Pool(where: { chainId: { _eq: 1 } }) {
    address
    token0 {
      address
      symbol
      name
    }
    token1 {
      address
      symbol
      name
    }
    liquidity
    totalValueLockedUSD
    totalValueLockedUSDUntracked
    volumeUSD
    untrackedVolumeUSD
  }
}
```

### Get swaps

```graphql
query GetSwapsOnEthMainnet {
  Swap(where: { chainId: { _eq: 1 } }) {
    id
    token0 {
      address
      symbol
    }
    token1 {
      address
      symbol
    }
    tick
    amount0
    amount1
    amountUSD
    sqrtPriceX96
    timestamp
  }
}
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
