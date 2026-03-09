"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useCallback } from "react";

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

export default function Home() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const links = useQuery(api.links.listLinks);
  const createLink = useMutation(api.links.createLink);

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

      setError(null);
      setIsSubmitting(true);
      try {
        await createLink({ originalUrl: trimmed });
        setInput("");
      } catch {
        setError("Failed to create short link. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [input, createLink]
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

  const origin = getOrigin();

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">URL Shortener</h1>
          <p className="text-gray-500 text-lg">Paste a long link, get a short one. Track every click.</p>
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-6 mb-8">
          <label htmlFor="url-input" className="block text-sm font-medium text-gray-700 mb-2">
            Long URL
          </label>
          <div className="flex gap-3">
            <input
              id="url-input"
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (error) setError(null);
              }}
              placeholder="https://example.com/very/long/path?query=something"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
            >
              {isSubmitting ? "Shortening…" : "Shorten"}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
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
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-medium text-gray-600 w-1/2">Original URL</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Short Link</th>
                    <th className="text-center px-5 py-3 font-medium text-gray-600">Clicks</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {links.map((link) => {
                    const shortUrl = `${origin}/${link.slug}`;
                    const isCopied = copied === shortUrl;
                    return (
                      <tr key={link._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 max-w-0">
                          <a
                            href={link.originalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-700 hover:text-blue-600 truncate block"
                            title={link.originalUrl}
                          >
                            {link.originalUrl}
                          </a>
                        </td>
                        <td className="px-5 py-3">
                          <a
                            href={shortUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 font-mono"
                          >
                            {origin}/{link.slug}
                          </a>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className="inline-flex items-center justify-center bg-gray-100 text-gray-700 rounded-full px-3 py-0.5 font-semibold tabular-nums">
                            {link.clicks}
                          </span>
                        </td>
                        <td className="px-3 py-3">
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
          )}
        </section>
      </div>
    </main>
  );
}
