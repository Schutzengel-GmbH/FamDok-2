export class CiphertextFormatError extends Error {}

const lookup =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const ENVELOPE_REGEX =
  /^v1\.(0|[1-9]\d*)\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$/;

export function toB64Url(bytes: Uint8Array): string {
  let output: string = "";
  let pos = 0;
  let done = false;

  do {
    // Take the next three elements or whatever is left
    const end = Math.min(pos + 3, bytes.length);
    const slice = bytes.slice(pos, end);

    // If one element is left, take the most significant 6 bits and the
    // zero-padded two most significant bits and append two padding characters
    if (slice.length === 1) {
      const i0 = slice[0] >> 2;
      const i1 = (slice[0] & 0b00000011) << 4;

      output = output.concat(lookup[i0], lookup[i1]);
    }

    // If two elements are left, take the most significant 6 bits of the first
    // element, glue the least significant two of the first and the most
    // significant four of the second element together and take the zero-padded
    // four least significant bits of the second element and append one padding
    // character
    if (slice.length === 2) {
      const i0 = slice[0] >> 2;
      const i1 =
        ((slice[0] & 0b00000011) << 4) | ((slice[1] & 0b11110000) >> 4);
      const i2 = (slice[1] & 0b00001111) << 2;

      output = output.concat(lookup[i0], lookup[i1], lookup[i2]);
    }

    // If there are three elements in the set to look at, spread the three
    // bytes fully to four six bit groups
    if (slice.length === 3) {
      const i0 = slice[0] >> 2;
      const i1 =
        ((slice[0] & 0b00000011) << 4) | ((slice[1] & 0b11110000) >> 4);
      const i2 =
        ((slice[1] & 0b00001111) << 2) | ((slice[2] & 0b11000000) >> 6);
      const i3 = slice[2] & 0b00111111;

      output = output.concat(lookup[i0], lookup[i1], lookup[i2], lookup[i3]);
    }

    pos += 3;
    done = end === bytes.length;
  } while (!done);

  return output;
}

export function fromB64Url(s: string): Uint8Array {
  // A base64 string must always conform to the character set
  if (!/^[A-Za-z0-9_-]*$/.test(s))
    throw new CiphertextFormatError("not a valid base64 string");
  // There is no padding, but a triplet can never result in one trailing char
  if (s.length % 4 === 1)
    throw new CiphertextFormatError("not a valid base64 string");

  let output = [] as number[];

  // take four characters at a time
  for (let i = 0; i < s.length; i += 4) {
    const end = i + 4;
    const slice = s.slice(i, end);

    // If there are two characters we take the (binary representation
    // of) the first character and the two most significant bits of the second.
    // The leftover should just be zero padding.
    if (slice.length === 2) {
      output.push(
        (lookup.indexOf(slice[0]) << 2) | (lookup.indexOf(slice[1]) >> 4),
      );
    }

    // If there are three character, we take the (binary representation
    // of) the first character and the two most significant bits of the second.
    // Then the four least significant bits of the second and the four most
    // significant from the third and finally the leftover should just be
    // zero padding.
    else if (slice.length === 3) {
      output.push(
        (lookup.indexOf(slice[0]) << 2) | (lookup.indexOf(slice[1]) >> 4),
      );
      output.push(
        ((lookup.indexOf(slice[1]) & 0b001111) << 4) |
          (lookup.indexOf(slice[2]) >> 2),
      );
    }

    // If there are four characters, we take the (binary representation
    // of) the first character, the two most significant bits of the second
    // the four least significant of the second and the four most significant
    // of the third and finally the two least significant og the third and
    // the fourth.
    else if (slice.length === 4) {
      output.push(
        (lookup.indexOf(slice[0]) << 2) | (lookup.indexOf(slice[1]) >> 4),
      );
      output.push(
        ((lookup.indexOf(slice[1]) & 0b001111) << 4) |
          (lookup.indexOf(slice[2]) >> 2),
      );
      output.push(
        ((lookup.indexOf(slice[2]) & 0b000011) << 6) | lookup.indexOf(slice[3]),
      );
    }
  }

  return new Uint8Array(output);
}

export type FieldContext = {
  table: string;
  rowId: string;
  field: string;
};

function validateFieldContext(ctx: FieldContext): boolean {
  return (
    ctx.table != "" &&
    ctx.field != "" &&
    ctx.rowId != "" &&
    !ctx.table.includes(":") &&
    !ctx.field.includes(":") &&
    !ctx.rowId.includes(":")
  );
}

export function buildAad(ctx: FieldContext): string {
  if (!validateFieldContext(ctx))
    throw new CiphertextFormatError("bad FieldContext");
  const { table, rowId, field } = ctx;
  return `${table}:${rowId}:${field}`;
}

export function formatEnvelope(
  keyVersion: number,
  iv: string,
  ct: string,
): string {
  const envelope = `v1.${keyVersion}.${iv}.${ct}`;
  if (!ENVELOPE_REGEX.test(envelope))
    throw new CiphertextFormatError("invalid envelope string");
  return envelope;
}

export function parseEnvelope(s: string): {
  keyVersion: number;
  iv: string;
  ct: string;
} {
  if (!isEnvelope(s))
    throw new CiphertextFormatError("invalid envelope string");
  const parts = s.split(".");
  return { keyVersion: parseInt(parts[1]), iv: parts[2], ct: parts[3] };
}

export function isEnvelope(x: unknown): boolean {
  return typeof x === "string" && ENVELOPE_REGEX.test(x);
}

const WRAPPED_PRIV_KEY_REGEX = /^k1\.<16 chars>\.<22+ chars>$/;

export function isWrappedPrivKey(x: unknown): boolean {
  return typeof x === "string" && WRAPPED_PRIV_KEY_REGEX.test(x);
}

export function formatWrappedPrivateKey(iv: string, ct: string): string {
  const wrapped = `k1.${iv}.${ct}`;
  if (!isWrappedPrivKey(wrapped))
    throw new CiphertextFormatError("invalid key");
  return wrapped;
}

export function parseWrappedPrivateKey(s: string): { iv: string; ct: string } {
  if (!isWrappedPrivKey(s))
    throw new CiphertextFormatError("invalid wrapped key");

  const parts = s.split(".");
  return { iv: parts[1], ct: parts[2] };
}
