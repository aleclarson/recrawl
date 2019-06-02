import relative from '@cush/relative'
import * as fs from 'fs'
import globRegex from 'glob-regex'
import * as path from 'path'
import { FileAdapter, localFs } from './fs'

const { S_IFMT, S_IFLNK, S_IFDIR } = fs.constants

const limitDepth = (limit: number) => (_: any, depth: number) => depth < limit
const alwaysTrue = () => true
const alwaysFalse = () => false

export type DirFilter = (dir: string, depth: number) => boolean
export type FileFilter = (file: string, name: string) => boolean
export type LinkFilter = (link: string, depth: number) => boolean

export type RecrawlOptions = Options
type Options = {
  only?: string[]
  skip?: string[]
  deep?: boolean
  depth?: number
  enter?: DirFilter
  filter?: FileFilter
  follow?: boolean | number | LinkFilter
  adapter?: FileAdapter
}

/** Create a crawl function, and crawl the given root immediately */
export const crawl = (root: string, opts: Options = {}) => recrawl(opts)(root)

/** Create a crawl function */
export const recrawl = (opts: Options = {}) => {
  const only = new Matcher(opts.only, alwaysTrue)
  const skip = new Matcher(opts.skip, alwaysFalse)

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

  type EachArg = ((file: string, link: string | null) => void) | undefined
  type FilesArg = { [name: string]: string | boolean } | string[] | undefined

  return async (root: string, arg?: EachArg | FilesArg) => {
    root = path.resolve(root) + path.sep

    let each: EachArg
    let files: FilesArg
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
      for (const base of await fs.readdir(root + dir)) {
        const name = dir + base
        if (skip.match(name, base)) continue

        let mode = (await fs.stat(root + name)).mode & S_IFMT
        if (mode == S_IFDIR) {
          if (depth == maxDepth) continue
          if (enter(name, depth)) {
            depth++
            await crawl(name + path.sep)
            depth--
          }
        } else if (only.match(name, base) && filter(name, base)) {
          mode = follow && (await fs.lstat(root + name)).mode & S_IFMT
          each!(name, mode === S_IFLNK ? await follow(name, root) : null)
        }
      }
    }

    await crawl('')
    return files!
  }
}

/** Tests true for absolute paths and globs starting with two asterisks. */
const globAllRE = new RegExp(`(?:\\${path.sep}|\\*\\*)`)

/** Merge regular expressions together. */
const matchAny = (patterns: string[]) =>
  new RegExp(`^(?:${patterns.join('|')})$`)

class Matcher {
  name?: RegExp
  base?: RegExp

  constructor(public globs: string[] = [], emptyMatch: () => boolean) {
    if (!globs.length) {
      this.match = emptyMatch
      return
    }
    const namePatts = []
    const basePatts = []
    for (let glob of globs) {
      if (globAllRE.test(glob)) {
        if (glob[0] == path.sep) {
          glob = glob.slice(1)
        } else if (glob[0] !== '*') {
          glob = '**/' + glob
        }
        if (glob.slice(-1) == '/') {
          glob += '**'
        }
        namePatts.push(globRegex.replace(glob))
      } else {
        basePatts.push(globRegex.replace(glob))
      }
    }
    if (namePatts.length) this.name = matchAny(namePatts)
    if (basePatts.length) this.base = matchAny(basePatts)
  }

  match(name: string, base?: string) {
    return (
      (this.base && this.base.test(base || path.basename(name))) ||
      (this.name && this.name.test(name))
    )
  }
}

function createFollower(opts: Options) {
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
  if (!filter) return async (name: string | null) => name
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
