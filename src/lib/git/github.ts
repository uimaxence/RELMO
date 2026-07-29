import "server-only";

// Lecture des commits d'un repo GitHub sur une période, pour alimenter le résumé
// de travail du rapport mensuel. Même philosophie que les autres connecteurs :
// dégradation propre sans token (GITHUB_TOKEN absent → { ok:false }), jamais de throw.

export function githubConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN);
}

// Extrait owner/repo depuis une URL de repo (https, ssh, avec ou sans .git).
export function parseRepo(url: string): { owner: string; repo: string } | null {
  if (!url) return null;
  const cleaned = url.trim().replace(/\.git$/, "");
  // git@github.com:owner/repo
  const ssh = cleaned.match(/github\.com[:/]([^/]+)\/([^/]+)$/i);
  if (ssh) return { owner: ssh[1], repo: ssh[2] };
  return null;
}

export type CommitInfo = { message: string; date: string; sha: string };

type CommitResult = { ok: true; commits: CommitInfo[] } | { ok: false; error: string };

// Liste les commits d'un repo entre deux dates (ISO). Une page (100 max) : suffisant
// pour un mois de travail sur un site vitrine ; au-delà on tronque (signalé).
export async function listerCommits(opts: {
  repoUrl: string;
  since: Date;
  until: Date;
}): Promise<CommitResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { ok: false, error: "Token GitHub absent. Ajoute GITHUB_TOKEN dans .env." };
  }
  const repo = parseRepo(opts.repoUrl);
  if (!repo) {
    return { ok: false, error: `URL de repo GitHub non reconnue : ${opts.repoUrl}` };
  }

  const params = new URLSearchParams({
    since: opts.since.toISOString(),
    until: opts.until.toISOString(),
    per_page: "100",
  });
  const url = `https://api.github.com/repos/${repo.owner}/${repo.repo}/commits?${params}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `GitHub a répondu ${res.status}. ${body.slice(0, 160)}` };
    }
    const data = (await res.json()) as Array<{
      sha: string;
      commit: { message: string; author?: { date?: string } };
    }>;
    const commits: CommitInfo[] = data.map((c) => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split("\n")[0], // 1re ligne = résumé du commit
      date: c.commit.author?.date ?? "",
    }));
    return { ok: true, commits };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "erreur inconnue";
    return { ok: false, error: `Échec d'appel GitHub : ${reason}` };
  }
}
