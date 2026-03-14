import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AIMaha Kruksetra WMS",
    short_name: "AK WMS",
    description: "Warehouse control PWA for receiving, inventory, orders, and returns.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#f15a24",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}

