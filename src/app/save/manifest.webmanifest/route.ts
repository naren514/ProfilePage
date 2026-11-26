// Web app manifest for "Save to Reading" (/save only; the rest of the site
// isn't an installable app). On Android, share_target puts it in the share
// sheet; on iPhone it's an icon on the home screen.
export function GET() {
  return Response.json(
    {
      name: "Save to Reading",
      short_name: "Save",
      description: "Save an article to your reading list.",
      id: "/save",
      start_url: "/save",
      scope: "/save",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#ffffff",
      icons: [
        { src: "/save/icon?size=192", sizes: "192x192", type: "image/png" },
        { src: "/save/icon?size=512", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ],
      share_target: { action: "/save", method: "GET", params: { title: "title", text: "text", url: "url" } },
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
