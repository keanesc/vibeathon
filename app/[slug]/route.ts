import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const link = await convex.query(api.links.getLinkBySlug, { slug });

  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  // Increment click count (fire-and-forget is fine; we await to keep it transactional)
  await convex.mutation(api.links.incrementClicks, { id: link._id });

  return NextResponse.redirect(link.originalUrl, 302);
}
