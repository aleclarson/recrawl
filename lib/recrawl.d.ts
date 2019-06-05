import { Crawler, RecrawlOptions } from './types';
/** Create a crawl function, and crawl the given root immediately */
export declare const crawl: (root: string, opts?: {
    only?: string[] | undefined;
    skip?: string[] | undefined;
    deep?: boolean | undefined;
    depth?: number | undefined;
    enter?: import("./types").DirFilter | undefined;
    filter?: import("./types").FileFilter | undefined;
    follow?: number | boolean | import("./types").LinkFilter | undefined;
    adapter?: import("./fs").FileAdapter | undefined;
}) => Promise<string[]>;
/** Create a crawl function */
export declare function recrawl<T extends RecrawlOptions>(opts?: T): Crawler<T>;
/** Provide the `name` argument to avoid unnecessary `path.basename` calls */
export declare type GlobMatcher = (file: string, name?: string) => boolean;
/**
 * Create a function that tests against an array of Recrawl glob strings by
 * compiling them into RegExp objects.
 */
export declare function createMatcher(globs: string[] | undefined, mapGlob?: (glob: string) => string): ((file: string, name?: string | undefined) => boolean | null) | null;
