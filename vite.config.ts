import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: "src/mainview",
  build: {
    outDir: "../../dist-web",
    emptyOutDir: true,
  },
});
