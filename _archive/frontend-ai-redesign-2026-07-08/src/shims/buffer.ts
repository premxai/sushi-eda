/**
 * Minimal browser-safe Buffer shim used only when the "buffer" package
 * is unavailable in restricted local environments.
 */
export const Buffer = {
  from(value: string | ArrayLike<number>) {
    if (typeof value === "string") {
      return new TextEncoder().encode(value);
    }
    return Uint8Array.from(value);
  },
};

const bufferShim = { Buffer };

export default bufferShim;
