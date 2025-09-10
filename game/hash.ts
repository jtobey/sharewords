/**
 * @file A simple, insecure string hash function.
 */

/**
 * Computes the djb2 hash of a given string.
 * @param str - The input string to hash.
 * @returns The computed hash value.
 */
export function djb2Hash(str: string): number {
    let hash = 5381; // Initial hash value
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 33) ^ str.charCodeAt(i); // Hashing logic
    }
    return hash >>> 0; // Ensure a positive integer
}
