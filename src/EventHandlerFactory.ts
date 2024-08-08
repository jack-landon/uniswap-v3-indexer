import { Pool, UniswapV3Factory } from "generated";
import { getChainConfig } from "./utils/chains";
import {
  fetchTokenDecimals,
  fetchTokenName,
  fetchTokenSymbol,
  fetchTokenTotalSupply,
} from "./utils/token";
import {
  ADDRESS_ZERO,
  ONE_BI,
  ZERO_BD,
  ZERO_BI,
  poolsToSkip,
} from "./utils/constants";
import type { publicClients } from "./utils/viem";

UniswapV3Factory.PoolCreated.contractRegister(({ event, context }) => {
  context.addUniswapV3Pool(event.params.pool);
});

UniswapV3Factory.PoolCreated.handler(async ({ event, context }) => {
  const subgraphConfig = getChainConfig(event.chainId);
  const whitelistTokens = subgraphConfig.whitelistTokens;
  const tokenOverrides = subgraphConfig.tokenOverrides;
  context.log.info(
    `This is the Token Overrides: ${tokenOverrides.map(
      (override) => `${override.address} - ${override.symbol}`
    )}`
  );
  const poolMappings = subgraphConfig.poolMappings;

  // temp fix
  if (poolsToSkip.includes(event.params.pool)) return;

  // load factory
  let factory = await context.Factory.get(event.srcAddress);

  if (!factory) {
    context.log.info(`Creating Factory`);

    factory = {
      id: event.srcAddress,
      poolCount: ZERO_BI,
      totalVolumeETH: ZERO_BD,
      totalVolumeUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      totalFeesUSD: ZERO_BD,
      totalFeesETH: ZERO_BD,
      totalValueLockedETH: ZERO_BD,
      totalValueLockedUSD: ZERO_BD,
      totalValueLockedUSDUntracked: ZERO_BD,
      totalValueLockedETHUntracked: ZERO_BD,
      txCount: ZERO_BI,
      owner: ADDRESS_ZERO,
    };

    // create new bundle for tracking eth price
    context.Bundle.set({
      id: event.chainId.toString(),
      ethPriceUSD: ZERO_BD,
    });

    // if (poolMappings.length > 0) {
    //   await populateEmptyPools(
    //     event.blockNumber,
    //     event.blockTimestamp,
    //     poolMappings,
    //     whitelistTokens,
    //     tokenOverrides,
    //     context,
    //     event.chainId as keyof typeof publicClients
    //   ); // Do this if you need to backfill - This is used for generating optimism pre-regenesis data.
    // }
  }

  factory = {
    ...factory,
    poolCount: factory.poolCount + ONE_BI,
  };

  let pool: Pool = {
    id: event.params.pool,
    token0_id: event.params.token0,
    token1_id: event.params.token1,
    feeTier: BigInt(event.params.fee),
    createdAtTimestamp: event.block.timestamp,
    createdAtBlockNumber: event.block.number,
    liquidityProviderCount: ZERO_BI,
    txCount: ZERO_BI,
    liquidity: ZERO_BI,
    sqrtPrice: ZERO_BI,
    token0Price: ZERO_BD,
    token1Price: ZERO_BD,
    observationIndex: ZERO_BI,
    totalValueLockedToken0: ZERO_BD,
    totalValueLockedToken1: ZERO_BD,
    totalValueLockedUSD: ZERO_BD,
    totalValueLockedETH: ZERO_BD,
    totalValueLockedUSDUntracked: ZERO_BD,
    volumeToken0: ZERO_BD,
    volumeToken1: ZERO_BD,
    volumeUSD: ZERO_BD,
    feesUSD: ZERO_BD,
    feeGrowthGlobal0X128: ZERO_BI,
    feeGrowthGlobal1X128: ZERO_BI,
    untrackedVolumeUSD: ZERO_BD,
    collectedFeesToken0: ZERO_BD,
    collectedFeesToken1: ZERO_BD,
    collectedFeesUSD: ZERO_BD,
    tick: undefined,
  };

  let [token0, token1] = await Promise.all([
    context.Token.get(event.params.token0),
    context.Token.get(event.params.token1),
  ]);

  // fetch info if null
  if (!token0) {
    const [decimals, symbol, name, totalSupply] = await Promise.all([
      fetchTokenDecimals(
        event.params.token0,
        tokenOverrides,
        event.chainId as keyof typeof publicClients
      ),
      fetchTokenSymbol(
        event.params.token0,
        tokenOverrides,
        event.chainId as keyof typeof publicClients
      ),
      fetchTokenName(
        event.params.token0,
        tokenOverrides,
        event.chainId as keyof typeof publicClients
      ),
      fetchTokenTotalSupply(
        event.params.token0,
        tokenOverrides,
        event.chainId as keyof typeof publicClients
      ),
    ]);

    // bail if we couldn't figure out the decimals
    if (!decimals) {
      context.log.debug("No Decimal for token0");
      return;
    }

    token0 = {
      id: event.params.token0,
      symbol,
      name,
      totalSupply,
      decimals,
      derivedETH: ZERO_BD,
      volume: ZERO_BD,
      volumeUSD: ZERO_BD,
      feesUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      totalValueLocked: ZERO_BD,
      totalValueLockedUSD: ZERO_BD,
      totalValueLockedUSDUntracked: ZERO_BD,
      txCount: ZERO_BI,
      poolCount: ZERO_BI,
      whitelistPools: [],
    };
  }

  if (!token1) {
    const [decimals, symbol, name, totalSupply] = await Promise.all([
      fetchTokenDecimals(
        event.params.token1,
        tokenOverrides,
        event.chainId as keyof typeof publicClients
      ),
      fetchTokenSymbol(
        event.params.token1,
        tokenOverrides,
        event.chainId as keyof typeof publicClients
      ),
      fetchTokenName(
        event.params.token1,
        tokenOverrides,
        event.chainId as keyof typeof publicClients
      ),
      fetchTokenTotalSupply(
        event.params.token1,
        tokenOverrides,
        event.chainId as keyof typeof publicClients
      ),
    ]);

    // bail if we couldn't figure out the decimals
    if (!decimals) {
      context.log.debug("No Decimal for token1");
      return;
    }

    token1 = {
      id: event.params.token1,
      symbol,
      name,
      totalSupply,
      decimals,
      derivedETH: ZERO_BD,
      volume: ZERO_BD,
      volumeUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      feesUSD: ZERO_BD,
      totalValueLocked: ZERO_BD,
      totalValueLockedUSD: ZERO_BD,
      totalValueLockedUSDUntracked: ZERO_BD,
      txCount: ZERO_BI,
      poolCount: ZERO_BI,
      whitelistPools: [],
    };
  }

  // update white listed pools
  if (whitelistTokens.includes(token0.id)) {
    const newPools = token1.whitelistPools;
    newPools.push(pool.id);
    token1 = {
      ...token1,
      whitelistPools: newPools,
    };
  }
  if (whitelistTokens.includes(token1.id)) {
    const newPools = token0.whitelistPools;
    newPools.push(pool.id);
    token0 = {
      ...token0,
      whitelistPools: newPools,
    };
  }

  context.Pool.set(pool);
  context.Token.set(token0);
  context.Token.set(token1);
  context.Factory.set(factory);

  //   DOUBLE CHECK THIS
  // create the tracked contract based on the template
  // PoolTemplate.create(event.params.pool);
});
