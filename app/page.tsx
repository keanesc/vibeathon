"use client";

import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function Home() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const router = useRouter();

  // Form state
  const [input, setInput] = useState("");
  const [clickLimitInput, setClickLimitInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline edit state: linkId → editing URL value
  const [editing, setEditing] = useState<Record<string, string>>({});

  const links = useQuery(api.links.listLinks);
  const createLink = useMutation(api.links.createLink);
  const toggleEnabled = useMutation(api.links.toggleEnabled);
  const updateDestination = useMutation(api.links.updateDestination);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();

      if (!trimmed) {
        setError("Please enter a URL.");
        return;
      }
      if (!isValidUrl(trimmed)) {
        setError("Please enter a valid URL starting with http:// or https://");
        return;
      }

      const limitRaw = clickLimitInput.trim();
      let clickLimit: number | undefined;
      if (limitRaw !== "") {
        const parsed = parseInt(limitRaw, 10);
        if (isNaN(parsed) || parsed < 1) {
          setError("Click limit must be a positive number.");
          return;
        }
        clickLimit = parsed;
      }

      setError(null);
      setIsSubmitting(true);
      try {
        await createLink({ originalUrl: trimmed, clickLimit });
        setInput("");
        setClickLimitInput("");
      } catch {
        setError("Failed to create short link. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [input, clickLimitInput, createLink],
  );

  const handleCopy = useCallback(async (shortUrl: string) => {
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(shortUrl);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  }, []);

  const handleToggle = useCallback(
    async (id: Id<"links">) => {
      try {
        await toggleEnabled({ id });
      } catch {
        // ignore
      }
    },
    [toggleEnabled],
  );

  const handleEditSave = useCallback(
    async (id: Id<"links">) => {
      const newUrl = editing[id]?.trim();
      if (!newUrl || !isValidUrl(newUrl)) return;
      try {
        await updateDestination({ id, originalUrl: newUrl });
        setEditing((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } catch {
        // ignore
      }
    },
    [editing, updateDestination],
  );

  const handleLogout = useCallback(async () => {
    await signOut();
    router.push("/login");
  }, [signOut, router]);

  const origin = getOrigin();

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading…</div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">URL Shortener</h1>
            <p className="text-gray-500 mt-1">Shorten links, track every click, manage from here.</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-800 border border-gray-300 rounded-lg px-4 py-2 transition-colors hover:bg-gray-100"
          >
            Log out
          </button>
        </div>

        {/* Create form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label htmlFor="url-input" className="block text-sm font-medium text-gray-700 mb-1">
                Destination URL
              </label>
              <input
                id="url-input"
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="https://example.com/very/long/path"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>
            <div className="sm:w-40">
              <label htmlFor="click-limit" className="block text-sm font-medium text-gray-700 mb-1">
                Click limit <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                id="click-limit"
                type="number"
                min={1}
                value={clickLimitInput}
                onChange={(e) => {
                  setClickLimitInput(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. 100"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
              >
                {isSubmitting ? "Shortening…" : "Shorten"}
              </button>
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </form>

        {/* Dashboard */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Your Links</h2>

          {links === undefined ? (
            <div className="text-center py-12 text-gray-400">Loading…</div>
          ) : links.length === 0 ? (
            <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-400">
              No links yet. Paste a URL above to get started.
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Destination</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Short Link</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Clicks</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Last Accessed</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {links.map((link) => {
                      const shortUrl = `${origin}/${link.slug}`;
                      const isCopied = copied === shortUrl;
                      const isEditingThis = link._id in editing;
                      const clicksDisplay =
                        link.clickLimit !== undefined
                          ? `${link.clicks} / ${link.clickLimit}`
                          : `${link.clicks}`;
                      const isExpired =
                        link.clickLimit !== undefined && link.clicks >= link.clickLimit;

                      return (
                        <tr key={link._id} className="hover:bg-gray-50 transition-colors">
                          {/* Destination URL - editable */}
                          <td className="px-4 py-3 max-w-0 w-64">
                            {isEditingThis ? (
                              <div className="flex gap-1">
                                <input
                                  type="text"
                                  value={editing[link._id]}
                                  onChange={(e) =>
                                    setEditing((prev) => ({ ...prev, [link._id]: e.target.value }))
                                  }
                                  className="flex-1 border border-blue-400 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleEditSave(link._id)}
                                  className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded transition-colors shrink-0"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() =>
                                    setEditing((prev) => {
                                      const next = { ...prev };
                                      delete next[link._id];
                                      return next;
                                    })
                                  }
                                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors shrink-0"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 group">
                                <a
                                  href={link.originalUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-700 hover:text-blue-600 truncate block flex-1"
                                  title={link.originalUrl}
                                >
                                  {link.originalUrl}
                                </a>
                                <button
                                  onClick={() =>
                                    setEditing((prev) => ({ ...prev, [link._id]: link.originalUrl }))
                                  }
                                  className="opacity-0 group-hover:opacity-100 text-xs text-gray-400 hover:text-blue-600 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-all shrink-0"
                                  title="Edit destination"
                                >
                                  Edit
                                </button>
                              </div>
                            )}
                          </td>

                          {/* Short link */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <a
                              href={shortUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 font-mono text-xs"
                            >
                              {origin}/{link.slug}
                            </a>
                          </td>

                          {/* Clicks */}
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center justify-center rounded-full px-3 py-0.5 font-semibold tabular-nums text-xs ${
                                isExpired
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {clicksDisplay}
                            </span>
                          </td>

                          {/* Status + toggle */}
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleToggle(link._id)}
                              title={link.enabled ? "Click to disable" : "Click to enable"}
                              className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                                link.enabled
                                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                                  : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${link.enabled ? "bg-green-500" : "bg-gray-400"}`} />
                              {link.enabled ? "Active" : "Disabled"}
                            </button>
                          </td>

                          {/* Created */}
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                            {formatDate(link._creationTime)}
                          </td>

                          {/* Last accessed */}
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                            {link.lastAccessedAt ? formatDate(link.lastAccessedAt) : "Never"}
                          </td>

                          {/* Copy */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <button
                              onClick={() => handleCopy(shortUrl)}
                              title="Copy short link"
                              className="text-gray-400 hover:text-blue-600 transition-colors text-xs px-2 py-1 rounded hover:bg-blue-50"
                            >
                              {isCopied ? "Copied!" : "Copy"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}