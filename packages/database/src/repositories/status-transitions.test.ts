import { describe, expect, it } from "vitest";

import { InvalidAnalysisTransitionError } from "../errors.js";
import { assertAnalysisRunTransition } from "./status-transitions.js";

describe("analysis run status transitions", () => {
  it("allows pending and retry wait to become running", () => {
    expect(() => assertAnalysisRunTransition("PENDING", "RUNNING")).not.toThrow();
    expect(() => assertAnalysisRunTransition("RETRY_WAIT", "RUNNING")).not.toThrow();
  });

  it("allows running to complete, retry or fail", () => {
    expect(() => assertAnalysisRunTransition("RUNNING", "COMPLETED")).not.toThrow();
    expect(() => assertAnalysisRunTransition("RUNNING", "RETRY_WAIT")).not.toThrow();
    expect(() => assertAnalysisRunTransition("RUNNING", "FAILED")).not.toThrow();
  });

  it("blocks terminal states from running again", () => {
    expect(() => assertAnalysisRunTransition("COMPLETED", "RUNNING")).toThrow(
      InvalidAnalysisTransitionError
    );
    expect(() => assertAnalysisRunTransition("FAILED", "RUNNING")).toThrow(
      InvalidAnalysisTransitionError
    );
    expect(() => assertAnalysisRunTransition("CANCELLED", "RUNNING")).toThrow(
      InvalidAnalysisTransitionError
    );
  });
});
