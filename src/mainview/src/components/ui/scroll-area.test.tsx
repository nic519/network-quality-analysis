import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ScrollArea, getScrollAreaThumbClassName, getScrollAreaTrackClassName, getScrollAreaViewportClassName } from "./scroll-area";

describe("scroll area", () => {
  test("uses the shared custom scrollbar viewport styles by default", () => {
    expect(getScrollAreaViewportClassName()).toContain("scrollbar-none");
    expect(getScrollAreaViewportClassName()).toContain("pr-7");
  });

  test("exposes shared track and thumb styles", () => {
    expect(getScrollAreaTrackClassName()).toContain("bg-muted");
    expect(getScrollAreaThumbClassName()).toContain("bg-muted-foreground/45");
  });

  test("renders the shared viewport shell", () => {
    const html = renderToStaticMarkup(
      <ScrollArea viewportClassName="max-h-40">
        <div>content</div>
      </ScrollArea>,
    );

    expect(html).toContain("data-slot=\"scroll-area-viewport\"");
  });
});
