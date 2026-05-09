import { useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { cn } from "../../lib/utils";

type ScrollAreaProps = {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
  contentClassName?: string;
};

export function getScrollAreaViewportClassName(className?: string) {
  return cn("scrollbar-none overflow-auto pr-7", className);
}

export function getScrollAreaTrackClassName(className?: string) {
  return cn(
    "absolute bottom-3 right-2 top-3 w-2 rounded-full bg-muted",
    className,
  );
}

export function getScrollAreaThumbClassName(className?: string) {
  return cn(
    "absolute left-0 w-full rounded-full bg-muted-foreground/45 transition-colors hover:bg-muted-foreground/65",
    className,
  );
}

export function ScrollArea({ children, className, viewportClassName, contentClassName }: ScrollAreaProps) {
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ pointerId: number; startY: number; startScrollTop: number } | null>(null);
  const [scrollState, setScrollState] = useState({ canScroll: false, thumbTop: 0, thumbHeight: 100 });

  const updateScrollState = () => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const { clientHeight, scrollHeight, scrollTop } = scrollArea;
    const canScroll = scrollHeight > clientHeight + 1;
    const thumbHeight = canScroll ? Math.max(34, (clientHeight / scrollHeight) * 100) : 100;
    const maxThumbTop = 100 - thumbHeight;
    const thumbTop = canScroll && scrollHeight > clientHeight ? (scrollTop / (scrollHeight - clientHeight)) * maxThumbTop : 0;

    setScrollState({ canScroll, thumbTop, thumbHeight });
  };

  useLayoutEffect(() => {
    updateScrollState();
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(scrollArea);
    resizeObserver.observe(scrollArea.firstElementChild ?? scrollArea);

    return () => resizeObserver.disconnect();
  }, [children]);

  const scrollToTrackPosition = (clientY: number) => {
    const scrollArea = scrollAreaRef.current;
    const track = thumbRef.current?.parentElement;
    if (!scrollArea || !track) return;

    const trackRect = track.getBoundingClientRect();
    const thumbOffset = trackRect.height * (scrollState.thumbHeight / 100) * 0.5;
    const availableScroll = scrollArea.scrollHeight - scrollArea.clientHeight;
    const targetRatio = (clientY - trackRect.top - thumbOffset) / trackRect.height;
    const nextScrollTop = Math.min(Math.max(targetRatio, 0), 1) * availableScroll;
    scrollArea.scrollTop = nextScrollTop;
    updateScrollState();
  };

  const handleThumbPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    event.stopPropagation();
    thumbRef.current?.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: scrollArea.scrollTop,
    };
  };

  const handleThumbPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const scrollArea = scrollAreaRef.current;
    const track = thumbRef.current?.parentElement;
    const dragState = dragStateRef.current;
    if (!scrollArea || !track || !dragState || dragState.pointerId !== event.pointerId) return;

    const trackHeight = track.getBoundingClientRect().height;
    const availableTrack = trackHeight * (1 - scrollState.thumbHeight / 100);
    const availableScroll = scrollArea.scrollHeight - scrollArea.clientHeight;
    const scrollPerPixel = availableTrack > 0 ? availableScroll / availableTrack : 0;
    scrollArea.scrollTop = dragState.startScrollTop + (event.clientY - dragState.startY) * scrollPerPixel;
    updateScrollState();
  };

  const clearDragState = (pointerId: number) => {
    if (dragStateRef.current?.pointerId !== pointerId) return;
    dragStateRef.current = null;
    thumbRef.current?.releasePointerCapture(pointerId);
  };

  return (
    <div className={cn("relative", className)}>
      <div
        ref={scrollAreaRef}
        data-slot="scroll-area-viewport"
        className={getScrollAreaViewportClassName(viewportClassName)}
        onScroll={updateScrollState}
      >
        <div className={contentClassName}>{children}</div>
      </div>

      {scrollState.canScroll ? (
        <div
          aria-hidden="true"
          data-slot="scroll-area-track"
          className={getScrollAreaTrackClassName()}
          onPointerDown={(event) => scrollToTrackPosition(event.clientY)}
        >
          <div
            ref={thumbRef}
            data-slot="scroll-area-thumb"
            className={getScrollAreaThumbClassName()}
            style={{
              height: `${scrollState.thumbHeight}%`,
              top: `${scrollState.thumbTop}%`,
            }}
            onPointerDown={handleThumbPointerDown}
            onPointerMove={handleThumbPointerMove}
            onPointerUp={(event) => clearDragState(event.pointerId)}
            onPointerCancel={(event) => clearDragState(event.pointerId)}
          />
        </div>
      ) : null}
    </div>
  );
}
