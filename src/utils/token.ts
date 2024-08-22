import { isAddress } from "viem";
import {
  getStaticDefinition,
  StaticTokenDefinition,
} from "./staticTokenDefinition";
import { publicClients } from "./viem";
import { erc20Abi } from "./abis";

export async function fetchTokenSymbol(
  address: string,
  tokenOverrides: StaticTokenDefinition[],
  chainId: keyof typeof publicClients
): Promise<string> {
  // try with the static definition
  const staticTokenDefinition = getStaticDefinition(address, tokenOverrides);
  if (staticTokenDefinition != null) {
    return staticTokenDefinition.symbol;
  }

  if (!isAddress(address)) return "UNKNOWN";

  try {
    const symbol = (await publicClients[chainId].readContract({
      address,
      abi: erc20Abi,
      functionName: "symbol",
    })) as string;

    return symbol ?? "UNKNOWN";
  } catch (error) {
    return "UNKNOWN";
  }
}

export async function fetchTokenName(
  address: string,
  tokenOverrides: StaticTokenDefinition[],
  chainId: keyof typeof publicClients
): Promise<string> {
  // try with the static definition
  console.log("Fetching Token Name");
  const staticTokenDefinition = getStaticDefinition(address, tokenOverrides);
  if (staticTokenDefinition != null) {
    return staticTokenDefinition.name;
  }

  if (!isAddress(address)) return "UNKNOWN";

  try {
    const name = (await publicClients[chainId].readContract({
      address,
      abi: erc20Abi,
      functionName: "name",
    })) as string;

    return name ?? "UNKNOWN";
  } catch (error) {
    return "UNKNOWN";
  }
}

export async function fetchTokenTotalSupply(
  address: string,
  tokenOverrides: StaticTokenDefinition[],
  chainId: keyof typeof publicClients
): Promise<bigint> {
  // try with the static definition
  const staticTokenDefinition = getStaticDefinition(address, tokenOverrides);
  if (staticTokenDefinition && staticTokenDefinition.totalSupply) {
    return staticTokenDefinition.totalSupply;
  }

  if (!isAddress(address)) return 0n;

  try {
    const totalSupply = (await publicClients[chainId].readContract({
      address,
      abi: erc20Abi,
      functionName: "totalSupply",
    })) as bigint;

    return totalSupply ?? 0n;
  } catch (error) {
    return 0n;
  }
}

export async function fetchTokenDecimals(
  address: string,
  tokenOverrides: StaticTokenDefinition[],
  chainId: keyof typeof publicClients
): Promise<number | null> {
  // try with the static definition
  const staticTokenDefinition = getStaticDefinition(address, tokenOverrides);
  if (staticTokenDefinition) {
    return staticTokenDefinition.decimals;
  }

  if (!isAddress(address)) return null;

  try {
    const decimals = await publicClients[chainId].readContract({
      address,
      abi: erc20Abi,
      functionName: "decimals",
    });

    if (!decimals && decimals !== 0) return null;

    return decimals;
  } catch (error) {
    console.log(`Problem getting decimals for ${address}`);
    return null;
  }
}
