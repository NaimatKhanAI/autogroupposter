import test from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { ref, uploadBytes, getMetadata, deleteObject } from "firebase/storage";
const env = await initializeTestEnvironment({
  projectId: "demo-autogroupposter",
  storage: { rules: readFileSync("storage.rules", "utf8") },
});
test.after(() => env.cleanup());
test("verified owner can upload an approved image, read and delete it", async () => {
  const storage = env
    .authenticatedContext("alice", { email_verified: true })
    .storage();
  const image = ref(storage, "agpMedia/alice/test-image");
  await assertSucceeds(
    uploadBytes(image, new Uint8Array([1, 2, 3]), { contentType: "image/png" }),
  );
  await assertSucceeds(getMetadata(image));
  await assertFails(
    uploadBytes(image, new Uint8Array([4, 5]), { contentType: "image/png" }),
  );
  await assertSucceeds(deleteObject(image));
});
test("another account and anonymous user cannot write owned media", async () => {
  for (const storage of [
    env.authenticatedContext("bob", { email_verified: true }).storage(),
    env.unauthenticatedContext().storage(),
  ])
    await assertFails(
      uploadBytes(
        ref(storage, "agpMedia/alice/unauthorized"),
        new Uint8Array([1]),
        { contentType: "image/png" },
      ),
    );
});
test("unverified users and executable media are rejected", async () => {
  await assertFails(
    uploadBytes(
      ref(
        env.authenticatedContext("alice", { email_verified: false }).storage(),
        "agpMedia/alice/unverified",
      ),
      new Uint8Array([1]),
      { contentType: "image/png" },
    ),
  );
  await assertFails(
    uploadBytes(
      ref(
        env.authenticatedContext("alice", { email_verified: true }).storage(),
        "agpMedia/alice/script",
      ),
      new Uint8Array([1]),
      { contentType: "text/javascript" },
    ),
  );
});
