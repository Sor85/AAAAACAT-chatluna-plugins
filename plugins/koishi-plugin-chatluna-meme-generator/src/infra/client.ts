/**
 * meme-generator-main HTTP 客户端
 * 封装模板查询、预览与生成接口调用
 */

import type { Context } from "koishi";
import type {
  BinaryResult,
  GenerateImageInput,
  MemeInfoResponse,
} from "../types";

export class MemeBackendClient {
  constructor(
    private readonly ctx: Context,
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  async getKeys(): Promise<string[]> {
    return await this.ctx.http.get(`${this.baseUrl}/memes/keys`, {
      timeout: this.timeoutMs,
    });
  }

  async getInfo(key: string): Promise<MemeInfoResponse> {
    return await this.ctx.http.get(
      `${this.baseUrl}/memes/${encodeURIComponent(key)}/info`,
      {
        timeout: this.timeoutMs,
      },
    );
  }

  async getPreview(key: string): Promise<BinaryResult> {
    const response = await this.ctx.http("GET", `${this.baseUrl}/memes/${encodeURIComponent(key)}/preview`, {
      timeout: this.timeoutMs,
      responseType: "arraybuffer",
    });

    return {
      buffer: new Uint8Array(response.data),
      mimeType: normalizeBinaryMimeType(response.headers.get("content-type")),
    };
  }

  async generate(
    key: string,
    images: GenerateImageInput[],
    texts: string[],
    args: Record<string, unknown> = {},
  ): Promise<BinaryResult> {
    const form = new FormData();

    for (const image of images) {
      const blob = new Blob([image.data.buffer as ArrayBuffer], {
        type: image.mimeType,
      });
      form.append("images", blob, image.filename);
    }

    for (const text of texts) {
      form.append("texts", text);
    }

    form.append("args", JSON.stringify(args));

    const response = await this.ctx.http(
      "POST",
      `${this.baseUrl}/memes/${encodeURIComponent(key)}/`,
      {
        data: form,
        timeout: this.timeoutMs,
        responseType: "arraybuffer",
      },
    );

    return {
      buffer: new Uint8Array(response.data),
      mimeType: normalizeBinaryMimeType(response.headers.get("content-type")),
    };
  }
}

function normalizeBinaryMimeType(contentType: string | null): string {
  if (!contentType) return "image/png";

  const mimeType = contentType.split(";")[0]?.trim().toLowerCase();
  if (!mimeType) return "image/png";

  if (mimeType === "image/png") return mimeType;
  if (mimeType === "image/jpeg") return mimeType;
  if (mimeType === "image/gif") return mimeType;
  if (mimeType === "image/webp") return mimeType;

  return "image/png";
}
