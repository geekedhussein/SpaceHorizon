// Reading a saved design's id out of a page address. Pure, so it is tested
// without a browser.

/** The saved design id in the page address (`#design=<id>`), if there is one. */
export function designIdFromLink(hash: string): string | null {
  const match = /^#design=([A-Za-z0-9_-]{1,64})$/.exec(hash)
  return match ? match[1] : null
}
