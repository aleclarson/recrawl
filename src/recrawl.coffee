globRegex = require 'glob-regex'
path = require 'path'
fs = require 'fs'

{lstatSync, readdirSync, readlinkSync, statSync} = fs
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
  follow and=
    (follow is true and Follower alwaysTrue) or
    (typeof follow is 'number' and Follower limitDepth follow) or
    (typeof follow is 'function' and Follower follow)

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
        continue if !only(name, base) or skip(name, base)

        mode = statSync(root + name).mode & S_IFMT
        if mode is S_IFDIR
          continue if depth is maxDepth
          if enter name, depth
            depth += 1
            crawl name + '/'
            depth -= 1
          continue

        if filter name
          mode = follow and lstatSync(root + name).mode & S_IFMT
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

  if typeof globs is 'string'
    globs = [globs]

  else if !globs or !globs.length
    return matchEmpty

  nameRE = []  # match against root relatives
  baseRE = []  # match against basenames

  globs.forEach (glob) ->

    if !based = glob.indexOf(path.sep) is -1

      if glob[0] is path.sep
        glob = glob.slice 1

      else if glob[0] isnt '*'
        glob = '**/' + glob

      if glob.slice(-1) is '/'
        glob += '**'

    (based and baseRE or nameRE).push globRegex.replace(glob)

  nameRE = nameRE.length and matchAny(nameRE) or null
  baseRE = baseRE.length and matchAny(baseRE) or null

  return (name, base) ->
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
