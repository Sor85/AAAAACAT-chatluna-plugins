import { describe, expect, it, vi } from "vitest";
import { createDeleteMessageTool } from "./delete-msg";

describe("createDeleteMessageTool", () => {
  it("creates an invokable StructuredTool and calls OneBot delete_msg", async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const tool = createDeleteMessageTool({
      toolName: "delete_msg",
      description: "Delete a message.",
    });

    expect(tool.name).toBe("delete_msg");
    expect(typeof tool.invoke).toBe("function");

    await expect(
      tool.invoke(
        { messageId: "1368475453" },
        {
          configurable: {
            session: {
              platform: "onebot",
              bot: { internal: { _request: request } },
            },
          },
        },
      ),
    ).resolves.toBe("Message deleted by ID 1368475453.");

    expect(request).toHaveBeenCalledWith("delete_msg", {
      message_id: 1368475453,
    });
  });
});
