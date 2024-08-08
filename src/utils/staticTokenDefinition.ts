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
import { publicClients } from "./viem";

// Initialize a Token Definition with the attributes
export type StaticTokenDefinition = {
  address: `0x${string}`;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply?: bigint;
};

export const getStaticDefinition = (
  tokenAddress: string,
  staticDefinitions: Array<StaticTokenDefinition>
): StaticTokenDefinition | null => {
  // Search the definition using the address
  for (let i = 0; i < staticDefinitions.length; i++) {
    const staticDefinition = staticDefinitions[i];
    if (staticDefinition.address.toLowerCase() == tokenAddress.toLowerCase()) {
      return staticDefinition;
    }
  }

  // If not found, return null
  return null;
};

export const STATIC_TOKEN_DEFINITIONS_ETH: Array<StaticTokenDefinition> = [
  {
    address: "0xe0b7927c4af23765cb51314a0e0521a9645f0e2a",
    symbol: "DGD",
    name: "DGD",
    decimals: 9,
  },
  {
    address: "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9",
    symbol: "AAVE",
    name: "Aave Token",
    decimals: 18,
  },
  {
    address: "0xeb9951021698b42e4399f9cbb6267aa35f82d59d",
    symbol: "LIF",
    name: "Lif",
    decimals: 18,
  },
  {
    address: "0xbdeb4b83251fb146687fa19d1c660f99411eefe3",
    symbol: "SVD",
    name: "savedroid",
    decimals: 18,
  },
  {
    address: "0xbb9bc244d798123fde783fcc1c72d3bb8c189413",
    symbol: "TheDAO",
    name: "TheDAO",
    decimals: 16,
  },
  {
    address: "0x38c6a68304cdefb9bec48bbfaaba5c5b47818bb2",
    symbol: "HPB",
    name: "HPBCoin",
    decimals: 18,
  },
];

export const STATIC_TOKEN_DEFINITIONS_BASE: Array<StaticTokenDefinition> = [
  {
    address: "0x4200000000000000000000000000000000000006",
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    totalSupply: BigInt("137477588920311585079766"),
  },
  {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    totalSupply: BigInt("3015012428880788"),
  },
  {
    address: "0xe2dCA969624795985F2f083BcD0b674337ba130a",
    symbol: "SKR",
    name: "Saakuru",
    decimals: 18,
    totalSupply: BigInt("9365513976423388717148962"),
  },
  {
    address: "0x3B9728bD65Ca2c11a817ce39A6e91808CceeF6FD",
    symbol: "IHF",
    name: "IHF Smart Debase Token",
    decimals: 18,
    totalSupply: BigInt("516033706388471453082003"),
  },
  {
    address: "0x6d3B8C76c5396642960243Febf736C6BE8b60562",
    symbol: "SKOP",
    name: "SKOP Token",
    decimals: 18,
    totalSupply: BigInt("150000000000000000000000000"),
  },
  {
    address: "0x236aa50979D5f3De3Bd1Eeb40E81137F22ab794b",
    symbol: "tBTC",
    name: "Base tBTC v2",
    decimals: 18,
    totalSupply: BigInt("37474596000000000000"),
  },
];

export const STATIC_TOKEN_DEFINITIONS: {
  [key in keyof typeof publicClients]: Array<StaticTokenDefinition>;
} = {
  [ETH_MAINNET_ID]: STATIC_TOKEN_DEFINITIONS_ETH,
  [BASE_MAINNET_ID]: STATIC_TOKEN_DEFINITIONS_BASE,
  [ARBITRUM_MAINNET_ID]: STATIC_TOKEN_DEFINITIONS_ETH,
  [AVALANCHE_MAINNET_ID]: STATIC_TOKEN_DEFINITIONS_ETH,
  [BSC_MAINNET_ID]: STATIC_TOKEN_DEFINITIONS_ETH,
  [CELO_MAINNET_ID]: STATIC_TOKEN_DEFINITIONS_ETH,
  [MATIC_MAINNET_ID]: STATIC_TOKEN_DEFINITIONS_ETH,
  [OPTIMISM_MAINNET_ID]: STATIC_TOKEN_DEFINITIONS_ETH,
};
