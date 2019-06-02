import { FileAdapter } from './fs';
export declare type DirFilter = (dir: string, depth: number) => boolean;
export declare type FileFilter = (file: string, name: string) => boolean;
export declare type LinkFilter = (link: string, depth: number) => boolean;
export declare type RecrawlOptions = Options;
declare type Options = {
    only?: string[];
    skip?: string[];
    deep?: boolean;
    depth?: number;
    enter?: DirFilter;
    filter?: FileFilter;
    follow?: boolean | number | LinkFilter;
    adapter?: FileAdapter;
};
/** Create a crawl function, and crawl the given root immediately */
export declare const crawl: (root: string, opts?: Options) => string[] | {
    [name: string]: string | boolean;
};
/** Create a crawl function */
export declare const recrawl: (opts?: Options) => (root: string, arg?: string[] | ((file: string, link: string | null) => void) | {
    [name: string]: string | boolean;
} | undefined) => string[] | {
    [name: string]: string | boolean;
};
export {};
