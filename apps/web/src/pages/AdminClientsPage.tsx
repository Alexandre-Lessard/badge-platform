import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-utils";
import { useLanguage } from "@/i18n/context";

type Client = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  clientNumber: string | null;
  emailVerified: boolean;
  createdAt: string;
};

export function AdminClientsPage() {
  const { t, locale } = useLanguage();
  const cli = t.admin?.clients;
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    const url = query
      ? `/admin/clients?q=${encodeURIComponent(query)}`
      : "/admin/clients";
    apiRequest<{ clients: Client[]; total: number }>(url)
      .then((data) => {
        if (!cancelled) {
          setClients(data.clients);
          setTotal(data.total);
        }
      })
      .catch((err) => { if (!cancelled) setError(getErrorMessage(err, t)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query, t]);

  return (
    <section className="min-h-[80vh] bg-[var(--rcb-white)]">
      <title>{`Admin — ${t.admin?.nav.clients ?? "Clients"} | Badge`}</title>
      <div className="section-shell py-16">
        <h1 className="text-3xl font-bold text-[var(--rcb-text-strong)]">
          {t.admin?.nav.clients ?? "Clients"}
        </h1>
        <p className="mt-1 text-sm text-[var(--rcb-text-muted)]">
          {total} {total > 1 ? (cli?.countMany ?? "clients") : (cli?.countOne ?? "client")}
        </p>

        <form
          className="mt-6 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const next = search.trim();
            // Only show the spinner when the effect will actually refetch.
            if (next !== query) setLoading(true);
            setQuery(next);
          }}
        >
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={cli?.searchPlaceholder ?? "Nom, courriel, n° client…"}
            className="h-11 w-full max-w-sm rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-sm text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
          />
          <button
            type="submit"
            className="cursor-pointer rounded-lg bg-[var(--rcb-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            {cli?.searchButton ?? "Rechercher"}
          </button>
        </form>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-16 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--rcb-primary)] border-t-transparent" />
          </div>
        ) : clients.length === 0 ? (
          <div className="mt-10 rounded-xl border border-[var(--rcb-border)] bg-[var(--rcb-surface)] p-10 text-center">
            <p className="text-[var(--rcb-text-muted)]">{cli?.empty ?? "Aucun client."}</p>
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-xl border border-[var(--rcb-border)]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[var(--rcb-surface)] text-xs uppercase text-[var(--rcb-text-muted)]">
                <tr>
                  <th className="px-5 py-3 font-semibold">{cli?.colName ?? "Nom"}</th>
                  <th className="px-5 py-3 font-semibold">{cli?.colEmail ?? "Courriel"}</th>
                  <th className="px-5 py-3 font-semibold">{cli?.colClientNumber ?? "N° client"}</th>
                  <th className="px-5 py-3 font-semibold">{cli?.colRegisteredAt ?? "Inscrit le"}</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-t border-[var(--rcb-border)]">
                    <td className="px-5 py-3 font-medium text-[var(--rcb-text-strong)]">
                      {`${c.firstName} ${c.lastName}`.trim() || "—"}
                    </td>
                    <td className="px-5 py-3 text-[var(--rcb-text-body)]">
                      {c.email}
                      {!c.emailVerified && (
                        <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                          {cli?.unverified ?? "non vérifié"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[var(--rcb-text-muted)]">{c.clientNumber ?? "—"}</td>
                    <td className="px-5 py-3 text-[var(--rcb-text-muted)]">
                      {new Date(c.createdAt).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
export default AdminClientsPage;
