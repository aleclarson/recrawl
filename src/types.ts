import { FileAdapter } from './fs'

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

export type EachArg = (file: string, link: string | null) => void
export type FilesArg = FileMap | string[]
export type FileMap = { [name: string]: string | boolean }

export interface Crawler<T extends Options> {
  (root: string): Promise<
    T['follow'] extends true | LinkFilter ? FileMap : string[]
  >
  (root: string, each: EachArg): Promise<void>
  <T extends FilesArg>(root: string, files: T): Promise<T>
}