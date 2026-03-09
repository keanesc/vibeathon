import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  links: defineTable({
    slug: v.string(),
    originalUrl: v.string(),
    clicks: v.number(),
  }).index("by_slug", ["slug"]),
});
