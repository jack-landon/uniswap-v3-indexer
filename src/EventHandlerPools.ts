import {
  BigDecimal,
  Burn,
  Collect,
  Mint,
  Swap,
  UniswapV3Pool,
} from "generated";
import { ONE_BI, ZERO_BD } from "./utils/constants";
import {
  Address,
  convertTokenToDecimal,
  getFactoryAddress,
  getFromId,
  getId,
  loadTransaction,
  safeDiv,
} from "./utils";
import {
  findNativePerToken,
  getNativePriceInUSD,
  getTrackedAmountUSD,
  sqrtPriceX96ToTokenPrices,
} from "./utils/pricing";
import { getChainConfig } from "./utils/chains";
import {
  getDayID,
  getHourIndex,
  updatePoolDayData,
  updatePoolHourData,
  updateTokenDayData,
  updateTokenHourData,
  updateUniswapDayData,
} from "./utils/intervalUpdates";
import { createTick } from "./utils/tick";
import { updateFeeGrowthGlobal } from "./utils/updateFeeGrowthGlobal";

UniswapV3Pool.Burn.handler(async ({ event, context }) => {
  const factoryAddress = getFactoryAddress(event.chainId);

  // tick entities
  const lowerTickId =
    event.srcAddress +
    "#" +
    event.params.tickLower.toString() +
    "-" +
    event.chainId.toString();
  const upperTickId =
    event.srcAddress +
    "#" +
    event.params.tickUpper.toString() +
    "-" +
    event.chainId.toString();

  const poolId = getId(event.srcAddress, event.chainId);
  const factoryId = getId(factoryAddress, event.chainId);

  let [bundle, pool, factory, lowerTick, upperTick] = await Promise.all([
    context.Bundle.get(event.chainId.toString())!,
    context.Pool.get(poolId)!,
    context.Factory.get(factoryId)!,
    context.Tick.get(lowerTickId),
    context.Tick.get(upperTickId),
  ]);

  if (!bundle) {
    return context.log.info(`Bundle not found for chain ${event.chainId}`);
  }

  if (!pool) {
    return context.log.info(
      `Pool not found for chain ${event.chainId}: ${event.srcAddress}`
    );
  }

  if (!factory) {
    return context.log.info(`Factory not found for chain ${event.chainId}`);
  }

  let [token0, token1] = await Promise.all([
    context.Token.get(pool.token0_id),
    context.Token.get(pool.token1_id),
  ]);

  if (token0 && token1) {
    const amount0 = convertTokenToDecimal(
      event.params.amount0,
      token0.decimals
    );
    const amount1 = convertTokenToDecimal(
      event.params.amount1,
      token1.decimals
    );

    const amountUSD = amount0
      .times(token0.derivedETH.times(bundle.ethPriceUSD))
      .plus(amount1.times(token1.derivedETH.times(bundle.ethPriceUSD)));

    // update globals
    factory = {
      ...factory,
      txCount: factory.txCount + ONE_BI,
    };

    token0 = {
      ...token0,
      txCount: token0.txCount + ONE_BI,
    };

    token1 = {
      ...token1,
      txCount: token1.txCount + ONE_BI,
    };

    pool = {
      ...pool,
      txCount: pool.txCount + ONE_BI,
    };

    // Pools liquidity tracks the currently active liquidity given pools current tick.
    // We only want to update it on burn if the position being burnt includes the current tick.
    if (
      pool.tick &&
      event.params.tickLower <= pool.tick &&
      event.params.tickUpper > pool.tick
    ) {
      pool = {
        ...pool,
        liquidity: pool.liquidity - event.params.amount,
      };
    }

    // burn entity
    const transaction = await loadTransaction(
      event.transaction.hash,
      event.block.number,
      event.block.timestamp,
      event.chainId,
      context
    );

    let burn: Burn = {
      id:
        transaction.transactionHash +
        "-" +
        event.logIndex.toString() +
        "-" +
        event.chainId.toString(),
      transaction_id: transaction.id,
      chainId: event.chainId,
      timestamp: BigInt(transaction.timestamp),
      pool_id: pool.id,
      token0_id: pool.token0_id,
      token1_id: pool.token1_id,
      owner: event.params.owner,
      origin: event.transaction.from,
      amount: event.params.amount,
      amount0: amount0,
      amount1: amount1,
      amountUSD: amountUSD,
      tickLower: event.params.tickLower,
      tickUpper: event.params.tickUpper,
      logIndex: event.logIndex,
    };

    if (lowerTick && upperTick) {
      const amount = event.params.amount;

      lowerTick = {
        ...lowerTick,
        liquidityGross: lowerTick.liquidityGross - amount,
        liquidityNet: lowerTick.liquidityNet - amount,
      };

      upperTick = {
        ...upperTick,
        liquidityGross: upperTick.liquidityGross - amount,
        liquidityNet: upperTick.liquidityNet + amount,
      };

      context.Tick.set(lowerTick);
      context.Tick.set(upperTick);
    }

    const poolAddress = getFromId(pool.id).address;
    const token0Address = getFromId(token0.id).address;
    const token1Address = getFromId(token1.id).address;

    // Get ID's to feed into interval updates
    const dayID = getDayID(event.block.timestamp);
    const dayPoolID = poolAddress
      .concat("-")
      .concat(dayID.toString())
      .concat("-")
      .concat(event.chainId.toString());
    const hourIndex = getHourIndex(event.block.timestamp); // get unique hour within unix history
    const hourPoolID = poolAddress
      .concat("-")
      .concat(hourIndex.toString())
      .concat("-")
      .concat(event.chainId.toString());
    const token0DayID = token0Address
      .concat("-")
      .concat(dayID.toString())
      .concat("-")
      .concat(event.chainId.toString());
    const token1DayID = token1Address
      .concat("-")
      .concat(dayID.toString())
      .concat("-")
      .concat(event.chainId.toString());
    const token0HourID = token0Address
      .concat("-")
      .concat(hourIndex.toString())
      .concat("-")
      .concat(event.chainId.toString());
    const token1HourID = token1Address
      .concat("-")
      .concat(hourIndex.toString())
      .concat("-")
      .concat(event.chainId.toString());

    let [
      uniswapDayData,
      poolDayData,
      poolHourData,
      token0DayData,
      token1DayData,
      token0HourData,
      token1HourData,
    ] = await Promise.all([
      context.UniswapDayData.get(
        dayID.toString().concat("-").concat(event.chainId.toString())
      ),
      context.PoolDayData.get(dayPoolID),
      context.PoolHourData.get(hourPoolID),
      context.TokenDayData.get(token0DayID),
      context.TokenDayData.get(token1DayID),
      context.TokenHourData.get(token0HourID),
      context.TokenHourData.get(token1HourID),
    ]);

    let feeGrowthGlobal0X128: bigint | undefined = undefined;
    let feeGrowthGlobal1X128: bigint | undefined = undefined;

    // New hour -> add the fee growth
    if (!poolHourData) {
      const updatedFeeGrowth = await updateFeeGrowthGlobal(
        event.srcAddress as Address,
        event.chainId,
        event.block.number,
        pool
      );
      feeGrowthGlobal0X128 = updatedFeeGrowth.feeGrowthGlobal0X128;
      feeGrowthGlobal1X128 = updatedFeeGrowth.feeGrowthGlobal1X128;
      pool = updatedFeeGrowth.pool;
    }

    updateUniswapDayData(
      dayID,
      factory,
      uniswapDayData,
      event.chainId,
      context
    );
    updatePoolDayData(
      dayID,
      pool,
      poolDayData,
      feeGrowthGlobal0X128,
      feeGrowthGlobal1X128,
      event.chainId,
      context
    );
    updatePoolHourData(
      event.block.timestamp,
      pool,
      poolHourData,
      feeGrowthGlobal0X128,
      feeGrowthGlobal1X128,
      event.chainId,
      context
    );
    updateTokenDayData(
      token0,
      bundle,
      dayID,
      token0DayData,
      event.chainId,
      context
    );
    updateTokenDayData(
      token1,
      bundle,
      dayID,
      token1DayData,
      event.chainId,
      context
    );
    updateTokenHourData(
      token0,
      bundle,
      event.block.timestamp,
      token0HourData,
      event.chainId,
      context
    );
    updateTokenHourData(
      token1,
      bundle,
      event.block.timestamp,
      token1HourData,
      event.chainId,
      context
    );

    // Save Changes
    context.Token.set(token0);
    context.Token.set(token1);
    context.Pool.set(pool);
    context.Factory.set(factory);
    context.Burn.set(burn);
  }
});

UniswapV3Pool.Collect.handler(async ({ event, context }) => {
  const subgraphConfig = getChainConfig(event.chainId);
  const factoryAddress = getFactoryAddress(event.chainId);

  const whitelistTokens = subgraphConfig.whitelistTokens;

  const poolId = getId(event.srcAddress, event.chainId);
  const factoryId = getId(factoryAddress, event.chainId);

  let [bundle, pool, factory, transaction] = await Promise.all([
    context.Bundle.get(event.chainId.toString())!,
    context.Pool.get(poolId),
    context.Factory.get(factoryId)!,
    loadTransaction(
      event.transaction.hash,
      event.block.number,
      event.block.timestamp,
      event.chainId,
      context
    ),
  ]);

  if (!bundle) {
    return context.log.info(`Bundle not found for chain ${event.chainId}`);
  }

  if (!pool) {
    return;
  }

  if (!factory) {
    return context.log.info(`Factory not found for chain ${event.chainId}`);
  }

  let [token0, token1] = await Promise.all([
    context.Token.get(pool.token0_id),
    context.Token.get(pool.token1_id),
  ]);

  if (!token0 || !token1) return;

  // Get formatted amounts collected.
  const collectedAmountToken0 = convertTokenToDecimal(
    event.params.amount0,
    token0.decimals
  );
  const collectedAmountToken1 = convertTokenToDecimal(
    event.params.amount1,
    token1.decimals
  );
  const trackedCollectedAmountUSD = getTrackedAmountUSD(
    collectedAmountToken0,
    token0,
    collectedAmountToken1,
    token1,
    whitelistTokens,
    bundle
  );

  // Reset tvl aggregates until new amounts calculated
  factory = {
    ...factory,
    totalValueLockedETH: factory.totalValueLockedETH.minus(
      pool.totalValueLockedETH
    ),
    txCount: factory.txCount + ONE_BI,
  };

  // update token data
  token0 = {
    ...token0,
    txCount: token0.txCount + ONE_BI,
    totalValueLocked: token0.totalValueLocked.minus(collectedAmountToken0),
  };

  token0 = {
    ...token0,
    totalValueLockedUSD: token0.totalValueLocked.times(
      token0.derivedETH.times(bundle.ethPriceUSD)
    ),
  };

  token1 = {
    ...token1,
    txCount: token1.txCount + ONE_BI,
    totalValueLocked: token1.totalValueLocked.minus(collectedAmountToken1),
  };

  token1 = {
    ...token1,
    totalValueLockedUSD: token1.totalValueLocked.times(
      token1.derivedETH.times(bundle.ethPriceUSD)
    ),
  };

  // Adjust pool TVL based on amount collected.
  pool = {
    ...pool,
    txCount: pool.txCount + ONE_BI,
    totalValueLockedToken0: pool.totalValueLockedToken0.minus(
      collectedAmountToken0
    ),
    totalValueLockedToken1: pool.totalValueLockedToken1.minus(
      collectedAmountToken1
    ),
  };

  pool = {
    ...pool,
    totalValueLockedETH: pool.totalValueLockedToken0
      .times(token0.derivedETH)
      .plus(pool.totalValueLockedToken1.times(token1.derivedETH)),
  };

  pool = {
    ...pool,
    totalValueLockedUSD: pool.totalValueLockedETH.times(bundle.ethPriceUSD),
    collectedFeesToken0: pool.collectedFeesToken0.plus(collectedAmountToken0),
    collectedFeesToken1: pool.collectedFeesToken1.plus(collectedAmountToken1),
    collectedFeesUSD: pool.collectedFeesUSD.plus(trackedCollectedAmountUSD),
  };

  factory = {
    ...factory,
    totalValueLockedETH: factory.totalValueLockedETH.plus(
      pool.totalValueLockedETH
    ),
  };

  factory = {
    ...factory,
    totalValueLockedUSD: factory.totalValueLockedETH.times(bundle.ethPriceUSD),
  };

  let collect: Collect = {
    id:
      transaction.transactionHash +
      "-" +
      event.logIndex.toString() +
      "-" +
      event.chainId.toString(),
    transaction_id: transaction.id,
    chainId: event.chainId,
    timestamp: BigInt(event.block.timestamp),
    pool_id: pool.id,
    owner: event.params.owner,
    amount0: collectedAmountToken0,
    amount1: collectedAmountToken1,
    amountUSD: trackedCollectedAmountUSD,
    tickLower: event.params.tickLower,
    tickUpper: event.params.tickUpper,
    logIndex: event.logIndex,
  };

  const poolAddress = getFromId(pool.id).address;
  const token0Address = getFromId(token0.id).address;
  const token1Address = getFromId(token1.id).address;

  // Update Interval Data
  const dayID = getDayID(event.block.timestamp);
  const dayPoolID = poolAddress
    .concat("-")
    .concat(dayID.toString())
    .concat("-")
    .concat(event.chainId.toString());
  const hourIndex = getHourIndex(event.block.timestamp); // get unique hour within unix history
  const hourPoolID = poolAddress
    .concat("-")
    .concat(hourIndex.toString())
    .concat("-")
    .concat(event.chainId.toString());
  const token0DayID = token0Address
    .concat("-")
    .concat(dayID.toString())
    .concat("-")
    .concat(event.chainId.toString());
  const token1DayID = token1Address
    .concat("-")
    .concat(dayID.toString())
    .concat("-")
    .concat(event.chainId.toString());
  const token0HourID = token0Address
    .concat("-")
    .concat(hourIndex.toString())
    .concat("-")
    .concat(event.chainId.toString());
  const token1HourID = token1Address
    .concat("-")
    .concat(hourIndex.toString())
    .concat("-")
    .concat(event.chainId.toString());

  let [
    uniswapDayData,
    poolDayData,
    poolHourData,
    token0DayData,
    token1DayData,
    token0HourData,
    token1HourData,
  ] = await Promise.all([
    context.UniswapDayData.get(
      dayID.toString().concat("-").concat(event.chainId.toString())
    ),
    context.PoolDayData.get(dayPoolID),
    context.PoolHourData.get(hourPoolID),
    context.TokenDayData.get(token0DayID),
    context.TokenDayData.get(token1DayID),
    context.TokenHourData.get(token0HourID),
    context.TokenHourData.get(token1HourID),
  ]);

  let feeGrowthGlobal0X128: bigint | undefined = undefined;
  let feeGrowthGlobal1X128: bigint | undefined = undefined;

  if (!poolHourData) {
    const updatedFeeGrowth = await updateFeeGrowthGlobal(
      event.srcAddress as Address,
      event.chainId,
      event.block.number,
      pool
    );
    feeGrowthGlobal0X128 = updatedFeeGrowth.feeGrowthGlobal0X128;
    feeGrowthGlobal1X128 = updatedFeeGrowth.feeGrowthGlobal1X128;
    pool = updatedFeeGrowth.pool;
  }

  updateUniswapDayData(dayID, factory, uniswapDayData, event.chainId, context);
  updatePoolDayData(
    dayID,
    pool,
    poolDayData,
    feeGrowthGlobal0X128,
    feeGrowthGlobal1X128,
    event.chainId,
    context
  );
  updatePoolHourData(
    event.block.timestamp,
    pool,
    poolHourData,
    feeGrowthGlobal0X128,
    feeGrowthGlobal1X128,
    event.chainId,
    context
  );
  updateTokenDayData(
    token0,
    bundle,
    dayID,
    token0DayData,
    event.chainId,
    context
  );
  updateTokenDayData(
    token1,
    bundle,
    dayID,
    token1DayData,
    event.chainId,
    context
  );
  updateTokenHourData(
    token0,
    bundle,
    event.block.timestamp,
    token0HourData,
    event.chainId,
    context
  );
  updateTokenHourData(
    token1,
    bundle,
    event.block.timestamp,
    token1HourData,
    event.chainId,
    context
  );

  context.Token.set(token0);
  context.Token.set(token1);
  context.Factory.set(factory);
  context.Pool.set(pool);
  context.Collect.set(collect);
});

UniswapV3Pool.Initialize.handler(async ({ event, context }) => {
  const subgraphConfig = getChainConfig(event.chainId);

  const stablecoinWrappedNativePoolAddress =
    subgraphConfig.stablecoinWrappedNativePoolAddress;
  const stablecoinIsToken0 = subgraphConfig.stablecoinIsToken0;
  const wrappedNativeAddress = subgraphConfig.wrappedNativeAddress;
  const stablecoinAddresses = subgraphConfig.stablecoinAddresses;
  const minimumNativeLocked = subgraphConfig.minimumNativeLocked;

  const poolId = getId(event.srcAddress, event.chainId);
  const stablecoinWrappedNativePoolId = getId(
    stablecoinWrappedNativePoolAddress,
    event.chainId
  );

  // update pool sqrt price and tick
  let [bundle, pool, stablecoinWrappedNativePool] = await Promise.all([
    context.Bundle.get(event.chainId.toString())!,
    context.Pool.get(poolId)!,
    context.Pool.get(stablecoinWrappedNativePoolId),
  ]);

  if (!pool) {
    return context.log.info(
      `Pool not found for chain ${event.chainId}: ${event.srcAddress}`
    );
  }

  pool = {
    ...pool,
    sqrtPrice: event.params.sqrtPriceX96,
    tick: event.params.tick,
  };

  context.Pool.set(pool);

  if (!bundle) {
    return context.log.info(`Bundle not found for chain ${event.chainId}`);
  }

  bundle = {
    ...bundle,
    ethPriceUSD: getNativePriceInUSD(
      stablecoinIsToken0,
      stablecoinWrappedNativePool
    ),
  };

  context.Bundle.set(bundle);

  const poolAddress = getFromId(pool.id).address;

  // Update Interval Data
  const dayID = getDayID(event.block.timestamp);
  const dayPoolID = poolAddress
    .concat("-")
    .concat(dayID.toString())
    .concat("-")
    .concat(event.chainId.toString());
  const hourIndex = getHourIndex(event.block.timestamp); // get unique hour within unix history
  const hourPoolID = poolAddress
    .concat("-")
    .concat(hourIndex.toString())
    .concat("-")
    .concat(event.chainId.toString());

  // update token prices
  let [token0, token1, poolDayData, poolHourData] = await Promise.all([
    context.Token.get(pool.token0_id),
    context.Token.get(pool.token1_id),
    context.PoolDayData.get(dayPoolID),
    context.PoolHourData.get(hourPoolID),
  ]);

  let feeGrowthGlobal0X128: bigint | undefined = undefined;
  let feeGrowthGlobal1X128: bigint | undefined = undefined;

  if (!poolHourData) {
    const updatedFeeGrowth = await updateFeeGrowthGlobal(
      event.srcAddress as Address,
      event.chainId,
      event.block.number,
      pool
    );
    feeGrowthGlobal0X128 = updatedFeeGrowth.feeGrowthGlobal0X128;
    feeGrowthGlobal1X128 = updatedFeeGrowth.feeGrowthGlobal1X128;
    pool = updatedFeeGrowth.pool;
  }

  updatePoolDayData(
    dayID,
    pool,
    poolDayData,
    feeGrowthGlobal0X128,
    feeGrowthGlobal1X128,
    event.chainId,
    context
  );
  updatePoolHourData(
    event.block.timestamp,
    pool,
    poolHourData,
    feeGrowthGlobal0X128,
    feeGrowthGlobal1X128,
    event.chainId,
    context
  );

  // update token prices
  if (token0 && token1) {
    let [token0DerivedEth, token1DerivedEth] = await Promise.all([
      findNativePerToken(
        token0,
        wrappedNativeAddress,
        stablecoinAddresses,
        minimumNativeLocked,
        bundle,
        event.chainId,
        context
      ),
      findNativePerToken(
        token1,
        wrappedNativeAddress,
        stablecoinAddresses,
        minimumNativeLocked,
        bundle,
        event.chainId,
        context
      ),
    ]);

    token0 = {
      ...token0,
      derivedETH: token0DerivedEth,
    };

    token1 = {
      ...token1,
      derivedETH: token1DerivedEth,
    };

    context.Token.set(token0);
    context.Token.set(token1);
  }
});

UniswapV3Pool.Mint.handler(async ({ event, context }) => {
  const factoryAddress = getFactoryAddress(event.chainId);
  const poolId = getId(event.srcAddress, event.chainId);
  const factoryId = getId(factoryAddress, event.chainId);

  const lowerTickId =
    event.srcAddress +
    "#" +
    event.params.tickLower.toString() +
    "-" +
    event.chainId.toString();
  const upperTickId =
    event.srcAddress +
    "#" +
    event.params.tickUpper.toString() +
    "-" +
    event.chainId.toString();

  let [bundle, pool, factory, transaction, lowerTick, upperTick] =
    await Promise.all([
      context.Bundle.get(event.chainId.toString())!,
      context.Pool.get(poolId)!,
      context.Factory.get(factoryId)!,
      loadTransaction(
        event.transaction.hash,
        event.block.number,
        event.block.timestamp,
        event.chainId,
        context
      ),
      context.Tick.get(lowerTickId),
      context.Tick.get(upperTickId),
    ]);

  if (!bundle) {
    return context.log.info(`Bundle not found for chain ${event.chainId}`);
  }

  if (!pool) {
    return context.log.info(
      `Pool not found for chain ${event.chainId}: ${event.srcAddress}`
    );
  }

  if (!factory) {
    return context.log.info(`Factory not found for chain ${event.chainId}`);
  }

  let [token0, token1] = await Promise.all([
    context.Token.get(pool.token0_id),
    context.Token.get(pool.token1_id),
  ]);

  if (token0 && token1) {
    const amount0 = convertTokenToDecimal(
      event.params.amount0,
      token0.decimals
    );
    const amount1 = convertTokenToDecimal(
      event.params.amount1,
      token1.decimals
    );

    const amountUSD = amount0
      .times(token0.derivedETH.times(bundle.ethPriceUSD))
      .plus(amount1.times(token1.derivedETH.times(bundle.ethPriceUSD)));

    // reset tvl aggregates until new amounts calculated
    factory = {
      ...factory,
      totalValueLockedETH: factory.totalValueLockedETH.minus(
        pool.totalValueLockedETH
      ),
      txCount: factory.txCount + ONE_BI,
    };

    token0 = {
      ...token0,
      txCount: token0.txCount + ONE_BI,
      totalValueLocked: token0.totalValueLocked.plus(amount0),
    };

    token0 = {
      ...token0,
      totalValueLockedUSD: token0.totalValueLocked.times(
        token0.derivedETH.times(bundle.ethPriceUSD)
      ),
    };

    token1 = {
      ...token1,
      txCount: token1.txCount + ONE_BI,
      totalValueLocked: token1.totalValueLocked.plus(amount1),
    };

    token1 = {
      ...token1,
      totalValueLockedUSD: token1.totalValueLocked.times(
        token1.derivedETH.times(bundle.ethPriceUSD)
      ),
    };

    pool = {
      ...pool,
      txCount: pool.txCount + ONE_BI,
    };

    // Pools liquidity tracks the currently active liquidity given pools current tick.
    // We only want to update it on mint if the new position includes the current tick.
    if (
      pool.tick &&
      event.params.tickLower <= pool.tick &&
      event.params.tickUpper > pool.tick
    ) {
      pool = {
        ...pool,
        liquidity: pool.liquidity + event.params.amount,
      };
    }

    pool = {
      ...pool,
      totalValueLockedToken0: pool.totalValueLockedToken0.plus(amount0),
      totalValueLockedToken1: pool.totalValueLockedToken1.plus(amount1),
    };

    pool = {
      ...pool,
      totalValueLockedETH: pool.totalValueLockedToken0
        .times(token0.derivedETH)
        .plus(pool.totalValueLockedToken1.times(token1.derivedETH)),
    };

    pool = {
      ...pool,
      totalValueLockedUSD: pool.totalValueLockedETH.times(bundle.ethPriceUSD),
    };

    factory = {
      ...factory,
      totalValueLockedETH: factory.totalValueLockedETH.plus(
        pool.totalValueLockedETH
      ),
    };

    factory = {
      ...factory,
      totalValueLockedUSD: factory.totalValueLockedETH.times(
        bundle.ethPriceUSD
      ),
    };

    let mint: Mint = {
      id:
        transaction.transactionHash +
        "-" +
        event.logIndex.toString() +
        "-" +
        event.chainId.toString(),
      transaction_id: transaction.id,
      chainId: event.chainId,
      timestamp: BigInt(transaction.timestamp),
      pool_id: pool.id,
      token0_id: pool.token0_id,
      token1_id: pool.token1_id,
      owner: event.params.owner,
      sender: event.params.sender,
      origin: event.transaction.from,
      amount: event.params.amount,
      amount0: amount0,
      amount1: amount1,
      amountUSD: amountUSD,
      tickLower: event.params.tickLower,
      tickUpper: event.params.tickUpper,
      logIndex: event.logIndex,
    };

    // tick entities
    const lowerTickIdx = event.params.tickLower;
    const upperTickIdx = event.params.tickUpper;

    if (!lowerTick) {
      lowerTick = createTick(
        lowerTickId,
        lowerTickIdx,
        pool.id,
        event.block.timestamp,
        event.block.number,
        event.chainId
      );
    }

    if (!upperTick) {
      upperTick = createTick(
        upperTickId,
        upperTickIdx,
        pool.id,
        event.block.timestamp,
        event.block.number,
        event.chainId
      );
    }

    const amount = event.params.amount;
    lowerTick = {
      ...lowerTick,
      liquidityGross: lowerTick.liquidityGross + amount,
      liquidityNet: lowerTick.liquidityNet + amount,
    };

    upperTick = {
      ...upperTick,
      liquidityGross: upperTick.liquidityGross + amount,
      liquidityNet: upperTick.liquidityNet - amount,
    };

    context.Tick.set(lowerTick);
    context.Tick.set(upperTick);

    const poolAddress = getFromId(pool.id).address;
    const token0Address = getFromId(token0.id).address;
    const token1Address = getFromId(token1.id).address;

    const dayID = getDayID(event.block.timestamp);
    const dayPoolID = poolAddress
      .concat("-")
      .concat(dayID.toString())
      .concat("-")
      .concat(event.chainId.toString());
    const hourIndex = getHourIndex(event.block.timestamp); // get unique hour within unix history
    const hourPoolID = poolAddress
      .concat("-")
      .concat(hourIndex.toString())
      .concat("-")
      .concat(event.chainId.toString());
    const token0DayID = token0Address
      .concat("-")
      .concat(dayID.toString())
      .concat("-")
      .concat(event.chainId.toString());
    const token1DayID = token1Address
      .concat("-")
      .concat(dayID.toString())
      .concat("-")
      .concat(event.chainId.toString());
    const token0HourID = token0Address
      .concat("-")
      .concat(hourIndex.toString())
      .concat("-")
      .concat(event.chainId.toString());
    const token1HourID = token1Address
      .concat("-")
      .concat(hourIndex.toString())
      .concat("-")
      .concat(event.chainId.toString());

    let [
      uniswapDayData,
      poolDayData,
      poolHourData,
      token0DayData,
      token1DayData,
      token0HourData,
      token1HourData,
    ] = await Promise.all([
      context.UniswapDayData.get(
        dayID.toString().concat("-").concat(event.chainId.toString())
      ),
      context.PoolDayData.get(dayPoolID),
      context.PoolHourData.get(hourPoolID),
      context.TokenDayData.get(token0DayID),
      context.TokenDayData.get(token1DayID),
      context.TokenHourData.get(token0HourID),
      context.TokenHourData.get(token1HourID),
    ]);

    let feeGrowthGlobal0X128: bigint | undefined = undefined;
    let feeGrowthGlobal1X128: bigint | undefined = undefined;

    if (!poolHourData) {
      const updatedFeeGrowth = await updateFeeGrowthGlobal(
        event.srcAddress as Address,
        event.chainId,
        event.block.number,
        pool
      );
      feeGrowthGlobal0X128 = updatedFeeGrowth.feeGrowthGlobal0X128;
      feeGrowthGlobal1X128 = updatedFeeGrowth.feeGrowthGlobal1X128;
      pool = updatedFeeGrowth.pool;
    }

    updateUniswapDayData(
      dayID,
      factory,
      uniswapDayData,
      event.chainId,
      context
    );
    updatePoolDayData(
      dayID,
      pool,
      poolDayData,
      feeGrowthGlobal0X128,
      feeGrowthGlobal1X128,
      event.chainId,
      context
    );
    updatePoolHourData(
      event.block.timestamp,
      pool,
      poolHourData,
      feeGrowthGlobal0X128,
      feeGrowthGlobal1X128,
      event.chainId,
      context
    );
    updateTokenDayData(
      token0,
      bundle,
      dayID,
      token0DayData,
      event.chainId,
      context
    );
    updateTokenDayData(
      token1,
      bundle,
      dayID,
      token1DayData,
      event.chainId,
      context
    );
    updateTokenHourData(
      token0,
      bundle,
      event.block.timestamp,
      token0HourData,
      event.chainId,
      context
    );
    updateTokenHourData(
      token1,
      bundle,
      event.block.timestamp,
      token1HourData,
      event.chainId,
      context
    );

    context.Token.set(token0);
    context.Token.set(token1);
    context.Pool.set(pool);
    context.Factory.set(factory);
    context.Mint.set(mint);
  }
});

UniswapV3Pool.Swap.handler(async ({ event, context }) => {
  const factoryAddress = getFactoryAddress(event.chainId);
  const subgraphConfig = getChainConfig(event.chainId);

  const poolId = getId(event.srcAddress, event.chainId);
  const factoryId = getId(factoryAddress, event.chainId);

  const stablecoinWrappedNativePoolAddress =
    subgraphConfig.stablecoinWrappedNativePoolAddress;
  const stablecoinIsToken0 = subgraphConfig.stablecoinIsToken0;
  const wrappedNativeAddress = subgraphConfig.wrappedNativeAddress;
  const stablecoinAddresses = subgraphConfig.stablecoinAddresses;
  const minimumNativeLocked = subgraphConfig.minimumNativeLocked;
  const whitelistTokens = subgraphConfig.whitelistTokens;

  let [bundle, pool, factory] = await Promise.all([
    context.Bundle.get(event.chainId.toString()),
    context.Pool.get(poolId),
    context.Factory.get(factoryId),
  ]);

  if (!bundle) {
    return context.log.info(`Bundle not found for chain ${event.chainId}`);
  }

  if (!factory) {
    return context.log.info(`Factory not found for chain ${event.chainId}`);
  }

  if (!pool) {
    return context.log.info(
      `Pool not found for chain ${event.chainId}: ${event.srcAddress}`
    );
  }

  // hot fix for bad pricing (LUSD/WETH)
  if (
    pool.id ==
    "0x9663f2ca0454accad3e094448ea6f77443880454"
      .concat("-")
      .concat(event.chainId.toString())
  )
    return;

  let [token0, token1] = await Promise.all([
    context.Token.get(pool.token0_id),
    context.Token.get(pool.token1_id),
  ]);

  if (token0 && token1) {
    // amounts - 0/1 are token deltas: can be positive or negative
    const amount0 = convertTokenToDecimal(
      event.params.amount0,
      token0.decimals
    );
    const amount1 = convertTokenToDecimal(
      event.params.amount1,
      token1.decimals
    );

    // need absolute amounts for volume
    let amount0Abs = amount0;
    if (amount0.lt(ZERO_BD)) {
      amount0Abs = amount0.times(BigDecimal("-1"));
    }
    let amount1Abs = amount1;
    if (amount1.lt(ZERO_BD)) {
      amount1Abs = amount1.times(BigDecimal("-1"));
    }

    const amount0ETH = amount0Abs.times(token0.derivedETH);
    const amount1ETH = amount1Abs.times(token1.derivedETH);
    const amount0USD = amount0ETH.times(bundle.ethPriceUSD);
    const amount1USD = amount1ETH.times(bundle.ethPriceUSD);

    // get amount that should be tracked only - div 2 because cant count both input and output as volume
    const amountTotalUSDTracked = getTrackedAmountUSD(
      amount0Abs,
      token0,
      amount1Abs,
      token1,
      whitelistTokens,
      bundle
    ).div(BigDecimal("2"));
    const amountTotalETHTracked = safeDiv(
      amountTotalUSDTracked,
      bundle.ethPriceUSD
    );
    const amountTotalUSDUntracked = amount0USD
      .plus(amount1USD)
      .div(BigDecimal("2"));

    const feesETH = amountTotalETHTracked
      .times(BigDecimal(pool.feeTier.toString()))
      .div(BigDecimal("1000000"));
    const feesUSD = amountTotalUSDTracked
      .times(BigDecimal(pool.feeTier.toString()))
      .div(BigDecimal("1000000"));

    // reset aggregate tvl before individual pool tvl updates
    const currentPoolTvlETH = pool.totalValueLockedETH;

    factory = {
      ...factory,
      txCount: factory.txCount + ONE_BI,
      totalVolumeETH: factory.totalVolumeETH.plus(amountTotalETHTracked),
      totalVolumeUSD: factory.totalVolumeUSD.plus(amountTotalUSDTracked),
      untrackedVolumeUSD: factory.untrackedVolumeUSD.plus(
        amountTotalUSDUntracked
      ),
      totalFeesETH: factory.totalFeesETH.plus(feesETH),
      totalFeesUSD: factory.totalFeesUSD.plus(feesUSD),
      totalValueLockedETH: factory.totalValueLockedETH.minus(currentPoolTvlETH),
    };

    pool = {
      ...pool,
      txCount: pool.txCount + ONE_BI,
      volumeToken0: pool.volumeToken0.plus(amount0Abs),
      volumeToken1: pool.volumeToken1.plus(amount1Abs),
      volumeUSD: pool.volumeUSD.plus(amountTotalUSDTracked),
      untrackedVolumeUSD: pool.untrackedVolumeUSD.plus(amountTotalUSDUntracked),
      feesUSD: pool.feesUSD.plus(feesUSD),
      liquidity: event.params.liquidity,
      tick: event.params.tick,
      sqrtPrice: event.params.sqrtPriceX96,
      totalValueLockedToken0: pool.totalValueLockedToken0.plus(amount0),
      totalValueLockedToken1: pool.totalValueLockedToken1.plus(amount1),
    };

    token0 = {
      ...token0,
      volume: token0.volume.plus(amount0Abs),
      totalValueLocked: token0.totalValueLocked.plus(amount0),
      volumeUSD: token0.volumeUSD.plus(amountTotalUSDTracked),
      untrackedVolumeUSD: token0.untrackedVolumeUSD.plus(
        amountTotalUSDUntracked
      ),
      feesUSD: token0.feesUSD.plus(feesUSD),
      txCount: token0.txCount + ONE_BI,
    };

    token1 = {
      ...token1,
      volume: token1.volume.plus(amount1Abs),
      totalValueLocked: token1.totalValueLocked.plus(amount1),
      volumeUSD: token1.volumeUSD.plus(amountTotalUSDTracked),
      untrackedVolumeUSD: token1.untrackedVolumeUSD.plus(
        amountTotalUSDUntracked
      ),
      feesUSD: token1.feesUSD.plus(feesUSD),
      txCount: token1.txCount + ONE_BI,
    };

    // updated pool ratess
    const prices = sqrtPriceX96ToTokenPrices(pool.sqrtPrice, token0, token1);

    pool = {
      ...pool,
      token0Price: prices[0],
      token1Price: prices[1],
    };

    context.Pool.set(pool);

    const stablecoinWrappedNativePoolId = getId(
      stablecoinWrappedNativePoolAddress,
      event.chainId
    );

    let stablecoinWrappedNativePool = await context.Pool.get(
      stablecoinWrappedNativePoolId
    );

    bundle = {
      ...bundle,
      ethPriceUSD: getNativePriceInUSD(
        stablecoinIsToken0,
        stablecoinWrappedNativePool
      ),
    };

    context.Bundle.set(bundle);

    const [token0DerivedEth, token1DerivedEth, transaction] = await Promise.all(
      [
        findNativePerToken(
          token0,
          wrappedNativeAddress,
          stablecoinAddresses,
          minimumNativeLocked,
          bundle,
          event.chainId,
          context
        ),
        findNativePerToken(
          token1,
          wrappedNativeAddress,
          stablecoinAddresses,
          minimumNativeLocked,
          bundle,
          event.chainId,
          context
        ),
        loadTransaction(
          event.transaction.hash,
          event.block.number,
          event.block.timestamp,
          event.chainId,
          context
        ),
      ]
    );

    token0 = {
      ...token0,
      derivedETH: token0DerivedEth,
    };

    token1 = {
      ...token1,
      derivedETH: token1DerivedEth,
    };

    /**
     * Things afffected by new USD rates
     */
    pool = {
      ...pool,
      totalValueLockedETH: pool.totalValueLockedToken0
        .times(token0.derivedETH)
        .plus(pool.totalValueLockedToken1.times(token1.derivedETH)),
    };

    pool = {
      ...pool,
      totalValueLockedUSD: pool.totalValueLockedETH.times(bundle.ethPriceUSD),
    };

    factory = {
      ...factory,
      totalValueLockedETH: factory.totalValueLockedETH.plus(
        pool.totalValueLockedETH
      ),
    };

    factory = {
      ...factory,
      totalValueLockedUSD: factory.totalValueLockedETH.times(
        bundle.ethPriceUSD
      ),
    };

    token0 = {
      ...token0,
      totalValueLockedUSD: token0.totalValueLocked
        .times(token0.derivedETH)
        .times(bundle.ethPriceUSD),
    };

    token1 = {
      ...token1,
      totalValueLockedUSD: token1.totalValueLocked
        .times(token1.derivedETH)
        .times(bundle.ethPriceUSD),
    };

    // create Swap event
    let swap: Swap = {
      id:
        transaction.transactionHash +
        "-" +
        event.logIndex.toString() +
        "-" +
        event.chainId.toString(),
      transaction_id: transaction.id,
      chainId: event.chainId,
      timestamp: BigInt(transaction.timestamp),
      pool_id: pool.id,
      token0_id: pool.token0_id,
      token1_id: pool.token1_id,
      sender: event.params.sender,
      origin: event.transaction.from,
      recipient: event.params.recipient,
      amount0: amount0,
      amount1: amount1,
      amountUSD: amountTotalUSDTracked,
      tick: event.params.tick,
      sqrtPriceX96: event.params.sqrtPriceX96,
      logIndex: event.logIndex,
    };

    const poolAddress = getFromId(pool.id).address;
    const token0Address = getFromId(token0.id).address;
    const token1Address = getFromId(token1.id).address;

    // Get ID's for interval updates
    const dayID = getDayID(event.block.timestamp);
    const dayPoolID = poolAddress
      .concat("-")
      .concat(dayID.toString())
      .concat("-")
      .concat(event.chainId.toString());
    const hourIndex = getHourIndex(event.block.timestamp); // get unique hour within unix history
    const hourPoolID = poolAddress
      .concat("-")
      .concat(hourIndex.toString())
      .concat("-")
      .concat(event.chainId.toString());
    const token0DayID = token0Address
      .concat("-")
      .concat(dayID.toString())
      .concat("-")
      .concat(event.chainId.toString());
    const token1DayID = token1Address
      .concat("-")
      .concat(dayID.toString())
      .concat("-")
      .concat(event.chainId.toString());
    const token0HourID = token0Address
      .concat("-")
      .concat(hourIndex.toString())
      .concat("-")
      .concat(event.chainId.toString());
    const token1HourID = token1Address
      .concat("-")
      .concat(hourIndex.toString())
      .concat("-")
      .concat(event.chainId.toString());

    let [
      _uniswapDayData,
      _poolDayData,
      _poolHourData,
      _token0DayData,
      _token1DayData,
      _token0HourData,
      _token1HourData,
    ] = await Promise.all([
      context.UniswapDayData.get(
        dayID.toString().concat("-").concat(event.chainId.toString())
      ),
      context.PoolDayData.get(dayPoolID),
      context.PoolHourData.get(hourPoolID),
      context.TokenDayData.get(token0DayID),
      context.TokenDayData.get(token1DayID),
      context.TokenHourData.get(token0HourID),
      context.TokenHourData.get(token1HourID),
    ]);

    // Update feeGrowth
    let feeGrowthGlobal0X128: bigint | undefined = undefined;
    let feeGrowthGlobal1X128: bigint | undefined = undefined;

    if (!_poolHourData) {
      const updatedFeeGrowth = await updateFeeGrowthGlobal(
        event.srcAddress as Address,
        event.chainId,
        event.block.number,
        pool
      );
      feeGrowthGlobal0X128 = updatedFeeGrowth.feeGrowthGlobal0X128;
      feeGrowthGlobal1X128 = updatedFeeGrowth.feeGrowthGlobal1X128;
      pool = updatedFeeGrowth.pool;
    }

    let uniswapDayData = updateUniswapDayData(
      dayID,
      factory,
      _uniswapDayData,
      event.chainId,
      context
    );
    let poolDayData = updatePoolDayData(
      dayID,
      pool,
      _poolDayData,
      feeGrowthGlobal0X128,
      feeGrowthGlobal1X128,
      event.chainId,
      context
    );
    let poolHourData = updatePoolHourData(
      event.block.timestamp,
      pool,
      _poolHourData,
      feeGrowthGlobal0X128,
      feeGrowthGlobal1X128,
      event.chainId,
      context
    );
    let token0DayData = updateTokenDayData(
      token0,
      bundle,
      dayID,
      _token0DayData,
      event.chainId,
      context
    );
    let token1DayData = updateTokenDayData(
      token1,
      bundle,
      dayID,
      _token1DayData,
      event.chainId,
      context
    );
    let token0HourData = updateTokenHourData(
      token0,
      bundle,
      event.block.timestamp,
      _token0HourData,
      event.chainId,
      context
    );
    let token1HourData = updateTokenHourData(
      token1,
      bundle,
      event.block.timestamp,
      _token1HourData,
      event.chainId,
      context
    );

    // update volume metrics
    uniswapDayData = {
      ...uniswapDayData,
      volumeETH: uniswapDayData.volumeETH.plus(amountTotalETHTracked),
      volumeUSD: uniswapDayData.volumeUSD.plus(amountTotalUSDTracked),
      feesUSD: uniswapDayData.feesUSD.plus(feesUSD),
    };

    poolDayData = {
      ...poolDayData,
      volumeUSD: poolDayData.volumeUSD.plus(amountTotalUSDTracked),
      volumeToken0: poolDayData.volumeToken0.plus(amount0Abs),
      volumeToken1: poolDayData.volumeToken1.plus(amount1Abs),
      feesUSD: poolDayData.feesUSD.plus(feesUSD),
    };

    poolHourData = {
      ...poolHourData,
      volumeUSD: poolHourData.volumeUSD.plus(amountTotalUSDTracked),
      volumeToken0: poolHourData.volumeToken0.plus(amount0Abs),
      volumeToken1: poolHourData.volumeToken1.plus(amount1Abs),
      feesUSD: poolHourData.feesUSD.plus(feesUSD),
    };

    token0DayData = {
      ...token0DayData,
      volume: token0DayData.volume.plus(amount0Abs),
      volumeUSD: token0DayData.volumeUSD.plus(amountTotalUSDTracked),
      untrackedVolumeUSD: token0DayData.untrackedVolumeUSD.plus(
        amountTotalUSDUntracked
      ),
      feesUSD: token0DayData.feesUSD.plus(feesUSD),
    };

    token0HourData = {
      ...token0HourData,
      volume: token0HourData.volume.plus(amount0Abs),
      volumeUSD: token0HourData.volumeUSD.plus(amountTotalUSDTracked),
      untrackedVolumeUSD: token0HourData.untrackedVolumeUSD.plus(
        amountTotalUSDUntracked
      ),
      feesUSD: token0HourData.feesUSD.plus(feesUSD),
    };

    token1DayData = {
      ...token1DayData,
      volume: token1DayData.volume.plus(amount1Abs),
      volumeUSD: token1DayData.volumeUSD.plus(amountTotalUSDTracked),
      untrackedVolumeUSD: token1DayData.untrackedVolumeUSD.plus(
        amountTotalUSDUntracked
      ),
      feesUSD: token1DayData.feesUSD.plus(feesUSD),
    };

    token1HourData = {
      ...token1HourData,
      volume: token1HourData.volume.plus(amount1Abs),
      volumeUSD: token1HourData.volumeUSD.plus(amountTotalUSDTracked),
      untrackedVolumeUSD: token1HourData.untrackedVolumeUSD.plus(
        amountTotalUSDUntracked
      ),
      feesUSD: token1HourData.feesUSD.plus(feesUSD),
    };

    // Save Changes
    context.Swap.set(swap);
    context.TokenDayData.set(token0DayData);
    context.TokenDayData.set(token1DayData);
    context.UniswapDayData.set(uniswapDayData);
    context.PoolDayData.set(poolDayData);
    context.PoolHourData.set(poolHourData);
    context.TokenHourData.set(token0HourData);
    context.TokenHourData.set(token1HourData);
    context.PoolHourData.set(poolHourData);
    context.Factory.set(factory);
    context.Pool.set(pool);
    context.Token.set(token0);
    context.Token.set(token1);
  }
});
