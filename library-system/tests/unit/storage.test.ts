import { describe, expect, it } from "vitest";
import { saveState, StorageWriteError } from "../../src/store/storage";
import { DEFAULT_STATE } from "../../src/store/schema";

describe("storage saveState", () => {
  it("throws StorageWriteError when storage quota is exceeded", () => {
    let writes = 0;
    const storage = {
      getItem: () => null,
      setItem: () => {
        writes += 1;
        if (writes === 2) {
          const err = new Error("quota");
          // @ts-expect-error test shim
          err.name = "QuotaExceededError";
          throw err;
        }
      }
    };

    expect(() => saveState(DEFAULT_STATE, storage)).toThrow(StorageWriteError);
  });
});
