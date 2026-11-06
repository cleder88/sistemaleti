import { describe, expect, it } from "vitest";
import {
  LETI_WELCOME_AVATAR_SRC,
  LETI_WELCOME_PHRASES,
  LETI_WELCOME_STEP_MS,
} from "@/components/leti-welcome";

describe("leti welcome", () => {
  it("apresenta a Leti chamando para o Sistema Leti", () => {
    expect(LETI_WELCOME_AVATAR_SRC).toBe("/leti-avatar.png");
    expect(LETI_WELCOME_PHRASES[0]).toContain("Leti");
    expect(LETI_WELCOME_PHRASES.join(" ")).toContain("Sistema Leti");
    expect(LETI_WELCOME_STEP_MS).toBeGreaterThan(0);
  });
});
