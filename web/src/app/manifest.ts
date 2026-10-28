import type { MetadataRoute } from "next";

/** Lets shopkeepers add the app to their phone's home screen, opening straight into the khata. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Udhaar Voice",
    short_name: "Udhaar",
    description: "Your credit book (khata), with reminder calls in Bengali, Hindi and English.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f6f7f3",
    theme_color: "#1d6b58",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
