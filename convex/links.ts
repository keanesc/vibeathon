import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

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

const linkValidator = v.object({
  _id: v.id("links"),
  _creationTime: v.number(),
  slug: v.string(),
  originalUrl: v.string(),
  clicks: v.number(),
  userId: v.id("users"),
  enabled: v.boolean(),
  clickLimit: v.optional(v.number()),
  lastAccessedAt: v.optional(v.number()),
});

export const createLink = mutation({
  args: {
    originalUrl: v.string(),
    clickLimit: v.optional(v.number()),
  },
  returns: linkValidator,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Must be logged in to create a link");
    }

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
      userId,
      enabled: true,
      clickLimit: args.clickLimit,
    });

    const doc = await ctx.db.get(id);
    return doc!;
  },
});

export const listLinks = query({
  args: {},
  returns: v.array(linkValidator),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    return await ctx.db
      .query("links")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const getLinkBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("links"),
      _creationTime: v.number(),
      slug: v.string(),
      originalUrl: v.string(),
      clicks: v.number(),
      userId: v.id("users"),
      enabled: v.boolean(),
      clickLimit: v.optional(v.number()),
      lastAccessedAt: v.optional(v.number()),
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
    await ctx.db.patch(args.id, {
      clicks: link.clicks + 1,
      lastAccessedAt: Date.now(),
    });
    return null;
  },
});

export const toggleEnabled = mutation({
  args: {
    id: v.id("links"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Must be logged in");
    }
    const link = await ctx.db.get(args.id);
    if (link === null || link.userId !== userId) {
      throw new Error("Link not found");
    }
    await ctx.db.patch(args.id, { enabled: !link.enabled });
    return null;
  },
});

export const updateDestination = mutation({
  args: {
    id: v.id("links"),
    originalUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Must be logged in");
    }
    const link = await ctx.db.get(args.id);
    if (link === null || link.userId !== userId) {
      throw new Error("Link not found");
    }
    await ctx.db.patch(args.id, { originalUrl: args.originalUrl });
    return null;
  },
});
