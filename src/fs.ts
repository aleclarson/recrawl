import * as fs from 'fs'

export interface FileAdapter {
  readdir(name: string): Promise<string[]>
  readlink(name: string): Promise<string>
  lstat(name: string): Promise<fs.Stats>
  stat(name: string): Promise<fs.Stats>
}

export const localFs: FileAdapter = {
  readdir: async name => fs.readdirSync(name),
  readlink: async name => fs.readlinkSync(name),
  lstat: async name => fs.lstatSync(name),
  stat: async name => fs.statSync(name),
}
