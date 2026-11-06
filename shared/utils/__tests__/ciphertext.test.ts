import {
  buildAad,
  buildGrantInfo,
  buildRecoveryAad,
  envelopeKeyVersion,
  formatBytesEnvelope,
  formatGrant,
  formatRecoveryWrappedKey,
  isBytesEnvelope,
  isGrant,
  isP256PublicKey,
  isRecoveryWrappedKey,
  parseBytesEnvelope,
  parseGrant,
  parseRecoveryWrappedKey,
  CiphertextFormatError,
  formatEnvelope,
  formatWrappedPrivateKey,
  fromB64Url,
  isEnvelope,
  isWrappedPrivKey,
  parseEnvelope,
  parseWrappedPrivateKey,
  toB64Url,
} from "../ciphertext";

const s1 = "f";
const s2 = "fo";
const s3 = "foo";
const s4 = "foobar";
const empty = "";

const randomArray = (l: number) => {
  const arr = new Uint8Array(l);
  arr.forEach((_, i) => (arr[i] = Math.floor(Math.random() * 256)));
  return arr;
};

describe("B64", () => {
  it("roundtrips", () => {
    for (let i = 0; i <= 40; i++) {
      const arr = randomArray(i);
      expect(fromB64Url(toB64Url(arr))).toEqual(arr);
    }
  });
});

describe("toB64Url", () => {
  it("encodes correctly", () => {
    expect(toB64Url(Buffer.from(s1))).toEqual("Zg");
    expect(toB64Url(Buffer.from(s2))).toEqual("Zm8");
    expect(toB64Url(Buffer.from(s3))).toEqual("Zm9v");
    expect(toB64Url(Buffer.from(s4))).toEqual("Zm9vYmFy");
    expect(toB64Url(Buffer.from(empty))).toEqual("");
  });

  it("uses -_ instead of +/", () => {
    expect(toB64Url(Buffer.from([0xfb, 0xff]))).toBe("-_8");
  });
});

describe("fromB64Url", () => {
  it("decodes correctly", () => {
    expect(fromB64Url("Zg")).toEqual(Buffer.from(s1));
    expect(fromB64Url("Zm8")).toEqual(Buffer.from(s2));
    expect(fromB64Url("Zm9v")).toEqual(Buffer.from(s3));
    expect(fromB64Url("Zm9vYmFy")).toEqual(Buffer.from(s4));
    expect(fromB64Url("")).toEqual(Buffer.from(empty));
  });

  it("throws CiphertextFormatError on illegal characters", () => {
    expect(() => fromB64Url("Zg==")).toThrow(CiphertextFormatError);
    expect(() => fromB64Url("ab+c")).toThrow(CiphertextFormatError);
  });

  it("throws CiphertextFormatError on string length % 4 === 1", () => {
    expect(() => fromB64Url("abcde")).toThrow(CiphertextFormatError);
  });
});

describe("formatEnvelope", () => {
  it("roundtrips", () => {
    const data = {
      keyVersion: 1,
      iv: "abcdABCDabcdABCD",
      ct: "abcdABCDabcdABCDabcdABCD",
    };
    expect(
      parseEnvelope(formatEnvelope(data.keyVersion, data.iv, data.ct)),
    ).toEqual(data);
  });

  it("throws CiphertextFormatError on bad inputs", () => {
    // bad version
    expect(() =>
      formatEnvelope(-1, "abcdABCDabcdABCD", "abcdABCDabcdABCDabcdABCD"),
    ).toThrow(CiphertextFormatError);
    // wrong iv length
    expect(() => formatEnvelope(1, "123", "abcdABCDabcdABCDabcdABCD")).toThrow(
      CiphertextFormatError,
    );
    // no/short ct
    expect(() => formatEnvelope(1, "abcdABCDabcdABCD", "")).toThrow(
      CiphertextFormatError,
    );
    expect(() => formatEnvelope(1, "abcdABCDabcdABCD", "123")).toThrow(
      CiphertextFormatError,
    );
  });
});

describe("parseEnvelope", () => {
  it("throws CiphertextFormatError on bad inputs", () => {
    // empty string
    expect(() => parseEnvelope("")).toThrow(CiphertextFormatError);
    // too many parts
    expect(() =>
      parseEnvelope("v1.1.abcdABCDabcdABCD.abcdABCDabcdABCDabcdABCD.extra"),
    ).toThrow(CiphertextFormatError);
    // bad version
    expect(() =>
      parseEnvelope("v2.1.abcdABCDabcdABCD.abcdABCDabcdABCDabcdABCD"),
    ).toThrow(CiphertextFormatError);
    // bad key version
    expect(() =>
      parseEnvelope("v1.01.abcdABCDabcdABCD.abcdABCDabcdABCDabcdABCD"),
    ).toThrow(CiphertextFormatError);
    // bad ct
    expect(() => parseEnvelope("v1.1.abcdABCDabcdABCD.abcd")).toThrow(
      CiphertextFormatError,
    );
    // leading space
    expect(() =>
      parseEnvelope(" v1.1.abcdABCDabcdABCD.abcdABCDabcdABCDabcdABCD"),
    ).toThrow(CiphertextFormatError);
    // wrong iv length
    expect(() =>
      parseEnvelope("v1.1.abcdABCDabcdABC.abcdABCDabcdABCDabcdABCD"),
    ).toThrow(CiphertextFormatError);
  });
});

describe("buildAad", () => {
  it("builds aad", () => {
    expect(buildAad({ table: "table", rowId: "row", field: "field" })).toEqual(
      "table:row:field",
    );
  });
  it("throws on empty strings", () => {
    expect(() =>
      buildAad({
        table: "",
        rowId: "row",
        field: "field",
      }),
    ).toThrow(CiphertextFormatError);
  });
  it("throws when encountering :", () => {
    expect(() =>
      buildAad({ table: "a:b", rowId: "row", field: "field" }),
    ).toThrow(CiphertextFormatError);
  });
});

describe("isEnvelope", () => {
  it("accepts proper envelope", () => {
    expect(
      isEnvelope("v1.1.abcdABCDabcdABCD.abcdABCDabcdABCDabcdABCDabcdABCD"),
    ).toBe(true);
  });
  it("rejects non strings", () => {
    expect(isEnvelope(null)).toBe(false);
    expect(isEnvelope({})).toBe(false);
    expect(isEnvelope(1)).toBe(false);
  });

  describe("wrapped private key (k1)", () => {
    const iv = "AAECAwQFBgcICQoL"; // 12 bytes
    const ct = "A".repeat(22);

    it("round-trips", () => {
      const s = formatWrappedPrivateKey(iv, ct);
      expect(s).toBe(`k1.${iv}.${ct}`);
      expect(parseWrappedPrivateKey(s)).toEqual({ iv, ct });
    });

    it.each([
      "",
      "k1..",
      `k2.${iv}.${ct}`,
      `v1.3.${iv}.${ct}`,
      `k1.${iv}A.${ct}`,
      `k1.${iv}.${ct.slice(1)}`,
      `k1.${iv}.${ct}.x`,
      `k1.${iv}.${ct}+`,
    ])("rejects %p", (s) => {
      expect(isWrappedPrivKey(s)).toBe(false);
      expect(() => parseWrappedPrivateKey(s)).toThrow(CiphertextFormatError);
    });

    it("format rejects a too-short ct", () => {
      expect(() => formatWrappedPrivateKey(iv, "A".repeat(21))).toThrow(
        CiphertextFormatError,
      );
    });
  });
});

describe("grants (g1)", () => {
  const enc = "B" + "A".repeat(86);
  const ct = "A".repeat(64);

  it("round-trips", () => {
    const g = formatGrant(enc, ct);
    expect(g).toBe(`g1.${enc}.${ct}`);
    expect(g.length).toBe(155);
    expect(parseGrant(g)).toEqual({ enc, ct });
  });

  it.each([
    "",
    `g2.${enc}.${ct}`,
    `g1.${enc.slice(1)}.${ct}`,
    `g1.${enc}A.${ct}`,
    `g1.${enc}.${ct.slice(1)}`,
    `g1.${enc}.${ct}A`,
    `g1.${enc}.${ct.slice(1)}!`,
    `g1.${enc}.${ct}.x`,
  ])("rejects %p", (s) => {
    expect(isGrant(s)).toBe(false);
    expect(() => parseGrant(s)).toThrow(CiphertextFormatError);
  });

  it("builds the info string", () => {
    expect(buildGrantInfo({ orgId: "org-1", keyVersion: 2 })).toBe(
      "famdok-grant-v1:org-1:2",
    );
  });

  it.each([
    { orgId: "", keyVersion: 1 },
    { orgId: "a:b", keyVersion: 1 },
    { orgId: "org", keyVersion: -1 },
    { orgId: "org", keyVersion: 1.5 },
  ])("rejects context %p", (ctx) => {
    expect(() => buildGrantInfo(ctx)).toThrow(CiphertextFormatError);
    expect(() => buildRecoveryAad(ctx)).toThrow(CiphertextFormatError);
  });
});

describe("recovery-wrapped key (r1)", () => {
  const iv = "AAECAwQFBgcICQoL";
  const ct = "A".repeat(64);

  it("round-trips", () => {
    const s = formatRecoveryWrappedKey(4, iv, ct);
    expect(parseRecoveryWrappedKey(s)).toEqual({ keyVersion: 4, iv, ct });
    expect(buildRecoveryAad({ orgId: "o", keyVersion: 4 })).toBe(
      "famdok-recovery-v1:o:4",
    );
  });

  it.each(["", `r1.x.${iv}.${ct}`, `r1.1.${iv}.${ct.slice(1)}`, `r1.01.${iv}.${ct}`])(
    "rejects %p",
    (s) => {
      expect(isRecoveryWrappedKey(s)).toBe(false);
      expect(() => parseRecoveryWrappedKey(s)).toThrow(CiphertextFormatError);
    },
  );
});

describe("envelopeKeyVersion", () => {
  it("reads the version of an envelope", () => {
    expect(
      envelopeKeyVersion("v1.12.abcdABCDabcdABCD.abcdABCDabcdABCDabcdABCD"),
    ).toBe(12);
  });
  it("is undefined for anything else", () => {
    expect(envelopeKeyVersion("plain text")).toBeUndefined();
    expect(envelopeKeyVersion(null)).toBeUndefined();
  });
  it("rejects key versions with more than 9 digits", () => {
    expect(
      isEnvelope("v1.1234567890.abcdABCDabcdABCD.abcdABCDabcdABCDabcdABCD"),
    ).toBe(false);
  });
});

describe("bytes envelope", () => {
  const iv = Uint8Array.from({ length: 12 }, (_, i) => i);
  const ct = Uint8Array.from({ length: 40 }, (_, i) => 255 - i);

  it("round-trips", () => {
    const b = formatBytesEnvelope(7, iv, ct);
    expect(isBytesEnvelope(b)).toBe(true);
    expect(Array.from(b.slice(0, 4))).toEqual([0x46, 0x44, 0x4b, 0x31]);
    expect(parseBytesEnvelope(b)).toEqual({ keyVersion: 7, iv, ct });
  });

  it("parses a subarray with an offset", () => {
    const b = formatBytesEnvelope(7, iv, ct);
    const padded = new Uint8Array(b.length + 3);
    padded.set(b, 3);
    expect(parseBytesEnvelope(padded.subarray(3)).keyVersion).toBe(7);
  });

  it("rejects plain bytes", () => {
    expect(isBytesEnvelope(new TextEncoder().encode("%PDF-1.7 ......................................"))).toBe(false);
    expect(() => parseBytesEnvelope(new Uint8Array(10))).toThrow(CiphertextFormatError);
  });

  it("rejects bad parts", () => {
    expect(() => formatBytesEnvelope(-1, iv, ct)).toThrow(CiphertextFormatError);
    expect(() => formatBytesEnvelope(1, iv.slice(1), ct)).toThrow(CiphertextFormatError);
    expect(() => formatBytesEnvelope(1, iv, ct.slice(0, 15))).toThrow(CiphertextFormatError);
  });
});

describe("isP256PublicKey", () => {
  const prefix = [
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
    0x04,
  ];
  const key = new Uint8Array(91);
  key.set(prefix);
  key.fill(7, prefix.length);

  it("accepts an uncompressed P-256 SPKI", () => {
    expect(isP256PublicKey(toB64Url(key))).toBe(true);
  });

  it("rejects other curves, compressed points and garbage", () => {
    const other = key.slice();
    other[20] = 0x22;
    expect(isP256PublicKey(toB64Url(other))).toBe(false);
    expect(isP256PublicKey(toB64Url(key.slice(0, 60)))).toBe(false);
    expect(isP256PublicKey("A".repeat(122))).toBe(false);
    expect(isP256PublicKey("!".repeat(122))).toBe(false);
    expect(isP256PublicKey(42)).toBe(false);
  });
});
