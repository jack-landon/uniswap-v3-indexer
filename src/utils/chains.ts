import { BigDecimal } from "generated";
import { OPTIMISM_POOL_MAPPINGS } from "../backfill/poolMappings";
import {
  STATIC_TOKEN_DEFINITIONS,
  StaticTokenDefinition,
} from "./staticTokenDefinition";
import {
  ARBITRUM_MAINNET_ID,
  AVALANCHE_MAINNET_ID,
  BASE_MAINNET_ID,
  BLAST_MAINNET_ID,
  BSC_MAINNET_ID,
  CELO_MAINNET_ID,
  ETH_MAINNET_ID,
  MATIC_MAINNET_ID,
  OPTIMISM_MAINNET_ID,
} from "./constants";

export enum ChainId {
  ARBITRUM_ONE = 42161,
  AVALANCHE = 43114,
  BASE = 8453,
  BLAST_MAINNET = 81457,
  BSC = 56,
  CELO = 42220,
  MAINNET = 1,
  MATIC = 137,
  OPTIMISM = 10,
}

// Note: All token and pool addresses should be lowercased!
export type SubgraphConfig = {
  // deployment address
  // e.g. https://docs.uniswap.org/contracts/v3/reference/deployments/ethereum-deployments
  factoryAddress: string;

  // the address of a pool where one token is a stablecoin and the other is a
  // token that tracks the price of the native token use this to calculate the
  // price of the native token, so prefer a pool with highest liquidity
  stablecoinWrappedNativePoolAddress: string;

  // true is stablecoin is token0, false if stablecoin is token1
  stablecoinIsToken0: boolean;

  // the address of a token that tracks the price of the native token, most of
  // the time, this is a wrapped asset but could also be the native token itself
  // for some chains
  wrappedNativeAddress: string;

  // the mimimum liquidity in a pool needed for it to be used to help calculate
  // token prices. for new chains, this should be initialized to ~4000 USD
  minimumNativeLocked: BigDecimal;

  // list of stablecoin addresses
  stablecoinAddresses: string[];

  // a token must be in a pool with one of these tokens in order to derive a
  // price (in addition to passing the minimumEthLocked check). This is also
  // used to determine whether volume is tracked or not.
  whitelistTokens: string[];

  // token overrides are used to override RPC calls for the symbol, name, and
  // decimals for tokens. for new chains this is typically empty.
  tokenOverrides: StaticTokenDefinition[];

  // skip the creation of these pools in handlePoolCreated. for new chains this is typically empty.
  poolsToSkip: string[];

  // initialize this list of pools and token addresses on factory creation. for new chains this is typically empty.
  poolMappings: Array<`0x${string}`[]>;
};

export function getChainConfig(chainId: number): SubgraphConfig {
  // subgraph does not support case switch with strings, hence this if else block
  if (chainId == ARBITRUM_MAINNET_ID) {
    return {
      factoryAddress: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      stablecoinWrappedNativePoolAddress:
        "0x17c14d2c404d167802b16c450d3c99f88f2c4f4d", // WETH-USDC 0.3% pool
      stablecoinIsToken0: false,
      wrappedNativeAddress: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", // WETH
      minimumNativeLocked: BigDecimal("20"),
      stablecoinAddresses: [
        "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8", // USDC
        "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", // DAI
        "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", // USDT
      ],
      whitelistTokens: [
        "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", // WETH
        "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8", // USDC
        "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", // DAI
        "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", // USDT
      ],
      tokenOverrides: [
        {
          address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
          symbol: "WETH",
          name: "Wrapped Ethereum",
          decimals: 18,
        },
        {
          address: "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8",
          symbol: "USDC",
          name: "USD Coin",
          decimals: 6,
        },
      ],
      poolsToSkip: [],
      poolMappings: [],
    };
  } else if (chainId == AVALANCHE_MAINNET_ID) {
    return {
      factoryAddress: "0x740b1c1de25031C31FF4fC9A62f554A55cdC1baD",
      stablecoinWrappedNativePoolAddress:
        "0xfae3f424a0a47706811521e3ee268f00cfb5c45e", // WAVAX-USDC 0.05% pool
      stablecoinIsToken0: false,
      wrappedNativeAddress: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7", // WAVAX
      minimumNativeLocked: BigDecimal("1000"),
      stablecoinAddresses: [
        "0xd586e7f844cea2f87f50152665bcbc2c279d8d70", // DAI_E
        "0xba7deebbfc5fa1100fb055a87773e1e99cd3507a", // DAI
        "0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664", // USDC_E
        "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e", // USDC
        "0xc7198437980c041c805a1edcba50c1ce5db95118", // USDT_E
        "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7", // USDT
      ],
      whitelistTokens: [
        "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7", // WAVAX
        "0xd586e7f844cea2f87f50152665bcbc2c279d8d70", // DAI_E
        "0xba7deebbfc5fa1100fb055a87773e1e99cd3507a", // DAI
        "0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664", // USDC_E
        "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e", // USDC
        "0xc7198437980c041c805a1edcba50c1ce5db95118", // USDT_E
        "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7", // USDT
        "0x130966628846bfd36ff31a822705796e8cb8c18d", // MIM
      ],
      tokenOverrides: [],
      poolsToSkip: [],
      poolMappings: [],
    };
  } else if (chainId == BASE_MAINNET_ID) {
    return {
      factoryAddress: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
      stablecoinWrappedNativePoolAddress:
        "0xd0b53D9277642d899DF5C87A3966A349A798F224", // WETH-USDC 0.05% pool
      stablecoinIsToken0: false,
      wrappedNativeAddress: "0x4200000000000000000000000000000000000006", // WETH
      minimumNativeLocked: BigDecimal("1"),
      stablecoinAddresses: [
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
      ],
      whitelistTokens: [
        "0x4200000000000000000000000000000000000006", // WETH
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
      ],
      tokenOverrides: STATIC_TOKEN_DEFINITIONS[BASE_MAINNET_ID],
      poolsToSkip: [],
      poolMappings: [],
    };
  } else if (chainId == BLAST_MAINNET_ID) {
    return {
      factoryAddress: "0x792edAdE80af5fC680d96a2eD80A44247D2Cf6Fd",
      stablecoinWrappedNativePoolAddress:
        "0xf52b4b69123cbcf07798ae8265642793b2e8990c", // USDB-WETH 0.3% pool
      stablecoinIsToken0: true,
      wrappedNativeAddress: "0x4300000000000000000000000000000000000004", // WETH
      minimumNativeLocked: BigDecimal("1"),
      stablecoinAddresses: [
        "0x4300000000000000000000000000000000000003", // USDB
      ],
      whitelistTokens: [
        "0x4300000000000000000000000000000000000004", // WETH
        "0x4300000000000000000000000000000000000003", // USDB
      ],
      tokenOverrides: [],
      poolsToSkip: [],
      poolMappings: [],
    };
  } else if (chainId == BSC_MAINNET_ID) {
    return {
      factoryAddress: "0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7",
      stablecoinWrappedNativePoolAddress:
        "0x6fe9e9de56356f7edbfcbb29fab7cd69471a4869", // USDC-WBNB 0.3% pool
      stablecoinIsToken0: true,
      wrappedNativeAddress: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", // WBNB
      minimumNativeLocked: BigDecimal("100"),
      stablecoinAddresses: [
        "0x55d398326f99059ff775485246999027b3197955", // USDT
        "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
      ],
      whitelistTokens: [
        "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", // WBNB
        "0x55d398326f99059ff775485246999027b3197955", // USDT
        "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
      ],
      tokenOverrides: [],
      poolsToSkip: [],
      poolMappings: [],
    };
  } else if (chainId == CELO_MAINNET_ID) {
    return {
      factoryAddress: "0xAfE208a311B21f13EF87E33A90049fC17A7acDEc",
      stablecoinWrappedNativePoolAddress:
        "0x2d70cbabf4d8e61d5317b62cbe912935fd94e0fe", // CUSD-CELO 0.01% pool
      stablecoinIsToken0: false,
      wrappedNativeAddress: "0x471ece3750da237f93b8e339c536989b8978a438", // CELO
      minimumNativeLocked: BigDecimal("3600"),
      stablecoinAddresses: [
        "0x765de816845861e75a25fca122bb6898b8b1282a", // CUSD
        "0xef4229c8c3250c675f21bcefa42f58efbff6002a", // Bridged USDC
        "0xceba9300f2b948710d2653dd7b07f33a8b32118c", // Native USDC
      ],
      whitelistTokens: [
        "0x471ece3750da237f93b8e339c536989b8978a438", // CELO
        "0x765de816845861e75a25fca122bb6898b8b1282a", // CUSD
        "0xef4229c8c3250c675f21bcefa42f58efbff6002a", // Bridged USDC
        "0xceba9300f2b948710d2653dd7b07f33a8b32118c", // Native USDC
        "0xd8763cba276a3738e6de85b4b3bf5fded6d6ca73", // CEUR
        "0xe8537a3d056da446677b9e9d6c5db704eaab4787", // CREAL
        "0x46c9757c5497c5b1f2eb73ae79b6b67d119b0b58", // PACT
        "0x17700282592d6917f6a73d0bf8accf4d578c131e", // MOO
        "0x66803fb87abd4aac3cbb3fad7c3aa01f6f3fb207", // Portal Eth
        "0xbaab46e28388d2779e6e31fd00cf0e5ad95e327b", // WBTC
      ],
      tokenOverrides: [],
      poolsToSkip: [],
      poolMappings: [],
    };
  } else if (chainId == ETH_MAINNET_ID) {
    return {
      factoryAddress: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      stablecoinWrappedNativePoolAddress:
        "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8", // USDC-WETH 0.3% pool
      stablecoinIsToken0: true,
      wrappedNativeAddress: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
      minimumNativeLocked: BigDecimal("20"),
      stablecoinAddresses: [
        "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
        "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
        "0x0000000000085d4780b73119b644ae5ecd22b376", // TUSD
        "0x956f47f50a910163d8bf957cf5846d573e7f87ca", // FEI
      ],
      whitelistTokens: [
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
        "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
        "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
        "0x0000000000085d4780b73119b644ae5ecd22b376", // TUSD
        "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", // WBTC
        "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643", // cDAI
        "0x39aa39c021dfbae8fac545936693ac917d5e7563", // cUSDC
        "0x86fadb80d8d2cff3c3680819e4da99c10232ba0f", // EBASE
        "0x57ab1ec28d129707052df4df418d58a2d46d5f51", // sUSD
        "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2", // MKR
        "0xc00e94cb662c3520282e6f5717214004a7f26888", // COMP
        "0x514910771af9ca656af840dff83e8264ecf986ca", // LINK
        "0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f", // SNX
        "0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e", // YFI
        "0x111111111117dc0aa78b770fa6a738034120c302", // 1INCH
        "0xdf5e0e81dff6faf3a7e52ba697820c5e32d806a8", // yCurv
        "0x956f47f50a910163d8bf957cf5846d573e7f87ca", // FEI
        "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0", // MATIC
        "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", // AAVE
        "0xfe2e637202056d30016725477c5da089ab0a043a", // sETH2
      ],
      tokenOverrides: STATIC_TOKEN_DEFINITIONS[ETH_MAINNET_ID],
      poolsToSkip: ["0x8fe8d9bb8eeba3ed688069c3d6b556c9ca258248"],
      poolMappings: [],
    };
  } else if (chainId == MATIC_MAINNET_ID) {
    return {
      factoryAddress: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      stablecoinWrappedNativePoolAddress:
        "0xa374094527e1673a86de625aa59517c5de346d32", // WMATIC-USDC 0.05% pool
      stablecoinIsToken0: false,
      wrappedNativeAddress: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", // WMATIC
      minimumNativeLocked: BigDecimal("20000"),
      stablecoinAddresses: [
        "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", // USDC
        "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063", // DAI
      ],
      whitelistTokens: [
        "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", // WMATIC
        "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", // WETH
        "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", // USDC
        "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063", // DAI
      ],
      tokenOverrides: [],
      poolsToSkip: [],
      poolMappings: [],
    };
  } else if (chainId == OPTIMISM_MAINNET_ID) {
    return {
      factoryAddress: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
      stablecoinWrappedNativePoolAddress:
        "0x03af20bdaaffb4cc0a521796a223f7d85e2aac31", // DAI-WETH 0.3% pool
      stablecoinIsToken0: false,
      wrappedNativeAddress: "0x4200000000000000000000000000000000000006", // WETH
      minimumNativeLocked: BigDecimal("10"),
      stablecoinAddresses: [
        "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", // DAI
        "0x7f5c764cbc14f9669b88837ca1490cca17c31607", // USDC
        "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58", // USDT
      ],
      whitelistTokens: [
        "0x4200000000000000000000000000000000000006", // WETH
        "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", // DAI
        "0x7f5c764cbc14f9669b88837ca1490cca17c31607", // USDC
        "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58", // USDT
        "0x4200000000000000000000000000000000000042", // OP
        "0x9e1028f5f1d5ede59748ffcee5532509976840e0", // PERP
        "0x50c5725949a6f0c72e6c4a641f24049a917db0cb", // LYRA
        "0x68f180fcce6836688e9084f035309e29bf0a2095", // WBTC
      ],
      tokenOverrides: [
        {
          address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
          symbol: "WETH",
          name: "Wrapped Ethereum",
          decimals: 18,
        },
      ],
      poolsToSkip: [
        "0x282b7d6bef6c78927f394330dca297eca2bd18cd",
        "0x5738de8d0b864d5ef5d65b9e05b421b71f2c2eb4",
        "0x5500721e5a063f0396c5e025a640e8491eb89aac",
        "0x1ffd370f9d01f75de2cc701956886acec9749e80",
      ],
      poolMappings: OPTIMISM_POOL_MAPPINGS,
    };
  } else {
    throw new Error("Unsupported Network");
  }
}
