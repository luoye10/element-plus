import path from 'path'
import { readFile } from 'fs/promises'
import algoliasearch from 'algoliasearch'
import { slugify } from 'transliteration'
import { sync as globSync } from 'fast-glob'
import { projRoot } from './paths'
import { errorAndExit } from './utils'

interface Index {
  component: string
  title: string
  anchor: string
  content: string
  sort: number
  path: string
}

const algoliaKey = process.env.ALGOLIA_KEY
if (!algoliaKey) errorAndExit(new Error('no algoliaKey'))

const client = algoliasearch('7DCTSU0WBW', algoliaKey)
const langs = {
  'zh-CN': 'element-zh',
  'en-US': 'element-en',
  es: 'element-es',
  'fr-FR': 'element-fr',
  jp: 'element-jp',
}

Object.entries(langs).forEach(async ([lang, indexName]) => {
  const index = client.initIndex(indexName)
  await index.clearObjects()

  const docsRoot = path.resolve(projRoot, 'website/docs', lang)
  const files = globSync('*.md', {
    cwd: docsRoot,
    absolute: true,
  })

  const generateIndex = async (file: string) => {
    const content = await readFile(file, 'utf8')
    const matches = content
      .replace(/:::[\s\S]*?:::/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .match(/#{2,4}[^#]*/g)!
      .map((match) =>
        match
          .replace(/\n+/g, '\n')
          .split('\n')
          .filter((part) => !!part)
      )
      .map((match) => {
        const length = match.length
        if (length > 2) {
          const desc = match.slice(1, length).join('')
          return [match[0], desc]
        }
        return match
      })

    const name = path.parse(file).name // markdown name (without extension)
    const filename = path.basename(file) // markdown filename (with extension)

    let i = 0
    return matches.map((match) => {
      const title = match[0].replace(/#{2,4}/, '').trim()
      const index: Index = {
        component: name,
        title,
        anchor: slugify(title),
        content: (match[1] || title).replace(/<[^>]+>/g, ''),
        path: filename,
        sort: i++,
      }
      return index
    })
  }
  const indices: Index[] = (
    await Promise.all(files.map(async (file) => generateIndex(file)))
  ).flat(1)

  await index.saveObjects(indices, {
    autoGenerateObjectIDIfNotExist: true,
  })
})
