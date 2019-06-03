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
