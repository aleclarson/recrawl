Object.defineProperty(exports, "__esModule", { value: true });
const relative_1 = require("@cush/relative");
const fs = require("fs");
const glob_regex_1 = require("glob-regex");
const path = require("path");
const fs_1 = require("./fs");
const { S_IFMT, S_IFLNK, S_IFDIR } = fs.constants;
const limitDepth = (limit) => (_, depth) => depth < limit;
const alwaysTrue = () => true;
const alwaysFalse = () => false;
/** Create a crawl function, and crawl the given root immediately */
exports.crawl = (root, opts = {}) => recrawl(opts)(root);
/** Create a crawl function */
function recrawl(opts = {}) {
    const only = createMatcher(opts.only) || alwaysTrue;
    const skip = createMatcher(opts.skip) || alwaysFalse;
    const fs = opts.adapter || fs_1.localFs;
    const enter = opts.enter || alwaysTrue;
    const filter = opts.filter || alwaysTrue;
    const follow = createFollower(opts);
    const maxDepth = typeof opts.depth == 'number'
        ? Math.max(0, opts.depth)
        : opts.deep === false
            ? 0
            : Infinity;
    return async (root, arg) => {
        root = path.resolve(root) + path.sep;
        let each;
        let files;
        if (typeof arg == 'function') {
            each = arg;
        }
        else {
            files = arg || (follow ? {} : []);
            each = Array.isArray(files)
                ? file => files.push(file)
                : (file, link) => {
                    files[file] = link !== null ? link : true;
                };
        }
        let depth = 0;
        const crawl = async (dir) => {
            for (const name of await fs.readdir(root + dir)) {
                const file = dir + name;
                if (skip(file, name))
                    continue;
                let mode = (await fs.stat(root + file)).mode & S_IFMT;
                if (mode == S_IFDIR) {
                    if (depth == maxDepth)
                        continue;
                    if (enter(file, depth)) {
                        depth++;
                        await crawl(file + path.sep);
                        depth--;
                    }
                }
                else if (only(file, name) && filter(file, name)) {
                    let link = null;
                    if (follow) {
                        mode = (await fs.lstat(root + file)).mode & S_IFMT;
                        if (mode === S_IFLNK)
                            link = await follow(file, root);
                    }
                    each(file, link);
                }
            }
        };
        await crawl('');
        return files;
    };
}
exports.recrawl = recrawl;
/** Tests true for absolute paths and globs starting with two asterisks. */
const globAllRE = new RegExp(`(?:\\${path.sep}|\\*\\*)`);
/** Merge regular expressions together. */
const matchAny = (patterns) => new RegExp(`^(?:${patterns.join('|')})$`);
/**
 * Compile a single Recrawl glob string into its "RegExp pattern" equivalent.
 *
 * Note: This is only useful for globs with "/" or "**" in them.
 */
function compileGlob(glob) {
    if (glob[0] == path.sep) {
        glob = glob.slice(1);
    }
    else if (glob[0] !== '*') {
        glob = '**/' + glob;
    }
    if (glob.endsWith('/')) {
        glob += '**';
    }
    return glob_regex_1.default.replace(glob);
}
exports.compileGlob = compileGlob;
/**
 * Create a function that tests against an array of Recrawl glob strings by
 * compiling them into RegExp objects.
 */
function createMatcher(globs, mapGlob) {
    if (!globs || !globs.length) {
        return null;
    }
    const fileGlobs = [];
    const nameGlobs = [];
    globs.forEach(glob => {
        if (globAllRE.test(glob)) {
            glob = compileGlob(glob);
        }
        if (mapGlob)
            glob = mapGlob(glob);
        if (globAllRE.test(glob))
            fileGlobs.push(glob);
        else
            nameGlobs.push(glob_regex_1.default.replace(glob));
    });
    const fileRE = fileGlobs.length ? matchAny(fileGlobs) : false;
    const nameRE = nameGlobs.length ? matchAny(nameGlobs) : false;
    return (file, name) => (nameRE && nameRE.test(name || path.basename(file))) ||
        (fileRE && fileRE.test(file));
}
exports.createMatcher = createMatcher;
// Create a function that follows symlinks.
function createFollower(opts) {
    const fs = opts.adapter || fs_1.localFs;
    const filter = opts.follow === true
        ? alwaysTrue
        : typeof opts.follow == 'number'
            ? limitDepth(opts.follow)
            : typeof opts.follow == 'function'
                ? opts.follow
                : null;
    // The "name" argument must be relative to the "root" argument.
    if (!filter)
        return null;
    return async (name, root) => {
        let depth = 0;
        if (name === null || !filter(name, depth)) {
            return null;
        }
        let link = root + name;
        let mode;
        do {
            const target = await fs.readlink(link);
            if (path.isAbsolute(target)) {
                name = null;
                link = target;
            }
            // When "target" is relative, resolve it.
            else if (name !== null) {
                // This code path is faster.
                name = relative_1.default(name, target);
                link = root + name;
            }
            else {
                link = path.resolve(path.dirname(link), target);
            }
            try {
                mode = (await fs.lstat(link)).mode & S_IFMT;
                if (mode !== S_IFLNK)
                    break;
            }
            catch (_a) {
                break;
            }
        } while (filter(name == null ? link : name, ++depth));
        return name == null ? link : name;
    };
}
