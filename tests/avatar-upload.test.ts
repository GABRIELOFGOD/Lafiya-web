// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/profile/photo/route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => {
  return {
    createClient: vi.fn(),
  };
});

describe("Avatar Upload Route Handler", () => {
  const fixturePath = path.resolve(__dirname, "fixtures/gps-tagged.jpg");

  it("should reject unauthorized requests", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: null }, error: null }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([Buffer.from("fake-image")], { type: "image/jpeg" }),
      "test.jpg",
    );

    const request = new Request("http://localhost/api/profile/photo", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(401);

    const json = await response.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("should strip EXIF/GPS metadata from uploaded image", async () => {
    // 1. Verify fixture exists and has EXIF metadata
    expect(fs.existsSync(fixturePath)).toBe(true);
    const fixtureBuffer = fs.readFileSync(fixturePath);
    const fixtureMetadata = await sharp(fixtureBuffer).metadata();
    expect(fixtureMetadata.exif).toBeDefined();

    // 2. Set up mocks
    const mockUser = { id: "test-user-123" };
    const mockUpload = vi.fn().mockResolvedValue({ error: null });
    const mockGetPublicUrl = vi.fn().mockReturnValue({
      data: {
        publicUrl: "https://supabase.example.com/avatars/test-user-123/photo.jpg",
      },
    });

    const mockSupabase = {
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      storage: {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          getPublicUrl: mockGetPublicUrl,
        }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(
      mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>,
    );

    // 3. Perform upload request
    const formData = new FormData();
    const blob = new Blob([fixtureBuffer], { type: "image/jpeg" });
    formData.append("file", blob, "gps-tagged.jpg");

    const request = new Request("http://localhost/api/profile/photo", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.publicUrl).toBe(
      "https://supabase.example.com/avatars/test-user-123/photo.jpg",
    );

    // 4. Assert direct-to-Storage upload arguments
    expect(mockUpload).toHaveBeenCalledTimes(1);
    const uploadedPath = mockUpload.mock.calls[0][0];
    const uploadedBuffer = mockUpload.mock.calls[0][1] as Buffer;

    expect(uploadedPath).toBe("test-user-123/photo.jpg");

    // 5. Verify EXIF metadata has been stripped in the uploaded buffer
    const uploadedMetadata = await sharp(uploadedBuffer).metadata();
    expect(uploadedMetadata.exif).toBeUndefined();

    // 6. Verify image is resized to bounded dimensions (<= 800px)
    expect(uploadedMetadata.width).toBeLessThanOrEqual(800);
    expect(uploadedMetadata.height).toBeLessThanOrEqual(800);
  });
});
