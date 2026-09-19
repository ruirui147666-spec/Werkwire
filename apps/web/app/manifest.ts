import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Werkwire",
    short_name: "Werkwire",
    description: "O marketplace de emprego sem candidaturas.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#3D6FE0",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
    ],
  };
}
