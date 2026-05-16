import { describe, expect, it } from "vitest";
import { entryInputSchema } from "../../src/lib/schema";

describe("entryInputSchema", () => {
  it("accepts a valid image entry", () => {
    expect(entryInputSchema.parse({
      uploaderName: "Guest",
      caption: "",
      mediaUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      mediaPublicId: "guestbook/abc",
      mediaType: "image",
      mediaItems: [{
        mediaUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
        mediaPublicId: "guestbook/abc",
        mediaType: "image"
      }],
      mediaCount: 1,
      postType: "photo"
    }).mediaType).toBe("image");
  });
});
