// @ts-check

export const GARDEN_SIGNAL_THRESHOLD = 3;
export const GARDEN_DISCOVERY_HASH = "#garden-signal";
export const GARDEN_DISCOVERY_URL = `/about/${GARDEN_DISCOVERY_HASH}`;

/** @param {string} hash */
export const isGardenDiscoveryHash = (hash) => hash.toLowerCase() === GARDEN_DISCOVERY_HASH;
