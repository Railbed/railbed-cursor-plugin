#!/usr/bin/env node
// Checks the Railbed plugin for Cursor and Grok Bot before it is published.
//
//   node scripts/validate.mjs          (from the plugin root; Node 20 or later, no dependencies)
//
// It exits 1 and lists every problem when a check fails. The checks:
//   - .cursor-plugin/plugin.json follows Cursor's published plugin schema (https://github.com/cursor/plugins/tree/main/schemas)
//     and its submission checklist: known keys only, a lowercase name, a strict semantic version, an author with a name and
//     email, https homepage and repository, the MIT licence, a committed logo, and relative paths that stay in the plugin.
//   - .cursor-plugin/marketplace.json lists this plugin under the same name and version.
//   - CHANGELOG.md's newest "## <version>" heading is the plugin's version.
//   - mcp.json connects only to Railbed's hosted server over https, and carries no headers, credentials, commands or
//     ${VARIABLE} placeholders (the plugin declares no variables; sign-in happens in the browser).
//   - Skills, rules, agents and commands have the frontmatter Cursor reads.
//   - Only expected files: no symlinks, no file over 1 MB, no node_modules, no .env files, no executable files and no hooks.
//   - No secrets and no misleading product names in any text file (see "What the secret scan allows" below).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Every key Cursor's plugin schema allows (its "additionalProperties": false).
const PLUGIN_KEYS = ['name', 'displayName', 'description', 'version', 'minClientVersions', 'author', 'publisher', 'homepage',
  'repository', 'license', 'logo', 'keywords', 'category', 'tags', 'commands', 'agents', 'skills', 'rules', 'hooks', 'variables',
  'mcpServers'];
const MARKETPLACE_KEYS = ['name', 'owner', 'metadata', 'plugins'];
const MARKETPLACE_ENTRY_KEYS = ['name', 'source', 'description', 'minClientVersions'];
const PERSON_KEYS = ['name', 'email'];
const PLUGIN_NAME = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;
const MARKETPLACE_NAME = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const COMPONENT_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// The schema's "semver" definition, copied exactly.
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/;
const EMAIL = /^[^\s@"<>()[\]\\,;:]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
// Client ids Cursor documents for minClientVersions ("sand" is Grok Bot's deprecated id).
const CLIENTS = ['cursor', 'grokbot', 'sand'];
const COMPONENT_FIELDS = ['skills', 'rules', 'agents', 'commands'];
const MCP_HOSTS = new Set(['mcp.railbed.io']);
const MCP_SERVER_KEYS = ['type', 'url'];
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_SKILL_DESCRIPTION = 1024;
const TEXT_EXTENSIONS = new Set(['.json', '.md', '.mdc', '.svg', '.mjs', '.yml', '.txt']);
const BINARY_EXTENSIONS = new Set(['.png']);
const EXTENSIONLESS_FILES = new Set(['LICENSE', '.gitignore']);
// The plugin ships no hooks: a hook runs code on the user's machine without a prompt. Shipping one is a deliberate,
// reviewed decision that starts by changing this line; until then a hooks/ folder or a "hooks" key fails the check.
const SHIPS_HOOKS = false;

// What the secret scan allows. Documentation may show the shape of a credential, never a real one. A match passes only when
// it is plainly a placeholder: it contains "x" four or more times in a row, "...", an ellipsis, angle brackets or one of
// the words example, placeholder, your, redacted, dummy, fake or sample; or it uses fewer than ten distinct characters
// (rb_test_000000000000000000000000). A 0x-prefixed 64-hex value also passes on a line that says it is a transaction or
// hash (tx, txid, transaction, hash), since an on-chain transaction hash has the same shape as a private key. Private key
// blocks never pass. A line of 12, 15, 18, 21 or 24 lowercase words and nothing else reads as a recovery phrase and fails
// unless it repeats words (word word word ...).
const PLACEHOLDER = /x{4,}|\.{3}|\u2026|[<>]|example|placeholder|your|redacted|dummy|fake|sample/i;
const SECRET_PATTERNS = [
  { label: 'a Railbed secret key', pattern: /\brb_(?:live|test)_[A-Za-z0-9_-]{16,}/g },
  { label: 'a webhook signing secret', pattern: /\bwhsec_[A-Za-z0-9_+/=-]{16,}/g },
  { label: 'a private key block', pattern: new RegExp('-'.repeat(5) + 'BEGIN[A-Z0-9 ]*' + '-'.repeat(5), 'g'), strict: true },
  { label: 'a JSON web token', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { label: 'a bearer token', pattern: /\bBearer[ \t]+([A-Za-z0-9._~+/-]{20,}=*)/g },
  { label: 'a 0x-prefixed 64-hex private key', pattern: /\b0x[0-9a-fA-F]{64}\b/g, hashContext: true },
  { label: 'a third-party API token', pattern: /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|xox[abposr]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})/g },
];
const HASH_CONTEXT = /\b(?:tx|txid|tx_hash|txhash|transaction|hash)\b/i;
const PHRASE_LENGTHS = new Set([12, 15, 18, 21, 24]);

// Naming rules for the listing. The names are assembled so this file passes its own scan.
const PROSE_RULES = [
  { pattern: new RegExp('\\bCursor (?:' + 'AI|Code' + ')\\b', 'g'), why: 'call the editor "Cursor", with no suffix' },
  { pattern: new RegExp('\\b(?:Chat' + 'GPT|Co' + 'dex)\\b', 'gi'), why: 'this plugin is for Cursor and Grok Bot; keep other hosts out of it' },
  { pattern: /\p{Emoji_Presentation}|\p{Regional_Indicator}|\uFE0F|\u200D/gu, why: 'no emoji' },
];

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const toPosix = path => path.split(sep).join('/');

/**
 * Minimal YAML frontmatter reader for the simple shapes Cursor's components use: `key: value` (plain, 'single' or
 * "double" quoted), folded or literal block scalars (`>`, `>-`, `|`, `|-`), plain values continued on indented lines and
 * `- item` lists. Returns { fields } or { error }.
 */
export function parseFrontmatter(text) {
  const source = text.replace(/\r\n/g, '\n');
  const match = /^---\n(?:([\s\S]*?)\n)?---[ \t]*(?:\n|$)/.exec(source);
  if (!match) return { error: 'missing YAML frontmatter (the file must start with a line "---" and close it with another)' };
  const lines = (match[1] ?? '').split('\n');
  const fields = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const pair = /^([A-Za-z_][A-Za-z0-9_-]*):(?:[ \t]+(.*?))?[ \t]*$/.exec(line);
    if (!pair) return { error: `frontmatter line ${i + 2} is not a "key: value" pair` };
    const [, key, raw = ''] = pair;
    if (Object.hasOwn(fields, key)) return { error: `frontmatter repeats "${key}"` };
    const continued = [];
    while (i + 1 < lines.length && (/^[ \t]/.test(lines[i + 1]) || lines[i + 1].trim() === '')) continued.push(lines[++i]);
    while (continued.length && continued.at(-1).trim() === '') continued.pop();
    const value = frontmatterValue(raw, continued);
    if (value.error) return { error: `frontmatter "${key}": ${value.error}` };
    fields[key] = value.value;
  }
  return { fields };
}

function frontmatterValue(raw, continued) {
  const indent = Math.min(...continued.filter(line => line.trim()).map(line => line.search(/\S/)));
  const body = continued.map(line => (line.trim() ? line.slice(indent) : ''));
  if (/^[>|][+-]?$/.test(raw)) {
    if (raw[0] === '|') return { value: body.join('\n').trim() };
    // Folded: single line breaks become spaces, blank lines become line breaks.
    return { value: body.join('\n').replace(/([^\n])\n(?=[^\n])/g, '$1 ').replace(/\n\n/g, '\n').trim() };
  }
  if (raw === '' && body.length && body.every(line => !line || /^- /.test(line))) {
    return { value: body.filter(Boolean).map(line => line.slice(2).trim().replace(/^(['"])(.*)\1$/, '$2')) };
  }
  const joined = [raw, ...body.map(line => line.trim())].filter(Boolean).join(' ');
  if (raw.startsWith('"')) {
    try { return { value: JSON.parse(joined) }; } catch { return { error: 'unterminated or invalid double-quoted value' }; }
  }
  if (raw.startsWith("'")) {
    if (!/^'(?:[^']|'')*'$/.test(joined)) return { error: 'unterminated single-quoted value' };
    return { value: joined.slice(1, -1).replace(/''/g, "'") };
  }
  if (/^[@`]/.test(joined)) return { error: 'a plain value cannot start with @ or `; quote it' };
  if (/:\s/.test(joined) || /:$/.test(joined)) return { error: 'a plain value contains ": ", which YAML reads as a new key; quote it or use >-' };
  if (/\s#/.test(joined)) return { error: 'a plain value contains " #", which YAML reads as a comment; quote it or use >-' };
  return { value: joined };
}

function isSafeRelativePath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\\') || value.includes('\0')) return false;
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value) || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return false;
  return !value.split('/').includes('..');
}

function gitTrackedFiles(root) {
  try {
    const top = execFileSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (realpathSync(top) !== realpathSync(root)) return null;
    return new Set(execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\0').filter(Boolean));
  } catch {
    return null;
  }
}

/**
 * Validates the plugin folder at `root`. Never throws for a plugin problem; returns every error found, plus the
 * deterministic file inventory (sorted POSIX paths with size and sha256) that a publish copies byte for byte.
 */
export function validatePlugin(root = process.cwd()) {
  root = resolve(root);
  const errors = [];
  const fail = message => errors.push(message);
  const files = [];
  const texts = new Map();

  // Inventory: every file that would be published.
  const walk = directory => {
    for (const name of readdirSync(directory).sort()) {
      const full = join(directory, name), rel = toPosix(relative(root, full));
      if (directory === root && name === '.git') continue;
      if (name === '.DS_Store') continue; // Finder metadata: ignored by .gitignore and never published.
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) { fail(`${rel}: symlinks are not allowed in the plugin`); continue; }
      if (stat.isDirectory()) {
        if (name === 'node_modules') { fail(`${rel}/: node_modules must never be published`); continue; }
        if (rel === 'hooks' && !SHIPS_HOOKS) fail('hooks/: the plugin ships no hooks (see SHIPS_HOOKS in scripts/validate.mjs)');
        walk(full);
        continue;
      }
      if (!stat.isFile()) { fail(`${rel}: not a regular file`); continue; }
      if (/^\.env(?:\..*)?$/i.test(name)) { fail(`${rel}: .env files must never be published`); continue; }
      if (stat.size > MAX_FILE_BYTES) fail(`${rel}: ${stat.size} bytes; files must be 1 MB or smaller`);
      if (stat.mode & 0o111) fail(`${rel}: executable files are not allowed (run scripts with node; chmod -x the file)`);
      const extension = extname(name).toLowerCase();
      const known = TEXT_EXTENSIONS.has(extension) || BINARY_EXTENSIONS.has(extension) || (EXTENSIONLESS_FILES.has(name) && directory === root);
      if (!known) fail(`${rel}: unexpected file type (allowed: ${[...TEXT_EXTENSIONS, ...BINARY_EXTENSIONS].join(' ')}, LICENSE and .gitignore)`);
      const bytes = readFileSync(full);
      files.push({ path: rel, bytes: stat.size, sha256: sha256(bytes) });
      if (!BINARY_EXTENSIONS.has(extension)) texts.set(rel, bytes.toString('utf8'));
    }
  };
  walk(root);
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const has = path => files.some(file => file.path === path);
  const hasDirectory = path => files.some(file => file.path.startsWith(path.replace(/\/?$/, '/')));

  const readJson = path => {
    if (!texts.has(path)) { fail(`${path}: missing`); return null; }
    try { return JSON.parse(texts.get(path)); } catch (error) { fail(`${path}: invalid JSON (${error.message})`); return null; }
  };
  const checkKeys = (value, allowed, where) => {
    for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${where}: unknown key "${key}" (allowed: ${allowed.join(', ')})`);
  };
  const checkPerson = (value, where) => {
    if (!isObject(value)) { fail(`${where}: must be an object with a name and email`); return; }
    checkKeys(value, PERSON_KEYS, where);
    if (typeof value.name !== 'string' || !value.name.trim()) fail(`${where}.name: required`);
    if (typeof value.email !== 'string' || !EMAIL.test(value.email)) fail(`${where}.email: must be an email address`);
  };
  const checkClients = (value, where) => {
    if (!isObject(value) || Object.keys(value).length === 0) { fail(`${where}: must be an object with at least one client`); return; }
    for (const [client, version] of Object.entries(value)) {
      if (!CLIENTS.includes(client)) fail(`${where}: unknown client "${client}" (allowed: ${CLIENTS.join(', ')})`);
      if (version !== 'never' && !(typeof version === 'string' && SEMVER.test(version))) fail(`${where}.${client}: must be a strict semantic version or "never"`);
    }
  };
  const checkHttps = (value, where) => {
    let url;
    try { url = new URL(value); } catch { fail(`${where}: must be an https URL`); return null; }
    if (url.protocol !== 'https:' || url.username || url.password) fail(`${where}: must be an https URL without credentials`);
    return url;
  };
  const checkPath = (value, where, kind) => {
    if (!isSafeRelativePath(value)) { fail(`${where}: "${value}" must be a relative path inside the plugin (no "..", no absolute path, no URL)`); return false; }
    if (/[*?[\]{}]/.test(value)) { fail(`${where}: "${value}" must be a plain path, not a glob`); return false; }
    const target = toPosix(relative(root, resolve(root, value)));
    const found = kind === 'directory' ? hasDirectory(target) : has(target);
    if (!found) fail(`${where}: "${value}" does not exist${kind === 'directory' ? ' or is empty' : ''}`);
    return found;
  };

  // plugin.json
  const manifest = readJson('.cursor-plugin/plugin.json');
  if (manifest && !isObject(manifest)) fail('.cursor-plugin/plugin.json: must be a JSON object');
  if (isObject(manifest)) {
    const where = 'plugin.json';
    checkKeys(manifest, PLUGIN_KEYS, where);
    if (typeof manifest.name !== 'string' || !PLUGIN_NAME.test(manifest.name)) fail(`${where}.name: must match ${PLUGIN_NAME}`);
    if (typeof manifest.version !== 'string' || !SEMVER.test(manifest.version)) fail(`${where}.version: must be a strict semantic version such as 1.0.0`);
    if (typeof manifest.description !== 'string' || !manifest.description.trim()) fail(`${where}.description: required`);
    for (const key of ['displayName', 'publisher', 'category']) {
      if (manifest[key] !== undefined && (typeof manifest[key] !== 'string' || !manifest[key].trim())) fail(`${where}.${key}: must be nonblank text`);
    }
    for (const key of ['keywords', 'tags']) {
      if (manifest[key] !== undefined && !(Array.isArray(manifest[key]) && manifest[key].every(item => typeof item === 'string' && item.trim()))) fail(`${where}.${key}: must be a list of text`);
    }
    checkPerson(manifest.author, `${where}.author`);
    for (const key of ['homepage', 'repository']) {
      if (typeof manifest[key] !== 'string') fail(`${where}.${key}: required https URL`);
      else checkHttps(manifest[key], `${where}.${key}`);
    }
    if (manifest.license !== 'MIT') fail(`${where}.license: must be "MIT"`);
    if (manifest.minClientVersions !== undefined) checkClients(manifest.minClientVersions, `${where}.minClientVersions`);
    if (manifest.hooks !== undefined && !SHIPS_HOOKS) fail(`${where}.hooks: the plugin ships no hooks (see SHIPS_HOOKS in scripts/validate.mjs)`);
    if (manifest.variables !== undefined) fail(`${where}.variables: the plugin declares no variables; Railbed sign-in happens in the browser`);

    // Logo: committed, relative, an actual square image.
    if (typeof manifest.logo !== 'string') fail(`${where}.logo: required (a relative path to a committed image)`);
    else if (checkPath(manifest.logo, `${where}.logo`, 'file')) {
      const logo = toPosix(relative(root, resolve(root, manifest.logo)));
      if (!['.png', '.svg'].includes(extname(logo).toLowerCase())) fail(`${where}.logo: must be a .png or .svg file`);
      if (extname(logo).toLowerCase() === '.png') {
        const bytes = readFileSync(join(root, logo));
        const png = bytes.length > 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        if (!png) fail(`${where}.logo: ${logo} is not a PNG file`);
        else if (bytes.readUInt32BE(16) !== bytes.readUInt32BE(20) || bytes.readUInt32BE(16) < 128) fail(`${where}.logo: ${logo} must be square and at least 128 pixels wide`);
      }
      const tracked = gitTrackedFiles(root);
      if (tracked && !tracked.has(logo)) fail(`${where}.logo: ${logo} is not committed (git add it)`);
    }

    // Component paths: a path or list of paths, each relative and present.
    for (const field of COMPONENT_FIELDS) {
      const value = manifest[field];
      if (value === undefined) continue;
      const list = typeof value === 'string' ? [value] : value;
      if (!Array.isArray(list) || list.length === 0 || !list.every(item => typeof item === 'string')) { fail(`${where}.${field}: must be a path or a list of paths`); continue; }
      for (const item of list) checkPath(item, `${where}.${field}`, 'directory');
    }
    if (typeof manifest.mcpServers !== 'string') fail(`${where}.mcpServers: must reference the plugin's mcp.json file, not inline configuration`);
    else if (checkPath(manifest.mcpServers, `${where}.mcpServers`, 'file') && toPosix(relative(root, resolve(root, manifest.mcpServers))) !== 'mcp.json') {
      fail(`${where}.mcpServers: must be "./mcp.json"`);
    }
  }
  const version = isObject(manifest) ? manifest.version : undefined;

  // marketplace.json
  const marketplace = readJson('.cursor-plugin/marketplace.json');
  if (marketplace && !isObject(marketplace)) fail('.cursor-plugin/marketplace.json: must be a JSON object');
  if (isObject(marketplace)) {
    const where = 'marketplace.json';
    checkKeys(marketplace, MARKETPLACE_KEYS, where);
    if (typeof marketplace.name !== 'string' || !MARKETPLACE_NAME.test(marketplace.name)) fail(`${where}.name: must match ${MARKETPLACE_NAME}`);
    checkPerson(marketplace.owner, `${where}.owner`);
    if (!isObject(marketplace.metadata)) fail(`${where}.metadata: required, with a description and the plugin's version`);
    else {
      if (marketplace.metadata.description !== undefined && typeof marketplace.metadata.description !== 'string') fail(`${where}.metadata.description: must be text`);
      if (marketplace.metadata.version !== version) fail(`${where}.metadata.version: "${marketplace.metadata.version}" must equal plugin.json's version "${version}"`);
    }
    if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) fail(`${where}.plugins: must list at least one plugin`);
    else {
      const names = new Set();
      let listsThisPlugin = false;
      marketplace.plugins.forEach((entry, index) => {
        const at = `${where}.plugins[${index}]`;
        if (!isObject(entry)) { fail(`${at}: must be an object`); return; }
        checkKeys(entry, MARKETPLACE_ENTRY_KEYS, at);
        if (typeof entry.name !== 'string' || !PLUGIN_NAME.test(entry.name)) fail(`${at}.name: must match ${PLUGIN_NAME}`);
        else if (names.has(entry.name)) fail(`${at}.name: "${entry.name}" is listed twice`);
        names.add(entry.name);
        if (entry.description !== undefined && typeof entry.description !== 'string') fail(`${at}.description: must be text`);
        if (entry.minClientVersions !== undefined) checkClients(entry.minClientVersions, `${at}.minClientVersions`);
        if (!isSafeRelativePath(entry.source)) { fail(`${at}.source: must be a relative path inside this repository`); return; }
        const source = toPosix(relative(root, resolve(root, entry.source)));
        const manifestPath = source ? `${source}/.cursor-plugin/plugin.json` : '.cursor-plugin/plugin.json';
        if (!has(manifestPath)) { fail(`${at}.source: "${entry.source}" has no .cursor-plugin/plugin.json`); return; }
        if (source === '') {
          listsThisPlugin = true;
          if (isObject(manifest) && entry.name !== manifest.name) fail(`${at}.name: "${entry.name}" must equal plugin.json's name "${manifest.name}"`);
        }
      });
      if (!listsThisPlugin) fail(`${where}.plugins: no entry has source "./" (this repository is the plugin)`);
    }
  }

  // CHANGELOG.md
  if (texts.has('CHANGELOG.md') && version !== undefined) {
    const heading = /^##[ \t]+(.+)$/m.exec(texts.get('CHANGELOG.md'));
    const newest = heading && /^\[?v?([^\s\]]+)/.exec(heading[1].trim())?.[1];
    if (!heading) fail('CHANGELOG.md: has no "## <version>" heading');
    else if (newest !== version) fail(`CHANGELOG.md: newest heading "## ${heading[1].trim()}" must start with plugin.json's version ${version}`);
  }

  // mcp.json
  const mcp = readJson('mcp.json');
  if (mcp !== null) {
    const raw = texts.get('mcp.json');
    if (raw.includes('${')) fail('mcp.json: ${...} placeholders are not allowed (the plugin declares no variables)');
    if (!isObject(mcp) || Object.keys(mcp).join() !== 'mcpServers' || !isObject(mcp.mcpServers) || Object.keys(mcp.mcpServers).length === 0) {
      fail('mcp.json: must be exactly {"mcpServers": {...}} with at least one server');
    } else {
      for (const [name, server] of Object.entries(mcp.mcpServers)) {
        const at = `mcp.json server "${name}"`;
        if (!isObject(server)) { fail(`${at}: must be an object`); continue; }
        for (const key of Object.keys(server)) {
          if (MCP_SERVER_KEYS.includes(key)) continue;
          if (['headers', 'auth', 'env', 'command', 'args'].includes(key)) fail(`${at}: "${key}" is not allowed; the server is remote and the user signs in with OAuth in the browser`);
          else fail(`${at}: unknown key "${key}" (allowed: ${MCP_SERVER_KEYS.join(', ')})`);
        }
        if (server.type !== 'http') fail(`${at}: type must be "http"`);
        const url = typeof server.url === 'string' ? checkHttps(server.url, `${at} url`) : (fail(`${at}: url is required`), null);
        if (url && !MCP_HOSTS.has(url.hostname)) fail(`${at}: host "${url.hostname}" is not allowed (allowed: ${[...MCP_HOSTS].join(', ')})`);
        if (url && (url.search || url.hash || url.port)) fail(`${at}: url must have no port, query or fragment`);
      }
    }
  }

  // Components.
  const components = { skills: [], rules: [], agents: [], commands: [] };
  const frontmatterOf = path => {
    const parsed = parseFrontmatter(texts.get(path));
    if (parsed.error) { fail(`${path}: ${parsed.error}`); return null; }
    return parsed.fields;
  };
  const text = value => (typeof value === 'string' ? value.trim() : '');
  const componentFiles = folder => files.map(file => file.path).filter(path => path.startsWith(`${folder}/`));
  for (const path of componentFiles('skills')) {
    const parts = path.split('/');
    if (parts.length < 3) { fail(`${path}: skills live in skills/<name>/SKILL.md`); continue; }
    if (parts.length !== 3 || parts[2] !== 'SKILL.md') continue; // supporting files inside a skill folder
    const folder = parts[1], fields = frontmatterOf(path);
    if (!fields) continue;
    if (!COMPONENT_NAME.test(folder)) fail(`${path}: folder name "${folder}" must match ${COMPONENT_NAME}`);
    if (text(fields.name) !== folder) fail(`${path}: frontmatter name "${text(fields.name)}" must equal its folder name "${folder}"`);
    if (!text(fields.description)) fail(`${path}: frontmatter description is required`);
    else if (text(fields.description).length > MAX_SKILL_DESCRIPTION) fail(`${path}: description is ${text(fields.description).length} characters; the limit is ${MAX_SKILL_DESCRIPTION}`);
    components.skills.push(folder);
  }
  for (const folder of new Set(componentFiles('skills').map(path => path.split('/')[1]))) {
    if (componentFiles('skills').every(path => path !== `skills/${folder}/SKILL.md`) && componentFiles('skills').some(path => path.split('/').length >= 3 && path.split('/')[1] === folder)) {
      fail(`skills/${folder}/: missing SKILL.md`);
    }
  }
  const flatComponents = [
    { folder: 'rules', extension: '.mdc', required: ['description'] },
    { folder: 'agents', extension: '.md', required: ['name', 'description'] },
    { folder: 'commands', extension: '.md', required: ['name', 'description'] },
  ];
  for (const { folder, extension, required } of flatComponents) {
    for (const path of componentFiles(folder)) {
      const fileName = path.slice(folder.length + 1);
      if (fileName.includes('/') || extname(fileName) !== extension) { fail(`${path}: ${folder} must be ${folder}/<name>${extension} files`); continue; }
      const fields = frontmatterOf(path);
      if (!fields) continue;
      for (const key of required) if (!text(fields[key])) fail(`${path}: frontmatter ${key} is required`);
      const stem = fileName.slice(0, -extension.length);
      if (!COMPONENT_NAME.test(stem)) fail(`${path}: file name "${stem}" must match ${COMPONENT_NAME}`);
      if (required.includes('name') && text(fields.name) && text(fields.name) !== stem) fail(`${path}: frontmatter name "${text(fields.name)}" must equal its file name "${stem}"`);
      // A rule must say whether it always loads, and this plugin's rules never do; its agents only read.
      if (folder === 'rules' && fields.alwaysApply !== 'false') fail(`${path}: frontmatter alwaysApply must be false, so the rule never loads into unrelated projects`);
      if (folder === 'agents' && fields.readonly !== 'true') fail(`${path}: frontmatter readonly must be true`);
      const name = required.includes('name') ? text(fields.name) : stem;
      if (name && components[folder].includes(name)) fail(`${path}: ${folder} name "${name}" is used twice`);
      components[folder].push(name);
    }
  }

  // Secret scan and naming rules over every text file.
  for (const [path, content] of texts) {
    for (const { label, pattern, strict, hashContext } of SECRET_PATTERNS) {
      for (const hit of content.matchAll(pattern)) {
        const token = hit[1] ?? hit[0];
        const line = content.split('\n')[lineOf(content, hit.index) - 1];
        if (!strict && (PLACEHOLDER.test(token) || new Set(token.replace(/^(?:rb_(?:live|test)_|whsec_|0x)/, '')).size < 10)) continue;
        if (hashContext && HASH_CONTEXT.test(line)) continue;
        fail(`${path}:${lineOf(content, hit.index)}: looks like ${label}; use an obvious placeholder instead`);
      }
    }
    content.split('\n').forEach((line, index) => {
      const words = line.replace(/[`"'*_>]/g, ' ').replace(/^\s*(?:[-+]|\d+[.)])\s+/, '').trim().split(/\s+/);
      if (PHRASE_LENGTHS.has(words.length) && words.every(word => /^[a-z]{3,8}$/.test(word)) && new Set(words).size >= words.length - 1) {
        fail(`${path}:${index + 1}: looks like a wallet recovery phrase; never publish one, even as an example`);
      }
    });
    for (const { pattern, why } of PROSE_RULES) {
      for (const hit of content.matchAll(pattern)) fail(`${path}:${lineOf(content, hit.index)}: "${hit[0]}": ${why}`);
    }
  }

  return { errors, files, manifest, marketplace, components };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { errors, files, manifest, components } = validatePlugin(root);
  if (errors.length) {
    for (const error of errors) console.error(`FAIL ${error}`);
    console.error(`\nValidation failed with ${errors.length} error${errors.length === 1 ? '' : 's'}.`);
    process.exitCode = 1;
  } else {
    const counts = Object.entries(components).map(([kind, names]) => `${names.length} ${kind}`).join(', ');
    console.log(`PASS ${manifest.name} ${manifest.version}: ${files.length} files, ${counts}.`);
  }
}
