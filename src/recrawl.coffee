globRegex = require 'glob-regex'
path = require 'path'
fs = require 'fs'

{lstatSync, readdirSync, readlinkSync} = fs
{S_IFMT, S_IFLNK, S_IFDIR} = fs.constants

alwaysTrue = -> true
alwaysFalse = -> false

limitDepth = (limit) ->
  (path, depth) -> depth < limit

recrawl = (opts = {}) ->
  {only, skip, enter, filter, follow} = opts

  only = Matcher only, alwaysTrue
  skip = Matcher skip, alwaysFalse

  enter or= alwaysTrue
  filter or= alwaysTrue

  follow =
    (follow and (follow is true  and Follower alwaysTrue) or
    (typeof follow is 'number'   and Follower limitDepth follow) or
    (typeof follow is 'function' and Follower follow)) or
    (Follower alwaysFalse)

  maxDepth =
    if typeof opts.depth is 'number'
      Math.max 0, opts.depth
    else if opts.deep is false then 0 else 1/0

  return (root, arg) ->
    root = path.resolve(root) + path.sep

    if arg
      if typeof arg is 'function'
        each = arg
      else if typeof arg is 'object'
        files = arg

    if !each
      files or= {}
      each =
        if Array.isArray files
        then (file) -> files.push file
        else (file, link) ->
          files[file] = link or true
          return

    depth = 0
    crawl = (dir) ->
      for base in readdirSync root + dir
        name = dir + base
        continue if !only(name, base, dir) or skip(name, base, dir)
        mode = lstatSync(root + name).mode & S_IFMT

        if mode is S_IFDIR
          if enter name, depth
            depth += 1
            crawl name + '/'
            depth -= 1
          continue

        if filter name
          each name,
            if mode is S_IFLNK
            then follow name, root
            else null

      return files
    return crawl ''

module.exports = recrawl

#
# Helpers
#

matchAny = (patterns) ->
  new RegExp '^(' + patterns.join('|') + ')$'

Matcher = (globs, matchEmpty) ->
  return matchEmpty if !globs or !globs.length

  rootRE = []  # match for root children
  nameRE = []  # match against root relatives
  baseRE = []  # match against basenames

  globs.forEach (glob) ->

    if glob.indexOf(path.sep) is -1
      baseRE.push globRegex.replace(glob)
      return

    if glob.slice(-1) is '/'
      glob += '**'

    if glob[0] is path.sep
      rootRE.push globRegex.replace(glob.slice 1)
      return

    if glob[0] isnt '*'
      glob = '**/' + glob

    nameRE.push globRegex.replace(glob)
    return

  rootRE = rootRE.length and matchAny(rootRE) or null
  nameRE = nameRE.length and matchAny(nameRE) or null
  baseRE = baseRE.length and matchAny(baseRE) or null

  return (name, base, dir) ->
    (dir is '' and rootRE and rootRE.test name) or
    (baseRE and baseRE.test base) or
    !(nameRE and !nameRE.test name)

Follower = (match) ->
  return (name, root) ->
    depth = 0
    if !match name, depth
      return null

    link = root + name
    while true
      target = readlinkSync link
      if path.isAbsolute target
        name = null
        link = target
      else

        if name isnt null
          name = relative name, target

        link =
          if name is null
          then path.resolve path.dirname(link), target
          else root + name

      try mode = lstatSync(link).mode & S_IFMT
      break if mode isnt S_IFLNK or !match name ? link, ++depth
    return name ? link
