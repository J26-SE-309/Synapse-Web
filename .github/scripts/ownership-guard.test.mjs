import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { evaluate, isApprovedByLead, ownerOf } from './ownership-guard.mjs';

const config = JSON.parse(readFileSync(new URL('../ownership.json', import.meta.url), 'utf8'));
const REPO = 'J26-SE-309/Synapse-Web';

const pr = (overrides = {}) => ({
  baseRef: 'dev',
  headRef: 'ama',
  baseRepo: REPO,
  headRepo: REPO,
  author: 'AmaLiyanage',
  ...overrides,
});
const files = (...names) => names.map((filename) => ({ filename }));
const check = (prOverrides, changed, leadApprovedHead = false) =>
  evaluate({ config, pr: pr(prOverrides), files: changed, leadApprovedHead });

describe('ownership.json', () => {
  it('gives every developer branch at least one module path ending in "/"', () => {
    for (const [branch, developer] of Object.entries(config.developers)) {
      assert.ok(developer.paths.length > 0, branch);
      for (const path of developer.paths) assert.ok(path.endsWith('/'), `${branch}: ${path}`);
    }
  });

  it('has no module path inside another module path', () => {
    const all = Object.values(config.developers).flatMap((developer) => developer.paths);
    for (const a of all) for (const b of all) if (a !== b) assert.ok(!a.startsWith(b), `${a} is inside ${b}`);
  });

  it('includes the lead branch as a developer branch', () => {
    assert.ok(config.developers[config.leadBranch]);
    assert.equal(config.developers[config.leadBranch].github, config.lead);
  });
});

describe('ownerOf', () => {
  it('maps module files to their branch', () => {
    assert.equal(ownerOf('src/app/(modules)/traceability/graph/Graph.tsx', config), 'lakviru');
    assert.equal(ownerOf('src/app/(modules)/effort-estimation/index.ts', config), 'nikeshala');
  });

  it('does not match a sibling folder that only shares a name prefix', () => {
    assert.equal(ownerOf('src/app/(modules)/traceability-old/x.ts', config), null);
  });

  it('gives each developer their component contract', () => {
    assert.equal(ownerOf('contracts/traceability/coverage-response.schema.json', config), 'lakviru');
    assert.equal(ownerOf('contracts/story-refinement/examples/refined-story.json', config), 'sathmi');
  });

  it('treats everything outside the modules and contracts as shared', () => {
    assert.equal(ownerOf('package.json', config), null);
    assert.equal(ownerOf('src/shared/components/Sidebar.tsx', config), null);
    assert.equal(ownerOf('src/app/layout.tsx', config), null);
    assert.equal(ownerOf('gateway/app/orchestration.py', config), null);
    assert.equal(ownerOf('contracts/common/pipeline-run-request.schema.json', config), null);
  });
});

describe('pull requests into dev', () => {
  it('passes when a developer only changes their own module', () => {
    const { errors } = check({}, files('src/app/(modules)/requirement-quality/Page.tsx', 'src/app/(modules)/requirement-quality/Page.test.tsx'));
    assert.deepEqual(errors, []);
  });

  it("blocks changes to another developer's module", () => {
    const { errors } = check({}, files('src/app/(modules)/requirement-quality/a.ts', 'src/app/(modules)/story-refinement/b.ts'));
    assert.equal(errors.length, 1);
    assert.match(errors[0], /story-refinement\/b\.ts.*sathmi/);
  });

  it("blocks deleting another developer's file", () => {
    const { errors } = check({}, [{ filename: 'src/app/(modules)/traceability/old.ts', status: 'removed' }]);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /lakviru/);
  });

  it("blocks renaming a file out of another developer's module", () => {
    const { errors } = check({}, [
      { filename: 'src/app/(modules)/requirement-quality/stolen.ts', previous_filename: 'src/app/(modules)/traceability/stolen.ts', status: 'renamed' },
    ]);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /traceability\/stolen\.ts/);
  });

  it('blocks shared files until the lead approves the current commit', () => {
    assert.match(check({}, files('package.json')).errors[0], /Shared files changed.*package\.json.*must approve/);
    assert.deepEqual(check({}, files('package.json'), true).errors, []);
  });

  it("does not let lead approval unlock another developer's module", () => {
    const { errors } = check({}, files('src/app/(modules)/traceability/x.ts'), true);
    assert.equal(errors.length, 1);
  });

  it('blocks CI/config changes from non-lead branches, even with approval', () => {
    const { errors } = check({}, files('.github/workflows/ci.yml'), true);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /Only @Nikeshala22/);
  });

  it('lets the lead branch change shared and CI files without approval', () => {
    const { errors } = check(
      { headRef: 'nikeshala', author: 'Nikeshala22' },
      files('src/app/(modules)/effort-estimation/a.ts', 'package.json', '.github/ownership.json'),
    );
    assert.deepEqual(errors, []);
  });

  it("still blocks the lead branch from changing another developer's module", () => {
    const { errors } = check({ headRef: 'nikeshala', author: 'Nikeshala22' }, files('src/app/(modules)/requirement-quality/a.ts'));
    assert.equal(errors.length, 1);
  });

  it('blocks pull requests from branches that are not developer branches', () => {
    const { errors } = check({ headRef: 'feature/x' }, files('src/app/(modules)/requirement-quality/a.ts'));
    assert.match(errors[0], /must come from a developer branch/);
  });

  it('blocks a pull request opened from someone else’s branch', () => {
    const { errors } = check({ headRef: 'lakviru', author: 'AmaLiyanage' }, files('src/app/(modules)/traceability/a.ts'));
    assert.match(errors[0], /belongs to @dinuwa2500/);
  });

  it("allows the lead to open a pull request from a developer's branch", () => {
    const { errors } = check({ headRef: 'lakviru', author: 'Nikeshala22' }, files('src/app/(modules)/traceability/a.ts'));
    assert.deepEqual(errors, []);
  });

  it('matches GitHub logins case-insensitively', () => {
    const { errors } = check({ author: 'amaliyanage' }, files('src/app/(modules)/requirement-quality/a.ts'));
    assert.deepEqual(errors, []);
  });

  it('blocks pull requests from forks', () => {
    const { errors } = check({ headRepo: 'someone/Synapse-Web' }, files('src/app/(modules)/requirement-quality/a.ts'));
    assert.match(errors[0], /not from a fork/);
  });
});

describe('pull requests into main', () => {
  it('passes from dev', () => {
    assert.deepEqual(check({ baseRef: 'main', headRef: 'dev', author: 'Nikeshala22' }, files('package.json')).errors, []);
  });

  it('blocks every other branch', () => {
    const { errors } = check({ baseRef: 'main', headRef: 'nikeshala', author: 'Nikeshala22' }, files('README.md'));
    assert.match(errors[0], /Only `dev` can be merged into `main`/);
  });
});

describe('isApprovedByLead', () => {
  const review = (login, state, commit_id = 'head') => ({ user: { login }, state, commit_id });

  it('accepts an approval of the current commit', () => {
    assert.equal(isApprovedByLead([review('Nikeshala22', 'APPROVED')], 'Nikeshala22', 'head'), true);
  });

  it('ignores approvals of an older commit', () => {
    assert.equal(isApprovedByLead([review('Nikeshala22', 'APPROVED', 'old')], 'Nikeshala22', 'head'), false);
  });

  it('ignores approvals from other people', () => {
    assert.equal(isApprovedByLead([review('AmaLiyanage', 'APPROVED')], 'Nikeshala22', 'head'), false);
  });

  it('uses the latest decisive review, skipping plain comments', () => {
    const reviews = [review('Nikeshala22', 'APPROVED'), review('Nikeshala22', 'CHANGES_REQUESTED'), review('Nikeshala22', 'COMMENTED')];
    assert.equal(isApprovedByLead(reviews, 'Nikeshala22', 'head'), false);
  });

  it('treats a dismissed approval as not approved', () => {
    assert.equal(isApprovedByLead([review('Nikeshala22', 'APPROVED'), review('Nikeshala22', 'DISMISSED')], 'Nikeshala22', 'head'), false);
  });
});
