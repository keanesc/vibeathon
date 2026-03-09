import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const SLUG_LENGTH = 6;

function generateSlug(): string {
  let slug = "";
  for (let i = 0; i < SLUG_LENGTH; i++) {
    slug += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return slug;
}

export const createLink = mutation({
  args: {
    originalUrl: v.string(),
  },
  returns: v.object({
    _id: v.id("links"),
    slug: v.string(),
    originalUrl: v.string(),
    clicks: v.number(),
    _creationTime: v.number(),
  }),
  handler: async (ctx, args) => {
    // Generate a unique slug, retry on collision
    let slug = generateSlug();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await ctx.db
        .query("links")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      if (existing === null) break;
      slug = generateSlug();
      attempts++;
    }

    const id = await ctx.db.insert("links", {
      slug,
      originalUrl: args.originalUrl,
      clicks: 0,
    });

    const doc = await ctx.db.get(id);
    return doc!;
  },
});

export const listLinks = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("links"),
      slug: v.string(),
      originalUrl: v.string(),
      clicks: v.number(),
      _creationTime: v.number(),
    }),
  ),
  handler: async (ctx) => {
    return await ctx.db.query("links").order("desc").collect();
  },
});

export const getLinkBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("links"),
      slug: v.string(),
      originalUrl: v.string(),
      clicks: v.number(),
      _creationTime: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("links")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

export const incrementClicks = mutation({
  args: {
    id: v.id("links"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.id);
    if (link === null) return null;
    await ctx.db.patch(args.id, { clicks: link.clicks + 1 });
    return null;
  },
});
