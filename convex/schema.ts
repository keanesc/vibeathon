import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  links: defineTable({
    slug: v.string(),
    originalUrl: v.string(),
    clicks: v.number(),
    userId: v.id("users"),
    enabled: v.boolean(),
    clickLimit: v.optional(v.number()),
    lastAccessedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_userId", ["userId"]),
});
