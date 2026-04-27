// AIGC START
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { contentBundleSchema } from '../../shared/content-schema.js';
const dialogueIndexCache = new WeakMap();
export async function loadContentBundle(contentRoot) {
    // AIGC START
    const dialoguesRoot = path.join(contentRoot, 'dialogues');
    const manifestPath = path.join(dialoguesRoot, 'index.json');
    const manifestRaw = await readFile(manifestPath, 'utf8');
    const manifest = parseDialogueManifest(JSON.parse(manifestRaw));
    const bundles = await Promise.all(manifest.bundles.map(async (bundleFile) => {
        const filePath = path.join(dialoguesRoot, bundleFile);
        const raw = await readFile(filePath, 'utf8');
        return contentBundleSchema.parse(JSON.parse(raw));
    }));
    const bundle = contentBundleSchema.parse({
        dialogues: bundles.flatMap((item) => item.dialogues),
    });
    // AIGC END
    // AIGC START
    dialogueIndexCache.set(bundle, buildDialogueIndex(bundle));
    // AIGC END
    return bundle;
}
export function pickDialogue(bundle, type, indexSeed, relationshipTier) {
    // AIGC START
    const scoped = getDialogueIndex(bundle).get(type);
    const lines = scoped?.all ?? [];
    // AIGC END
    if (lines.length === 0) {
        throw new Error(`Missing dialogue content for type: ${type}`);
    }
    // AIGC START
    const scopedLines = resolveScopedDialogueLines(scoped, relationshipTier);
    // AIGC END
    return scopedLines[indexSeed % scopedLines.length];
}
// AIGC START
function resolveScopedDialogueLines(scoped, relationshipTier) {
    if (!relationshipTier) {
        return scoped.all;
    }
    const exactTierLines = scoped.byTier[relationshipTier] ?? [];
    if (exactTierLines.length > 0) {
        return exactTierLines;
    }
    const genericLines = scoped.generic;
    if (genericLines.length > 0) {
        return genericLines;
    }
    throw new Error(`Missing dialogue content for relationship tier: ${relationshipTier}`);
}
function getDialogueIndex(bundle) {
    const cached = dialogueIndexCache.get(bundle);
    if (cached) {
        return cached;
    }
    const built = buildDialogueIndex(bundle);
    dialogueIndexCache.set(bundle, built);
    return built;
}
function buildDialogueIndex(bundle) {
    const index = new Map();
    for (const line of bundle.dialogues) {
        const existing = index.get(line.type);
        const scoped = existing ??
            {
                all: [],
                generic: [],
                byTier: {},
            };
        scoped.all.push(line);
        if (line.relationshipTier) {
            const tierBucket = scoped.byTier[line.relationshipTier] ?? [];
            tierBucket.push(line);
            scoped.byTier[line.relationshipTier] = tierBucket;
        }
        else {
            scoped.generic.push(line);
        }
        if (!existing) {
            index.set(line.type, scoped);
        }
    }
    return index;
}
function parseDialogueManifest(input) {
    if (!input ||
        typeof input !== 'object' ||
        !('bundles' in input) ||
        !Array.isArray(input.bundles)) {
        throw new Error('Invalid dialogues manifest: expected { bundles: string[] }');
    }
    const bundles = (input.bundles).filter((value) => typeof value === 'string' && value.length > 0);
    if (bundles.length === 0) {
        throw new Error('Invalid dialogues manifest: bundles cannot be empty');
    }
    return { bundles };
}
// AIGC END
// AIGC END
//# sourceMappingURL=content-loader.js.map