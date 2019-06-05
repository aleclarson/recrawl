import relative from '@cush/relative'
import * as fs from 'fs'
import globRegex from 'glob-regex'
import * as path from 'path'
import { localFs } from './fs'
import { Crawler, EachArg, FilesArg, RecrawlOptions } from './types'

const { S_IFMT, S_IFLNK, S_IFDIR } = fs.constants

const limitDepth = (limit: number) => (_: any, depth: number) => depth < limit
const alwaysTrue = () => true
const alwaysFalse = () => false

/** Create a crawl function, and crawl the given root immediately */
export const crawl = (root: string, opts: RecrawlOptions = {}) =>
  recrawl(opts)(root)

/** Create a crawl function */
export function recrawl<T extends RecrawlOptions>(
  opts: T = {} as any
): Crawler<T> {
  const only = createMatcher(opts.only) || alwaysTrue
  const skip = createMatcher(opts.skip) || alwaysFalse

  const fs = opts.adapter || localFs
  const enter = opts.enter || alwaysTrue
  const filter = opts.filter || alwaysTrue
  const follow = createFollower(opts)

  const maxDepth =
    typeof opts.depth == 'number'
      ? Math.max(0, opts.depth)
      : opts.deep === false
      ? 0
      : Infinity

  return async (root: string, arg?: any) => {
    root = path.resolve(root) + path.sep

    let each: EachArg | undefined
    let files: FilesArg | undefined
    if (typeof arg == 'function') {
      each = arg
    } else {
      files = arg || (follow ? {} : [])
      each = Array.isArray(files)
        ? file => (files as any).push(file)
        : (file, link) => {
            files![file] = link !== null ? link : true
          }
    }

    let depth = 0
    const crawl = async (dir: string) => {
      for (const name of await fs.readdir(root + dir)) {
        const file = dir + name
        if (skip(file, name)) continue

        let mode = (await fs.stat(root + file)).mode & S_IFMT
        if (mode == S_IFDIR) {
          if (depth == maxDepth) continue
          if (enter(file, depth)) {
            depth++
            await crawl(file + path.sep)
            depth--
          }
        } else if (only(file, name) && filter(file, name)) {
          let link: string | null = null
          if (follow) {
            mode = (await fs.lstat(root + file)).mode & S_IFMT
            if (mode === S_IFLNK) link = await follow(file, root)
          }
          each!(file, link)
        }
      }
    }

    await crawl('')
    return files as any
  }
}

/** Tests true for absolute paths and globs starting with two asterisks. */
const globAllRE = new RegExp(`(?:\\${path.sep}|\\*\\*)`)

/** Merge regular expressions together. */
const matchAny = (patterns: string[]) =>
  new RegExp(`^(?:${patterns.join('|')})$`)

/** Provide the `name` argument to avoid unnecessary `path.basename` calls */
export type GlobMatcher = (file: string, name?: string) => boolean

/**
 * Create a function that tests against an array of Recrawl glob strings by
 * compiling them into RegExp objects.
 */
export function createMatcher(
  globs: string[] | undefined,
  mapGlob = (glob: string) => glob
): GlobMatcher | null {
  if (!globs || !globs.length) {
    return null
  }
  const fileGlobs: string[] = []
  const nameGlobs: string[] = []
  globs.forEach(glob => {
    if (globAllRE.test(glob)) {
      if (glob[0] == path.sep) {
        glob = glob.slice(1)
      } else if (glob[0] !== '*') {
        glob = '**/' + glob
      }
      if (glob.endsWith('/')) {
        glob += '**'
      }
      fileGlobs.push(globRegex.replace(mapGlob(glob)))
    } else {
      nameGlobs.push(globRegex.replace(mapGlob(glob)))
    }
  })
  const fileRE = fileGlobs.length ? matchAny(fileGlobs) : false
  const nameRE = nameGlobs.length ? matchAny(nameGlobs) : false
  return (file, name) =>
    (nameRE && nameRE.test(name || path.basename(file))) ||
    (fileRE && fileRE.test(file))
}

// Create a function that follows symlinks.
function createFollower(opts: RecrawlOptions) {
  const fs = opts.adapter || localFs
  const filter =
    opts.follow === true
      ? alwaysTrue
      : typeof opts.follow == 'number'
      ? limitDepth(opts.follow)
      : typeof opts.follow == 'function'
      ? opts.follow
      : null

  // The "name" argument must be relative to the "root" argument.
  if (!filter) return null
  return async (name: string | null, root: string) => {
    let depth = 0
    if (name === null || !filter(name, depth)) {
      return null
    }
    let link = root + name
    let mode: number
    do {
      const target = await fs.readlink(link)
      if (path.isAbsolute(target)) {
        name = null
        link = target
      }
      // When "target" is relative, resolve it.
      else if (name !== null) {
        // This code path is faster.
        name = relative(name, target)
        link = root + name
      } else {
        link = path.resolve(path.dirname(link), target)
      }
      try {
        mode = (await fs.lstat(link)).mode & S_IFMT
        if (mode !== S_IFLNK) break
      } catch {
        break
      }
    } while (filter(name == null ? link : name, ++depth))
    return name == null ? link : name
  }
}