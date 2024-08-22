// import { Pool } from "generated";
// import { Address } from ".";
// import { poolAbi } from "./abis";
// import { ARBITRUM_MAINNET_ID, ETH_MAINNET_ID } from "./constants";
// import { publicClients } from "./viem";

// export async function updateFeeGrowthGlobal(
//   poolAddress: Address,
//   chainId: number,
//   blockNumber: number,
//   pool: Pool
// ) {
//   let feeGrowthGlobal0X128: bigint | undefined = undefined;
//   let feeGrowthGlobal1X128: bigint | undefined = undefined;

//   const poolContract = {
//     address: poolAddress,
//     abi: poolAbi,
//   } as const;

//   // As ETH mainnet doesn't have multicall, we need to make separate calls
//   if (
//     (chainId === ETH_MAINNET_ID && blockNumber < 14353602) ||
//     (chainId === ARBITRUM_MAINNET_ID && blockNumber < 7654707)
//   ) {
//     [feeGrowthGlobal0X128, feeGrowthGlobal1X128] = await Promise.all([
//       publicClients[chainId as keyof typeof publicClients].readContract({
//         ...poolContract,
//         functionName: "feeGrowthGlobal0X128",
//       }),
//       publicClients[chainId as keyof typeof publicClients].readContract({
//         ...poolContract,
//         functionName: "feeGrowthGlobal1X128",
//       }),
//     ]);
//   } else {
//     const results = await publicClients[
//       chainId as keyof typeof publicClients
//     ].multicall({
//       contracts: [
//         {
//           ...poolContract,
//           functionName: "feeGrowthGlobal0X128",
//         },
//         {
//           ...poolContract,
//           functionName: "feeGrowthGlobal1X128",
//         },
//       ],
//       blockNumber: BigInt(blockNumber.toString()),
//     });

//     feeGrowthGlobal0X128 = results[0].result;
//     feeGrowthGlobal1X128 = results[1].result;
//   }

//   if (feeGrowthGlobal0X128) {
//     pool = {
//       ...pool,
//       feeGrowthGlobal0X128,
//     };
//   }

//   if (feeGrowthGlobal1X128) {
//     pool = {
//       ...pool,
//       feeGrowthGlobal1X128,
//     };
//   }

//   return { feeGrowthGlobal0X128, feeGrowthGlobal1X128, pool };
// }
