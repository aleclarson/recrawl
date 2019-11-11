import * as fs from 'fs'
import * as path from 'path'
import { crawl } from '..'

const root = path.join(__dirname, '__fixtures__', 'root')

it('collects all descendants when no arguments are passed', async () => {
  expect(await crawl(root)).toMatchSnapshot()
})

it('treats directory symlinks like real directories', async () => {
  const z = path.join(root, 'z')
  expect(fs.readlinkSync(z)).toBe('a')

  const entered = []
  await crawl(root, { enter: dir => (entered.push(dir), true) })
  expect(entered).toContain('z')
})

const isWindows =
  process &&
  (process.platform === 'win32' || /^(msys|cygwin)$/.test(process.env.OSTYPE))

isWindows &&
  it('always returns unix paths', async () => {
    ;(await crawl(root)).forEach(file => {
      expect(file.indexOf('\\')).toBe(-1)
    })
  })

describe('options.only', () => {
  it('has no effect when empty', async () => {
    expect(await crawl(root, { only: [] })).toEqual(await crawl(root))
  })
  it('is applied to files', async () => {
    const paths = await crawl(root, { only: ['*.js'] })
    expect(paths).toMatchSnapshot()
    expect(paths).not.toContain('node_modules/foo/package.json')
  })
  it('is applied to symlinks', async () => {
    expect(fs.readlinkSync(path.join(root, 'index.js'))).toBe('a/b/c/3.js')
    const paths = await crawl(root, { only: ['index.js'] })
    expect(paths).toEqual(['index.js'])
  })
  it('is not applied to directories', async () => {
    const paths = await crawl(root, { only: ['a', 'z'] })
    expect(paths).toEqual([])
  })
})

describe('options.skip', () => {
  it('has no effect when empty', async () => {
    expect(await crawl(root, { skip: [] })).toEqual(await crawl(root))
  })
  it('is applied to files', async () => {
    const paths = await crawl(root, { skip: ['*.js'] })
    expect(paths).toMatchSnapshot()
    expect(paths).not.toContain('a/1.js')
  })
  it('is applied to symlinks', async () => {
    const paths = await crawl(root, { skip: ['*.js'] })
    expect(paths).not.toContain('index.js')
  })
  it('is applied to directories', async () => {
    const paths = await crawl(root, { skip: ['node_modules'] })
    expect(paths).not.toContain('node_modules/foo/package.json')
  })
  it('overrides the "only" option', async () => {
    const paths = await crawl(root, { only: ['a'], skip: ['a'] })
    expect(paths).toEqual([])
  })
})

describe('options.deep', () => {
  it('skips directories when false', async () => {
    const paths = await crawl(root, { deep: false })
    expect(paths).toMatchSnapshot()
  })
})

describe('options.depth', () => {
  it('limits the traversal depth', async () => {
    const paths = await crawl(root, { depth: 1 })
    expect(paths).toMatchSnapshot()
  })
  it('skips directories when zero', async () => {
    const paths = await crawl(root, { depth: 0 })
    expect(paths).toMatchSnapshot()
  })
})

describe('options.enter', () => {
  it('is called before entering a directory', async () => {
    const enter = jest.fn(() => true)
    await crawl(root, { enter })
    expect(enter.mock.calls).toMatchSnapshot()
  })
  it('can return false to skip a directory', async () => {
    const enter = jest.fn(() => false)
    const paths = await crawl(root, { enter })
    expect(enter.mock.calls).toMatchSnapshot()
    expect(paths).toMatchSnapshot()
  })
})

describe('options.filter', () => {
  it('is called whenever a file or symlink is found', async () => {
    const filter = jest.fn(() => true)
    await crawl(root, { filter })
    expect(filter.mock.calls).toMatchSnapshot()
  })
  it('is called after the "only" option is applied', async () => {
    const filter = jest.fn(() => true)
    await crawl(root, { filter, only: ['*.js'] })
    expect(filter.mock.calls).toMatchSnapshot()
  })
  it('is called after the "skip" option is applied', async () => {
    const filter = jest.fn(() => true)
    await crawl(root, { filter, skip: ['*.js'] })
    expect(filter.mock.calls).toMatchSnapshot()
  })
})

describe('options.follow', () => {
  it('resolves every symlink when true', async () => {
    const paths = await crawl(root, { follow: true })
    expect(paths).toMatchSnapshot()
  })
  it('is called whenever a symlink is found', async () => {
    const follow = jest.fn(() => true)
    await crawl(root, { follow })
    expect(follow.mock.calls).toMatchSnapshot()
  })
  it('can return false to use the symlink path instead of resolving it', async () => {
    const paths = await crawl(root, { follow: () => false })
    expect(paths['index.js']).toBe(true)
  })
  it('avoids resolving symlinks when zero', async () => {
    const paths = await crawl(root, { follow: 0 })
    expect(paths['index.js']).toBe(true)
  })
  it.todo('limits the link depth when > zero')
  it.todo('can resolve symlinks to symlinks')
  it.todo('detects symlink infinite recursion')
})

describe('options.adapter', () => {
  it.todo('lets you provide your own filesystem')
})
