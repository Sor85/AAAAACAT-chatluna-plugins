import { describe, expect, it, vi } from "vitest";
import {
  createKoishiPluginManagerTool,
  manageKoishiPlugin,
  registerKoishiPluginManagerCommand,
} from "./koishi-plugin-manager";

function createLoaderContext() {
  const writeConfig = vi.fn(async () => {});
  const unload = vi.fn();
  const reload = vi.fn(async () => ({}));
  const scope = {
    ctx: {},
    config: {
      "chatluna-toolbox": { enabled: true },
      "~disabled-plugin": { foo: 1 },
    },
  };
  const loader = {
    entry: { scope },
    writeConfig,
    unload,
    reload,
  };
  scope.ctx = { loader, scope };
  return { ctx: { loader } as any, scope, loader };
}

describe("manageKoishiPlugin", () => {
  it("unloads and disables an enabled plugin", async () => {
    const { ctx, scope, loader } = createLoaderContext();

    const result = await manageKoishiPlugin({
      ctx,
      action: "unload",
      pluginKey: "chatluna-toolbox",
    });

    expect(loader.unload).toHaveBeenCalledWith(scope.ctx, "chatluna-toolbox");
    expect(scope.config["~chatluna-toolbox"]).toEqual({ enabled: true });
    expect(scope.config["chatluna-toolbox"]).toBeUndefined();
    expect(loader.writeConfig).toHaveBeenCalledTimes(1);
    expect(result).toBe("插件已停用：chatluna-toolbox");
  });

  it("removes enabled and disabled config entries", async () => {
    const { ctx, scope, loader } = createLoaderContext();

    const result = await manageKoishiPlugin({
      ctx,
      action: "remove",
      pluginKey: "disabled-plugin",
    });

    expect(loader.unload).toHaveBeenCalledWith(scope.ctx, "disabled-plugin");
    expect(scope.config["disabled-plugin"]).toBeUndefined();
    expect(scope.config["~disabled-plugin"]).toBeUndefined();
    expect(loader.writeConfig).toHaveBeenCalledTimes(1);
    expect(result).toBe("插件配置已移除：disabled-plugin");
  });

  it("reloads a disabled plugin with its stored config", async () => {
    const { ctx, scope, loader } = createLoaderContext();

    const result = await manageKoishiPlugin({
      ctx,
      action: "reload",
      pluginKey: "disabled-plugin",
    });

    expect(loader.reload).toHaveBeenCalledWith(scope.ctx, "disabled-plugin", {
      foo: 1,
    });
    expect(scope.config["disabled-plugin"]).toEqual({ foo: 1 });
    expect(scope.config["~disabled-plugin"]).toBeUndefined();
    expect(loader.writeConfig).toHaveBeenCalledTimes(1);
    expect(result).toBe("插件已重载：disabled-plugin");
  });
});

describe("createKoishiPluginManagerTool", () => {
  it("returns an invokable LangChain structured tool", () => {
    const { ctx } = createLoaderContext();
    const tool = createKoishiPluginManagerTool({
      ctx,
      toolName: "koishi_plugin_manager",
      description: "desc",
    });

    expect(tool.name).toBe("koishi_plugin_manager");
    expect(typeof tool.invoke).toBe("function");
  });

  it("describes concrete usage examples for the model", () => {
    const { ctx } = createLoaderContext();
    const tool = createKoishiPluginManagerTool({
      ctx,
      toolName: "koishi_plugin_manager",
      description: "",
    });

    expect(tool.description).toContain("action");
    expect(tool.description).toContain("pluginKey");
    expect(tool.description).toContain("reload");
    expect(tool.description).toContain("chatluna-toolbox");
  });
});

describe("registerKoishiPluginManagerCommand", () => {
  it("registers a toolbox command that manages plugins", async () => {
    const { ctx, loader } = createLoaderContext();
    const action = vi.fn();
    const command = {
      alias: vi.fn(() => command),
      option: vi.fn(() => command),
      action: vi.fn((handler) => {
        action.mockImplementation(handler);
        return command;
      }),
    };
    const commandFactory = vi.fn(() => command);
    (ctx as any).command = commandFactory;

    registerKoishiPluginManagerCommand({
      ctx,
      log: vi.fn(),
      allowedUserIds: ["2657455842"],
    });

    expect(commandFactory).toHaveBeenCalledWith(
      "toolbox.plugin <action> <pluginKey>",
      expect.stringContaining("Koishi"),
      { authority: 0 },
    );

    const result = await action(
      { session: { userId: "2657455842" }, options: {} },
      "unload",
      "chatluna-toolbox",
    );

    expect(loader.unload).toHaveBeenCalledWith(
      expect.anything(),
      "chatluna-toolbox",
    );
    expect(result).toBe("插件已停用：chatluna-toolbox");
  });

  it("returns usage text when command arguments are missing", async () => {
    const { ctx } = createLoaderContext();
    const action = vi.fn();
    const command = {
      alias: vi.fn(() => command),
      option: vi.fn(() => command),
      action: vi.fn((handler) => {
        action.mockImplementation(handler);
        return command;
      }),
    };
    (ctx as any).command = vi.fn(() => command);

    registerKoishiPluginManagerCommand({ ctx, log: vi.fn() });

    await expect(
      action({ session: { user: { authority: 4 } }, options: {} }, "reload"),
    ).resolves.toContain(
      "toolbox.plugin <reload|restart|unload|remove> <pluginKey>",
    );
  });

  it("rejects toolbox command callers without authority or allowlist match", async () => {
    const { ctx, loader } = createLoaderContext();
    const action = vi.fn();
    const command = {
      alias: vi.fn(() => command),
      option: vi.fn(() => command),
      action: vi.fn((handler) => {
        action.mockImplementation(handler);
        return command;
      }),
    };
    (ctx as any).command = vi.fn(() => command);

    registerKoishiPluginManagerCommand({
      ctx,
      log: vi.fn(),
      commandAuthority: 4,
      allowedUserIds: ["2657455842"],
    });

    const result = await action(
      { session: { userId: "111", user: { authority: 1 } }, options: {} },
      "reload",
      "chatluna-toolbox",
    );

    expect(result).toContain("权限不足");
    expect(loader.reload).not.toHaveBeenCalled();
  });
});
