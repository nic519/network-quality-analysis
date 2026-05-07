import { describe, expect, test } from "bun:test";
import { buildApplicationMenu } from "./menu";

describe("buildApplicationMenu", () => {
  test("includes native edit roles so text fields support paste", () => {
    const menu = buildApplicationMenu();
    const editMenu = menu.find((item) => "label" in item && item.label === "Edit");

    expect(editMenu && "submenu" in editMenu ? editMenu.submenu : []).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "cut" }),
        expect.objectContaining({ role: "copy" }),
        expect.objectContaining({ role: "paste" }),
        expect.objectContaining({ role: "selectAll" }),
      ]),
    );
  });
});
