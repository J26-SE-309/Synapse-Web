// Ownership guard for Synapse-Web pull requests.
//
// Runs from the default branch through `pull_request_target`, so a pull request
// can never change the rules it is checked against. It does not check out or run
// any pull request code: it only reads the changed-file list and reviews from the
// GitHub API and compares them with .github/ownership.json.

import { appendFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const MAX_PR_FILES = 3000; // The pull request files API stops listing after this many.

const sameLogin = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const underAny = (path, prefixes) => prefixes.some((prefix) => path.startsWith(prefix));

/** Returns the developer branch whose module contains `path`, or null for shared files. */
export function ownerOf(path, config) {
  for (const [branch, developer] of Object.entries(config.developers)) {
    if (underAny(path, developer.paths)) return branch;
  }
  return null;
}

/** True when the lead's latest decisive review approves exactly the commit being checked. */
export function isApprovedByLead(reviews, lead, headSha) {
  const decisive = reviews.filter(
    (review) => sameLogin(review.user?.login, lead) && ['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state),
  );
  const latest = decisive.at(-1);
  return latest?.state === 'APPROVED' && latest.commit_id === headSha;
}

/**
 * Applies the branch and ownership rules to one pull request.
 * `files` are pull request file entries ({ filename, previous_filename? }).
 */
export function evaluate({ config, pr, files, leadApprovedHead }) {
  const errors = [];
  const notes = [];
  const { lead, leadBranch, integrationBranch, releaseBranch, developers } = config;

  if (pr.headRepo !== pr.baseRepo) {
    errors.push(`Pull requests must come from a branch of ${pr.baseRepo}, not from a fork (${pr.headRepo}).`);
    return { errors, notes };
  }

  if (pr.baseRef === releaseBranch) {
    if (pr.headRef !== integrationBranch) {
      errors.push(`Only \`${integrationBranch}\` can be merged into \`${releaseBranch}\`. This pull request is from \`${pr.headRef}\`.`);
    } else {
      notes.push(`\`${integrationBranch}\` → \`${releaseBranch}\` release pull request.`);
    }
    return { errors, notes };
  }

  if (pr.baseRef !== integrationBranch) {
    notes.push(`No ownership rules apply to pull requests into \`${pr.baseRef}\`.`);
    return { errors, notes };
  }

  const developer = developers[pr.headRef];
  if (!developer) {
    const allowed = Object.keys(developers).map((branch) => `\`${branch}\``).join(', ');
    errors.push(`Pull requests into \`${integrationBranch}\` must come from a developer branch (${allowed}). This one is from \`${pr.headRef}\`.`);
    return { errors, notes };
  }

  if (!sameLogin(pr.author, developer.github) && !sameLogin(pr.author, lead)) {
    errors.push(`\`${pr.headRef}\` belongs to @${developer.github}, but this pull request was opened by @${pr.author}.`);
  }

  const isLeadBranch = pr.headRef === leadBranch;
  const othersFiles = [];
  const leadOnlyFiles = [];
  const sharedFiles = [];

  for (const file of files) {
    // A rename touches two paths: the file is removed from one place and added to another.
    const paths = new Set([file.filename, file.previous_filename].filter(Boolean));
    for (const path of paths) {
      const owner = ownerOf(path, config);
      if (owner === pr.headRef) continue;
      if (owner) othersFiles.push({ path, owner });
      else if (underAny(path, config.leadOnlyPaths)) {
        if (!isLeadBranch) leadOnlyFiles.push(path);
      } else if (!isLeadBranch) sharedFiles.push(path);
    }
  }

  for (const { path, owner } of othersFiles) {
    errors.push(`\`${path}\` is in ${owner}'s module (@${developers[owner].github}). Only \`${owner}\` can change it.`);
  }
  for (const path of leadOnlyFiles) {
    errors.push(`\`${path}\` is repository/CI configuration. Only @${lead} can change it, from \`${leadBranch}\`.`);
  }
  if (sharedFiles.length > 0) {
    const list = sharedFiles.map((path) => `\`${path}\``).join(', ');
    if (leadApprovedHead) {
      notes.push(`Shared files changed with @${lead}'s approval: ${list}.`);
    } else {
      errors.push(`Shared files changed: ${list}. @${lead} must approve this pull request, then re-run this check.`);
    }
  }

  if (errors.length === 0) {
    notes.push(`All ${files.length} changed file(s) are inside ${pr.headRef}'s module${sharedFiles.length ? ' or approved shared files' : ''}.`);
  }
  return { errors, notes };
}

async function paginate(path) {
  const api = process.env.GITHUB_API_URL ?? 'https://api.github.com';
  const items = [];
  for (let page = 1; ; page++) {
    const response = await fetch(`${api}${path}?per_page=100&page=${page}`, {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        'x-github-api-version': '2022-11-28',
      },
    });
    if (!response.ok) throw new Error(`GitHub API returned ${response.status} for ${path}: ${await response.text()}`);
    const batch = await response.json();
    items.push(...batch);
    if (batch.length < 100) return items;
  }
}

async function main() {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const config = JSON.parse(await readFile(new URL('../ownership.json', import.meta.url), 'utf8'));
  const pull = event.pull_request;
  const repo = pull.base.repo.full_name;

  const pr = {
    baseRef: pull.base.ref,
    headRef: pull.head.ref,
    baseRepo: repo,
    headRepo: pull.head.repo?.full_name ?? '(deleted fork)',
    author: pull.user.login,
  };
  const files = await paginate(`/repos/${repo}/pulls/${pull.number}/files`);
  const reviews = await paginate(`/repos/${repo}/pulls/${pull.number}/reviews`);
  const leadApprovedHead = isApprovedByLead(reviews, config.lead, pull.head.sha);

  const result = evaluate({ config, pr, files, leadApprovedHead });
  if (files.length >= MAX_PR_FILES) {
    result.errors.push(`This pull request changes ${MAX_PR_FILES}+ files, which is too many to check. Split it into smaller pull requests.`);
  }

  for (const error of result.errors) console.log(`::error title=Ownership guard::${error}`);
  for (const note of result.notes) console.log(note);

  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [`## Ownership guard: \`${pr.headRef}\` → \`${pr.baseRef}\``, ''];
    lines.push(result.errors.length ? '**Blocked**' : '**Passed**', '');
    for (const error of result.errors) lines.push(`- ❌ ${error}`);
    for (const note of result.notes) lines.push(`- ✅ ${note}`);
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
  }

  process.exitCode = result.errors.length ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
