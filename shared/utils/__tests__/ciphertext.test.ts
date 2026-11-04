import {
  CiphertextFormatError,
  formatEnvelope,
  fromB64Url,
  isEnvelope,
  parseEnvelope,
  toB64Url,
} from "../ciphertext";

const s1 = "f";
const s2 = "fo";
const s3 = "foo";
const s4 = "foobar";
const empty = "";

const randomArray = (l: number) => {
  const arr = new Uint8Array(l);
  arr.forEach((_, i) => (arr[i] = Math.floor(Math.random() * 255)));
  return arr;
};

describe("B64Url roundtrips from 0 to 40 bytes to work", () => {
  for (let i = 0; i < 40; i++) {
    const arr = randomArray(i);
    expect(fromB64Url(toB64Url(arr))).toEqual(arr);
  }
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
  });
});

describe("isEnvelope", () => {
  it("rejects non strings", () => {
    expect(isEnvelope(null)).toBe(false);
    expect(isEnvelope({})).toBe(false);
    expect(isEnvelope(1)).toBe(false);
  });
});
