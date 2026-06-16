/**
 * poke 触发随机表情的回归测试
 * 覆盖 notice session 缺少 author.nick 时的发送者群昵称回查
 */

import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../../src/config";

const backendMocks = vi.hoisted(() => ({
  generate: vi.fn(),
  getInfo: vi.fn(),
  getKeys: vi.fn(),
}));

vi.mock("koishi", () => ({
  h: {
    image: vi.fn((buffer: Buffer, mimeType: string) => ({ buffer, mimeType })),
  },
}));

vi.mock("../../../src/infra/client", () => ({
  MemeBackendClient: vi.fn().mockImplementation(() => ({
    getKeys: backendMocks.getKeys,
    getInfo: backendMocks.getInfo,
    getPreview: vi.fn(),
    generate: backendMocks.generate,
  })),
}));

import { registerCommands } from "../../../src/command/register";

type CommandAction = (...args: any[]) => Promise<unknown>;

function createMockContext() {
  const commandActions = new Map<string, CommandAction>();

  const ctx: any = {
    command: vi.fn((name: string) => ({
      action: vi.fn((handler: CommandAction) => {
        commandActions.set(name, handler);
        return { action: vi.fn() };
      }),
    })),
    logger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn() })),
    $commander: {
      get: vi.fn(() => undefined),
    },
    $processor: {
      match: vi.fn(() => vi.fn()),
    },
    middleware: vi.fn(),
    on: vi.fn(),
  };

  return { ctx, commandActions };
}

function createConfig(): Config {
  return {
    baseUrl: "http://127.0.0.1:2233",
    timeoutMs: 3000,
    emptyTextAutoFillRules: [
      {
        source: "template-default",
        enabled: true,
        weight: 100,
      },
      {
        source: "user-nickname",
        enabled: false,
        weight: 100,
      },
    ],
    autoUseAvatarWhenMinImagesOneAndNoImage: false,
    autoFillOneMissingImageWithAvatar: false,
    autoFillSenderAndBotAvatarsWhenMinImagesTwoAndNoImage: false,
    autoUseGroupNicknameWhenNoDefaultText: true,
    enableQuotedImageTrigger: true,
    enableQuotedTextTrigger: false,
    renderMemeListAsImage: false,
    enableMemeCommandTrigger: true,
    enableDirectAliasWithoutPrefix: false,
    allowKeyWithoutPrefixTrigger: false,
    allowMentionPrefixDirectAliasTrigger: false,
    allowLeadingAtBeforeCommand: false,
    enableDeveloperDebugLog: false,
    randomOutputMemeKey: "",
    enableMemeXmlTool: false,
    injectMemeXmlToolAsReplyTool: false,
    enableRandomDedupeWithinHours: false,
    randomDedupeWindowHours: 24,
    enableRandomKeywordNotice: false,
    randomMemeBucketWeightRules: [
      { category: "text-only", enabled: true, weight: 100 },
      { category: "single-image-only", enabled: true, weight: 100 },
      { category: "two-image-only", enabled: true, weight: 100 },
      { category: "image-and-text", enabled: true, weight: 100 },
      { category: "other", enabled: true, weight: 100 },
    ],
    infoFetchConcurrency: 0,
    initLoadRetryTimes: 3,
    disableErrorReplyToPlatform: false,
    excludeTextOnlyMemes: false,
    excludeSingleImageOnlyMemes: false,
    excludeTwoImageOnlyMemes: false,
    excludeImageAndTextMemes: false,
    excludeOtherMemes: false,
    excludedMemeKeys: [],
  };
}

describe("poke triggered meme.random", () => {
  it("notice session 缺少 author.nick 时应回查发送者群昵称", async () => {
    backendMocks.generate.mockReset();
    backendMocks.getInfo.mockReset();
    backendMocks.getKeys.mockReset();

    backendMocks.getKeys.mockResolvedValue(["nickname_meme"]);
    backendMocks.getInfo.mockResolvedValue({
      key: "nickname_meme",
      params_type: {
        min_images: 0,
        max_images: 0,
        min_texts: 1,
        max_texts: 1,
        default_texts: [],
      },
      keywords: [],
      shortcuts: [],
      tags: [],
      date_created: "2026-01-01T00:00:00",
      date_modified: "2026-01-01T00:00:00",
    });
    backendMocks.generate.mockResolvedValue({
      buffer: new Uint8Array([1, 2, 3]).buffer,
      mimeType: "image/png",
    });

    const { ctx, commandActions } = createMockContext();
    registerCommands(ctx, createConfig());

    const randomAction = commandActions.get("meme.random [...texts]");
    expect(randomAction).toBeDefined();

    const session = {
      userId: "10001",
      guildId: "20001",
      username: "10001",
      author: {},
      event: { user: {} },
      elements: [],
      quote: undefined,
      bot: {
        user: {},
        getLogin: vi.fn(async () => ({ user: {} })),
        getGuildMember: vi.fn(async () => ({ nick: "发送者群昵称" })),
        getUser: vi.fn(),
      },
    } as any;

    const result = await randomAction!({ session });

    expect(result).toBeTruthy();
    expect(session.bot.getGuildMember).toHaveBeenCalledWith("20001", "10001");
    expect(backendMocks.generate).toHaveBeenCalledWith(
      "nickname_meme",
      [],
      ["发送者群昵称"],
      {},
    );
  });
});
