import * as fs from 'fs'
import * as path from 'path'
import { crawl } from '..'

const root = path.join(__dirname, '__fixtures__', 'root')

it('collects all descendants when no arguments are passed', () => {
  expect(crawl(root)).toMatchSnapshot()
})

it('treats directory symlinks like real directories', () => {
  const z = path.join(root, 'z')
  expect(fs.readlinkSync(z)).toBe('a')

  const entered = []
  crawl(root, { enter: dir => (entered.push(dir), true) })
  expect(entered).toContain('z')
})

const isWindows =
  process &&
  (process.platform === 'win32' || /^(msys|cygwin)$/.test(process.env.OSTYPE))

isWindows &&
  it('always returns unix paths', () => {
    crawl(root).forEach(file => {
      expect(file.indexOf('\\')).toBe(-1)
    })
  })

describe('options.only', () => {
  it('has no effect when empty', () => {
    expect(crawl(root, { only: [] })).toEqual(crawl(root))
  })
  it('is applied to files', () => {
    const paths = crawl(root, { only: ['*.js'] })
    expect(paths).toMatchSnapshot()
    expect(paths).not.toContain('node_modules/foo/package.json')
  })
  it('is applied to symlinks', () => {
    expect(fs.readlinkSync(path.join(root, 'index.js'))).toBe('a/b/c/3.js')
    const paths = crawl(root, { only: ['index.js'] })
    expect(paths).toEqual(['index.js'])
  })
  it('is not applied to directories', () => {
    const paths = crawl(root, { only: ['a', 'z'] })
    expect(paths).toEqual([])
  })
})

describe('options.skip', () => {
  it('has no effect when empty', () => {
    expect(crawl(root, { skip: [] })).toEqual(crawl(root))
  })
  it('is applied to files', () => {
    const paths = crawl(root, { skip: ['*.js'] })
    expect(paths).toMatchSnapshot()
    expect(paths).not.toContain('a/1.js')
  })
  it('is applied to symlinks', () => {
    const paths = crawl(root, { skip: ['*.js'] })
    expect(paths).not.toContain('index.js')
  })
  it('is applied to directories', () => {
    const paths = crawl(root, { skip: ['node_modules'] })
    expect(paths).not.toContain('node_modules/foo/package.json')
  })
  it('overrides the "only" option', () => {
    const paths = crawl(root, { only: ['a'], skip: ['a'] })
    expect(paths).toEqual([])
  })
})

describe('options.deep', () => {
  it('skips directories when false', () => {
    const paths = crawl(root, { deep: false })
    expect(paths).toMatchSnapshot()
  })
})

describe('options.depth', () => {
  it('limits the traversal depth', () => {
    const paths = crawl(root, { depth: 1 })
    expect(paths).toMatchSnapshot()
  })
  it('skips directories when zero', () => {
    const paths = crawl(root, { depth: 0 })
    expect(paths).toMatchSnapshot()
  })
})

describe('options.enter', () => {
  it('is called before entering a directory', () => {
    const enter = jest.fn(() => true)
    crawl(root, { enter })
    expect(enter.mock.calls).toMatchSnapshot()
  })
  it('can return false to skip a directory', () => {
    const enter = jest.fn(() => false)
    const paths = crawl(root, { enter })
    expect(enter.mock.calls).toMatchSnapshot()
    expect(paths).toMatchSnapshot()
  })
})

describe('options.filter', () => {
  it('is called whenever a file or symlink is found', () => {
    const filter = jest.fn(() => true)
    crawl(root, { filter })
    expect(filter.mock.calls).toMatchSnapshot()
  })
  it('is called after the "only" option is applied', () => {
    const filter = jest.fn(() => true)
    crawl(root, { filter, only: ['*.js'] })
    expect(filter.mock.calls).toMatchSnapshot()
  })
  it('is called after the "skip" option is applied', () => {
    const filter = jest.fn(() => true)
    crawl(root, { filter, skip: ['*.js'] })
    expect(filter.mock.calls).toMatchSnapshot()
  })
})

describe('options.follow', () => {
  it('resolves every symlink when true', () => {
    const paths = crawl(root, { follow: true })
    expect(paths['index.js']).toBe('a/b/c/3.js')
  })
  it('is called whenever a symlink is found', () => {
    const follow = jest.fn(() => true)
    crawl(root, { follow })
    expect(follow.mock.calls).toMatchSnapshot()
  })
  it('can return false to use the symlink path instead of resolving it', () => {
    const paths = crawl(root, { follow: () => false })
    expect(paths['index.js']).toBe(true)
  })
  it('avoids resolving symlinks when zero', () => {
    const paths = crawl(root, { follow: 0 })
    expect(paths['index.js']).toBe(true)
  })
  it.todo('limits the link depth when > zero')
  it.todo('can resolve symlinks to symlinks')
  it.todo('detects symlink infinite recursion')
})

describe('options.adapter', () => {
  it.todo('lets you provide your own filesystem')
})
