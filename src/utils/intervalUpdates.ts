import {
  Bundle,
  Factory,
  PoolDayData,
  Pool,
  PoolHourData,
  TokenDayData,
  Token,
  TokenHourData,
  UniswapDayData,
  handlerContext,
} from "generated";
import { ONE_BI, ZERO_BD, ZERO_BI } from "./constants";
import { getFromId } from ".";

export function getDayID(timestamp: number) {
  return Math.floor(timestamp / 86400); // rounded
}

export function getDayStartTimestamp(dayID: number) {
  return dayID * 86400;
}

export function getHourIndex(timestamp: number) {
  return Math.floor(timestamp / 3600); // get unique hour within unix history
}

export function getHourStartUnix(hourIndex: number) {
  return hourIndex * 3600; // want the rounded effect
}

/**
 * Tracks global aggregate data over daily windows
 * @param event
 */
export function updateUniswapDayData(
  dayID: number,
  factory: Factory,
  uniswapDayData: UniswapDayData | undefined,
  chainId: number,
  context: handlerContext
): UniswapDayData {
  const dayStartTimestamp = getDayStartTimestamp(dayID);

  if (!uniswapDayData) {
    uniswapDayData = {
      id: dayID.toString().concat("-").concat(chainId.toString()),
      chainId,
      date: dayStartTimestamp,
      volumeETH: ZERO_BD,
      volumeUSD: ZERO_BD,
      volumeUSDUntracked: ZERO_BD,
      feesUSD: ZERO_BD,
      tvlUSD: factory.totalValueLockedUSD,
      txCount: factory.txCount,
    };
  }

  uniswapDayData = {
    ...uniswapDayData,
    tvlUSD: factory.totalValueLockedUSD,
    txCount: factory.txCount,
  };

  context.UniswapDayData.set(uniswapDayData);

  return uniswapDayData;
}

export function updatePoolDayData(
  dayID: number,
  pool: Pool,
  poolDayData: PoolDayData | undefined,
  feeGrowthGlobal0X128: bigint | undefined,
  feeGrowthGlobal1X128: bigint | undefined,
  chainId: number,
  context: handlerContext
): PoolDayData {
  const dayStartTimestamp = getDayStartTimestamp(dayID);
  const poolAddress = getFromId(pool.id).address;
  const dayPoolID = poolAddress
    .concat("-")
    .concat(dayID.toString())
    .concat("-")
    .concat(chainId.toString()); // poolAddress + "-" + dayId + "-" + chainId

  if (!poolDayData) {
    poolDayData = {
      id: dayPoolID,
      date: dayStartTimestamp,
      pool_id: pool.id,
      chainId,
      volumeToken0: ZERO_BD,
      volumeToken1: ZERO_BD,
      volumeUSD: ZERO_BD,
      feesUSD: ZERO_BD,
      feeGrowthGlobal0X128: feeGrowthGlobal0X128
        ? feeGrowthGlobal0X128
        : ZERO_BI,
      feeGrowthGlobal1X128: feeGrowthGlobal1X128
        ? feeGrowthGlobal1X128
        : ZERO_BI,
      txCount: ZERO_BI,
      openPrice: pool.token0Price,
      high: pool.token0Price,
      low: pool.token0Price,
      close: pool.token0Price,
      liquidity: pool.liquidity,
      sqrtPrice: pool.sqrtPrice,
      token0Price: pool.token0Price,
      token1Price: pool.token1Price,
      tick: pool.tick,
      tvlUSD: pool.totalValueLockedUSD,
    };
  }

  if (pool.token0Price.gt(poolDayData.high)) {
    poolDayData = {
      ...poolDayData,
      high: pool.token0Price,
    };
  }
  if (pool.token0Price.lt(poolDayData.low)) {
    poolDayData = {
      ...poolDayData,
      low: pool.token0Price,
    };
  }

  if (feeGrowthGlobal0X128) {
    poolDayData = {
      ...poolDayData,
      feeGrowthGlobal0X128,
    };
  }

  if (feeGrowthGlobal1X128) {
    poolDayData = {
      ...poolDayData,
      feeGrowthGlobal1X128,
    };
  }

  poolDayData = {
    ...poolDayData,
    liquidity: pool.liquidity,
    sqrtPrice: pool.sqrtPrice,
    token0Price: pool.token0Price,
    token1Price: pool.token1Price,
    close: pool.token0Price,
    tick: pool.tick,
    tvlUSD: pool.totalValueLockedUSD,
    txCount: poolDayData.txCount + ONE_BI,
  };

  context.PoolDayData.set(poolDayData);

  return poolDayData;
}

export function updatePoolHourData(
  timestamp: number,
  pool: Pool,
  poolHourData: PoolHourData | undefined,
  feeGrowthGlobal0X128: bigint | undefined,
  feeGrowthGlobal1X128: bigint | undefined,
  chainId: number,
  context: handlerContext
): PoolHourData {
  const hourIndex = getHourIndex(timestamp); // get unique hour within unix history
  const hourStartUnix = getHourStartUnix(hourIndex); // want the rounded effect
  const poolAddress = getFromId(pool.id).address;
  const hourPoolID = poolAddress
    .concat("-")
    .concat(hourIndex.toString())
    .concat("-")
    .concat(chainId.toString());

  if (!poolHourData) {
    poolHourData = {
      id: hourPoolID,
      chainId,
      periodStartUnix: hourStartUnix,
      pool_id: pool.id,
      // things that dont get initialized always
      volumeToken0: ZERO_BD,
      volumeToken1: ZERO_BD,
      volumeUSD: ZERO_BD,
      txCount: ZERO_BI,
      feesUSD: ZERO_BD,
      feeGrowthGlobal0X128: feeGrowthGlobal0X128 ?? ZERO_BI,
      feeGrowthGlobal1X128: feeGrowthGlobal1X128 ?? ZERO_BI,
      openPrice: pool.token0Price,
      high: pool.token0Price,
      low: pool.token0Price,
      close: pool.token0Price,
      liquidity: pool.liquidity,
      sqrtPrice: pool.sqrtPrice,
      token0Price: pool.token0Price,
      token1Price: pool.token1Price,
      tick: pool.tick,
      tvlUSD: pool.totalValueLockedUSD,
    };
  }

  if (pool.token0Price.gt(poolHourData.high)) {
    poolHourData = {
      ...poolHourData,
      high: pool.token0Price,
    };
  }
  if (pool.token0Price.lt(poolHourData.low)) {
    poolHourData = {
      ...poolHourData,
      low: pool.token0Price,
    };
  }

  poolHourData = {
    ...poolHourData,
    liquidity: pool.liquidity,
    sqrtPrice: pool.sqrtPrice,
    token0Price: pool.token0Price,
    token1Price: pool.token1Price,
    close: pool.token0Price,
    tick: pool.tick,
    tvlUSD: pool.totalValueLockedUSD,
    txCount: poolHourData.txCount + ONE_BI,
  };

  context.PoolHourData.set(poolHourData);

  return poolHourData;
}

export function updateTokenDayData(
  token: Token,
  bundle: Bundle,
  dayID: number,
  tokenDayData: TokenDayData | undefined,
  chainId: number,
  context: handlerContext
): TokenDayData {
  const dayStartTimestamp = getDayStartTimestamp(dayID);
  const tokenAddress = getFromId(token.id).address;
  const tokenDayID = tokenAddress
    .concat("-")
    .concat(dayID.toString())
    .concat("-")
    .concat(chainId.toString());
  const tokenPrice = token.derivedETH.times(bundle.ethPriceUSD);

  if (!tokenDayData) {
    tokenDayData = {
      id: tokenDayID,
      date: dayStartTimestamp,
      chainId,
      token_id: token.id,
      volume: ZERO_BD,
      volumeUSD: ZERO_BD,
      feesUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      openPrice: tokenPrice,
      high: tokenPrice,
      low: tokenPrice,
      close: tokenPrice,
      priceUSD: tokenPrice,
      totalValueLocked: token.totalValueLocked,
      totalValueLockedUSD: token.totalValueLockedUSD,
    };
  }

  if (tokenPrice.gt(tokenDayData.high)) {
    tokenDayData = {
      ...tokenDayData,
      high: tokenPrice,
    };
  }

  if (tokenPrice.lt(tokenDayData.low)) {
    tokenDayData = {
      ...tokenDayData,
      low: tokenPrice,
    };
  }

  tokenDayData = {
    ...tokenDayData,
    close: tokenPrice,
    priceUSD: tokenPrice,
    totalValueLocked: token.totalValueLocked,
    totalValueLockedUSD: token.totalValueLockedUSD,
  };

  context.TokenDayData.set(tokenDayData);

  return tokenDayData;
}

export function updateTokenHourData(
  token: Token,
  bundle: Bundle,
  timestamp: number,
  tokenHourData: TokenHourData | undefined,
  chainId: number,
  context: handlerContext
): TokenHourData {
  const hourIndex = getHourIndex(timestamp); // get unique hour within unix history
  const hourStartUnix = getHourStartUnix(hourIndex); // want the rounded effect
  const tokenAddress = getFromId(token.id).address;
  const tokenHourID = tokenAddress
    .concat("-")
    .concat(hourIndex.toString())
    .concat("-")
    .concat(chainId.toString());

  const tokenPrice = token.derivedETH.times(bundle.ethPriceUSD);

  if (!tokenHourData) {
    tokenHourData = {
      id: tokenHourID,
      chainId,
      periodStartUnix: hourStartUnix,
      token_id: token.id,
      volume: ZERO_BD,
      volumeUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      feesUSD: ZERO_BD,
      openPrice: tokenPrice,
      high: tokenPrice,
      low: tokenPrice,
      close: tokenPrice,
      priceUSD: tokenPrice,
      totalValueLocked: token.totalValueLocked,
      totalValueLockedUSD: token.totalValueLockedUSD,
    };
  }

  if (tokenPrice.gt(tokenHourData.high)) {
    tokenHourData = {
      ...tokenHourData,
      high: tokenPrice,
    };
  }

  if (tokenPrice.lt(tokenHourData.low)) {
    tokenHourData = {
      ...tokenHourData,
      low: tokenPrice,
    };
  }

  tokenHourData = {
    ...tokenHourData,
    close: tokenPrice,
    priceUSD: tokenPrice,
    totalValueLocked: token.totalValueLocked,
    totalValueLockedUSD: token.totalValueLockedUSD,
  };

  context.TokenHourData.set(tokenHourData);

  return tokenHourData;
}
