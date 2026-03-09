import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function htmlPage(title: string, message: string): Response {
  const body = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb}div{text-align:center;padding:2rem}h1{font-size:1.5rem;color:#111827;margin-bottom:.5rem}p{color:#6b7280}</style></head><body><div><h1>${title}</h1><p>${message}</p></div></body></html>`;
  return new Response(body, {
    status: 410,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const link = await convex.query(api.links.getLinkBySlug, { slug });

  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  if (!link.enabled) {
    return htmlPage(
      "Link Inactive",
      "This link has been disabled by its owner.",
    );
  }

  if (link.clickLimit !== undefined && link.clicks >= link.clickLimit) {
    return htmlPage(
      "Link Expired",
      "This link has reached its maximum click limit.",
    );
  }

  // Increment click count
  await convex.mutation(api.links.incrementClicks, { id: link._id });

  return NextResponse.redirect(link.originalUrl, 302);
}
