import { describe, it, expect } from "vitest"
import { buildMediaUrl, resolveUserImageSrc, isAvatarObjectKey } from "@/lib/storage/media-url"

describe("media-url", () => {
  it("isAvatarObjectKey validates tenant avatar paths", () => {
    expect(isAvatarObjectKey("cmabc123/avatars/cmuser456/abc-def.jpg")).toBe(true)
    expect(isAvatarObjectKey("../etc/passwd")).toBe(false)
  })

  it("buildMediaUrl encodes path segments", () => {
    expect(buildMediaUrl("t1/avatars/u1/file.jpg")).toBe("/api/media/t1/avatars/u1/file.jpg")
  })

  it("resolveUserImageSrc proxies R2 public URLs", () => {
    process.env.S3_PUBLIC_URL = "https://pub.example.com"
    const src = resolveUserImageSrc(
      "https://pub.example.com/tenant1/avatars/user1/abc.jpg",
    )
    expect(src).toBe("/api/media/tenant1/avatars/user1/abc.jpg")
  })

  it("resolveUserImageSrc keeps Google profile URLs", () => {
    const google = "https://lh3.googleusercontent.com/a/photo"
    expect(resolveUserImageSrc(google)).toBe(google)
  })
})
