import { lookup as dnsLookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

type LookupAddress = { address: string; family: number };
export type LookupAll = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<LookupAddress[]>;

const blockedAddresses = new BlockList();

for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blockedAddresses.addSubnet(network, prefix, 'ipv4');
}

for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
] as const) {
  blockedAddresses.addSubnet(network, prefix, 'ipv6');
}

function unwrapIpv4MappedAddress(address: string): string {
  const match = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address);
  return match?.[1] ?? address;
}

export function normalizeHttpUrl(input: string): URL {
  const value = input.trim();
  if (!value) throw new Error('Enter a URL to save.');

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Enter a complete URL starting with http:// or https://.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http:// and https:// URLs can be saved.');
  }
  if (url.username || url.password) {
    throw new Error('URLs containing credentials cannot be saved.');
  }

  url.hash = '';
  return url;
}

export function isDisallowedAddress(address: string): boolean {
  const candidate = unwrapIpv4MappedAddress(address);
  const family = isIP(candidate);
  if (family === 4) return blockedAddresses.check(candidate, 'ipv4');
  if (family === 6) return blockedAddresses.check(candidate, 'ipv6');
  return true;
}

export async function assertPublicDestination(
  url: URL,
  lookup: LookupAll = dnsLookup,
): Promise<void> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('The URL resolves to a private or reserved address.');
  }

  const directFamily = isIP(hostname);
  const addresses = directFamily
    ? [{ address: hostname, family: directFamily }]
    : await lookup(hostname, { all: true, verbatim: true });

  if (addresses.length === 0 || addresses.some(({ address }) => isDisallowedAddress(address))) {
    throw new Error('The URL resolves to a private or reserved address.');
  }
}
