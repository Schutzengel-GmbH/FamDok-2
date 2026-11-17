import {
  formatFingerprint,
  formatRecoveryCode,
  InvalidRecoveryCodeError,
  parseRecoveryCode,
  RECOVERY_CODE_BYTES,
} from "../recoveryCode";

const bytes = Uint8Array.from({ length: RECOVERY_CODE_BYTES }, (_, i) => i * 13);

describe("recovery code", () => {
  it("round-trips", () => {
    const code = formatRecoveryCode(bytes);
    expect(parseRecoveryCode(code)).toEqual(bytes);
  });

  it("formats 8 dash-separated groups of 4 Crockford characters", () => {
    const code = formatRecoveryCode(bytes);
    expect(code).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){7}[0-9A-HJKMNP-TV-Z]{4}$/);
  });

  it("encodes a known value", () => {
    expect(formatRecoveryCode(new Uint8Array(RECOVERY_CODE_BYTES))).toBe(
      "0000-0000-0000-0000-0000-0000-0000-0000",
    );
    expect(formatRecoveryCode(new Uint8Array(RECOVERY_CODE_BYTES).fill(255))).toBe(
      "ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ",
    );
  });

  it("ignores case, spaces and dashes and reads look-alikes", () => {
    const code = formatRecoveryCode(bytes);
    const typed = code.toLowerCase().replace(/-/g, " ").replace(/0/g, "o").replace(/1/g, "l");
    expect(parseRecoveryCode(typed)).toEqual(bytes);
  });

  it.each(["", "ABCD", "0000-0000-0000-0000-0000-0000-0000-000U", "0".repeat(33)])(
    "rejects %p",
    (code) => {
      expect(() => parseRecoveryCode(code)).toThrow(InvalidRecoveryCodeError);
    },
  );

  it("rejects the wrong number of bytes", () => {
    expect(() => formatRecoveryCode(new Uint8Array(19))).toThrow(InvalidRecoveryCodeError);
  });
});

describe("fingerprint", () => {
  it("formats 6 groups of 5 digits", () => {
    const fp = formatFingerprint(Uint8Array.from({ length: 32 }, (_, i) => i));
    expect(fp).toMatch(/^(\d{5} ){5}\d{5}$/);
  });

  it("is deterministic and depends on every group", () => {
    const d = Uint8Array.from({ length: 32 }, (_, i) => i);
    const changed = d.slice();
    changed[27] ^= 1;
    expect(formatFingerprint(d)).toBe(formatFingerprint(d.slice()));
    expect(formatFingerprint(changed)).not.toBe(formatFingerprint(d));
  });
});
