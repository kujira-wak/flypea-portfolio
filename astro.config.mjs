// @ts-check
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  site: "https://flypea.tech",
  redirects: {
    "/works": "/projects/",
    "/works/[...id]": "/projects/[...id]",
    "/log": "/notes/",
    "/log/[...id]": "/notes/[...id]",
    "/profile": "/about/",
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        "/api/reactions": "http://localhost:8787",
      },
    },
  },
});
