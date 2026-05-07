import { describe, expect, test } from "bun:test";
import { chooseConfigFile } from "./file-dialog";

describe("chooseConfigFile", () => {
  test("returns the selected config path", async () => {
    const selected = await chooseConfigFile({
      currentPath: "/Users/nicholas/configs/current.yaml",
      openFileDialog: async (options) => {
        expect(options).toMatchObject({
          startingFolder: "/Users/nicholas/configs",
          canChooseFiles: true,
          canChooseDirectory: false,
          allowsMultipleSelection: false,
        });
        return ["/Users/nicholas/configs/next.yaml"];
      },
    });

    expect(selected).toBe("/Users/nicholas/configs/next.yaml");
  });

  test("returns null when the file dialog is cancelled", async () => {
    const selected = await chooseConfigFile({
      currentPath: "https://example.com/subscription",
      openFileDialog: async (options) => {
        expect(options.startingFolder).toBe("~");
        return [""];
      },
    });

    expect(selected).toBeNull();
  });
});
