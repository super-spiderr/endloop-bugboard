import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves this repo at /endloop-bugboard/.
export default defineConfig({
  base: "/endloop-bugboard/",
  plugins: [react()],
});
