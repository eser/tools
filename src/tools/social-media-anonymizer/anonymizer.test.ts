import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertNotEquals } from "@std/assert";
import { Anonymizer } from "./anonymizer.ts";

describe("Anonymizer", () => {
  it("generates consistent results for the same user", async () => {
    const anonymizer = new Anonymizer("test-secret");
    const user = { id: "user1", username: "alice" };

    const first = await anonymizer.anonymize(user);
    const second = await anonymizer.anonymize(user);

    assertEquals(first, second);
  });

  it("generates different results for different users", async () => {
    const anonymizer = new Anonymizer("test-secret");
    const user1 = { id: "user1", username: "alice" };
    const user2 = { id: "user2", username: "bob" };

    const result1 = await anonymizer.anonymize(user1);
    const result2 = await anonymizer.anonymize(user2);

    assertNotEquals(result1.anonymizedId, result2.anonymizedId);
    assertNotEquals(result1.anonymizedName, result2.anonymizedName);
  });

  it("generates different results with different secrets", async () => {
    const anon1 = new Anonymizer("secret-a");
    const anon2 = new Anonymizer("secret-b");
    const user = { id: "user1", username: "alice" };

    const result1 = await anon1.anonymize(user);
    const result2 = await anon2.anonymize(user);

    assertNotEquals(result1.anonymizedId, result2.anonymizedId);
  });

  it("tracks unique user count", async () => {
    const anonymizer = new Anonymizer("test-secret");
    assertEquals(anonymizer.uniqueCount, 0);

    await anonymizer.anonymize({ id: "1", username: "alice" });
    assertEquals(anonymizer.uniqueCount, 1);

    // Same user again should not increase count
    await anonymizer.anonymize({ id: "1", username: "alice" });
    assertEquals(anonymizer.uniqueCount, 1);

    await anonymizer.anonymize({ id: "2", username: "bob" });
    assertEquals(anonymizer.uniqueCount, 2);
  });

  it("produces a valid DiceBear avatar URL", async () => {
    const anonymizer = new Anonymizer("test-secret");
    const result = await anonymizer.anonymize({ id: "1", username: "test" });

    assertEquals(result.anonymizedAvatarUrl.startsWith("https://api.dicebear.com/9.x/shapes/svg?seed="), true);
  });

  it("produces a 12-character anonymized ID", async () => {
    const anonymizer = new Anonymizer("test-secret");
    const result = await anonymizer.anonymize({ id: "1", username: "test" });

    assertEquals(result.anonymizedId.length, 12);
  });
});
