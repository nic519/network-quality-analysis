export type NativeExternalOpener = (url: string) => boolean;

export function openExternalUrl(url: string, nativeOpenExternal: NativeExternalOpener) {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("只允许打开 HTTP 或 HTTPS 链接");
  }

  const normalizedUrl = parsedUrl.toString();
  if (!nativeOpenExternal(normalizedUrl)) {
    throw new Error(`无法打开外部链接：${normalizedUrl}`);
  }
}
