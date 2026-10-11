#!/usr/bin/env node
//
// Enforces the contract src/tour/targets.js declares for itself.
//
// A tour breaks silently: rename a `data-tour` attribute and the step that
// pointed at it is skipped as "element not present for this user", which is the
// same thing that legitimately happens for permission-gated steps. Nothing
// throws, nothing logs, the step just quietly stops existing. This script is
// what turns that into a failed commit.
//
// Four checks:
//   1. Every `TOUR.<group>.<key>` accessor in the codebase resolves to a
//      declared id. (The dev-only Proxy in targets.js catches this at runtime;
//      this catches it without opening a browser, and on paths — admin menus,
//      error states — that a manual click-through rarely reaches.)
//   2. Every declared id is referenced by a component. An id with no element is
//      rule 1 of targets.js: a validator false-negative waiting to happen.
//   3. Every id a tour step points at is referenced by a component, so no step
//      is anchored to nothing.
//   4. No raw `data-tour="literal"` strings — they bypass both the registry and
//      the typo guard.
//
// Usage: npm run lint:tours   (from client/, or `npm run lint:tours` at root)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CLIENT_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC_DIR = join(CLIENT_DIR, 'src');
const TARGETS_FILE = join(SRC_DIR, 'tour', 'targets.js');
const STEPS_FILE = join(SRC_DIR, 'tour', 'steps.js');

// Files that reference targets without rendering them. The runner and the
// spotlight take an id as data, so a mention there is not proof of an element.
const NON_RENDERING = new Set([
    TARGETS_FILE,
    STEPS_FILE,
    join(SRC_DIR, 'tour', 'TourProvider.jsx'),
    join(SRC_DIR, 'tour', 'TourSpotlight.jsx'),
]);

const SOURCE_EXTENSIONS = /\.(js|jsx)$/;
const ACCESSOR = /\bTOUR\.([A-Za-z0-9_$]+)\.([A-Za-z0-9_$]+)/g;
const LITERAL_ATTR = /data-tour\s*=\s*["']([^"']+)["']/g;

const collectFiles = (dir) => {
    const found = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules') continue;
            found.push(...collectFiles(path));
        } else if (SOURCE_EXTENSIONS.test(entry.name)) {
            found.push(path);
        }
    }
    return found;
};

/** 1-based line number of a match, for click-through error output. */
const lineOf = (content, index) => content.slice(0, index).split('\n').length;

const main = async () => {
    if (!statSync(TARGETS_FILE, { throwIfNoEntry: false })) {
        console.error(`[tour] Cannot find ${relative(CLIENT_DIR, TARGETS_FILE)}`);
        process.exit(1);
    }

    // targets.js reads `import.meta.env?.DEV`, which is simply undefined under
    // plain Node — the module falls back to its unguarded tables.
    const { ALL_TOUR_TARGETS } = await import(pathToFileURL(TARGETS_FILE).href);
    const declared = new Set(ALL_TOUR_TARGETS);

    const renderedBy = new Map();  // id -> [file:line]
    const steppedBy = new Map();   // id -> [file:line]
    const unknown = [];            // accessors with no declaration
    const literals = [];           // raw data-tour strings

    for (const file of collectFiles(SRC_DIR)) {
        if (file === TARGETS_FILE) continue;
        const content = readFileSync(file, 'utf8');
        const where = (index) => `${relative(CLIENT_DIR, file)}:${lineOf(content, index)}`;
        const isRenderer = !NON_RENDERING.has(file);

        for (const match of content.matchAll(ACCESSOR)) {
            const id = `${match[1]}.${match[2]}`;
            if (!declared.has(id)) {
                unknown.push({ id, at: where(match.index) });
                continue;
            }
            const bucket = isRenderer ? renderedBy : steppedBy;
            if (!bucket.has(id)) bucket.set(id, []);
            bucket.get(id).push(where(match.index));
        }

        for (const match of content.matchAll(LITERAL_ATTR)) {
            literals.push({ id: match[1], at: where(match.index) });
        }
    }

    const problems = [];

    if (unknown.length) {
        problems.push([
            'Unknown tour targets (declare them in src/tour/targets.js, or fix the typo):',
            ...unknown.map(({ id, at }) => `  ${at}  TOUR.${id}`),
        ]);
    }

    const orphanIds = [...declared].filter((id) => !renderedBy.has(id));
    if (orphanIds.length) {
        problems.push([
            'Declared but never rendered — remove from targets.js or add the attribute to the JSX:',
            ...orphanIds.map((id) => `  ${id}`),
        ]);
    }

    const danglingSteps = [...steppedBy.entries()].filter(([id]) => !renderedBy.has(id));
    if (danglingSteps.length) {
        problems.push([
            'Tour steps anchored to a target no component renders:',
            ...danglingSteps.map(([id, locations]) => `  ${locations[0]}  ${id}`),
        ]);
    }

    if (literals.length) {
        problems.push([
            'Hard-coded data-tour strings — import TOUR from src/tour/targets.js instead:',
            ...literals.map(({ id, at }) => `  ${at}  data-tour="${id}"`),
        ]);
    }

    if (problems.length) {
        console.error('\n[tour] Target validation failed\n');
        for (const block of problems) {
            console.error(block.join('\n'));
            console.error('');
        }
        process.exit(1);
    }

    console.log(
        `[tour] ${declared.size} targets declared, all rendered; `
        + `${steppedBy.size} referenced by tour steps.`,
    );
};

main().catch((error) => {
    console.error('[tour] Validator crashed:', error);
    process.exit(1);
});