import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
import { FileTrieNode } from "./quartz/util/fileTrie"

// Custom sort function: reverse chronological for posts, alphabetical for everything else
const explorerSortFn = (a: FileTrieNode, b: FileTrieNode) => {
  // Folders first, then files
  if (a.isFolder && !b.isFolder) return -1
  if (!a.isFolder && b.isFolder) return 1

  // Check if we're in the posts folder by looking at the slug
  const aSlug = a.slug
  const bSlug = b.slug
  const inPostsFolder = aSlug.startsWith("posts/") && bSlug.startsWith("posts/")

  if (inPostsFolder && !a.isFolder && !b.isFolder) {
    // Reverse alphabetical for posts (gives reverse chronological since filenames start with dates)
    return b.displayName.localeCompare(a.displayName, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  }

  // Default: alphabetical
  return a.displayName.localeCompare(b.displayName, undefined, {
    numeric: true,
    sensitivity: "base",
  })
}

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [
    Component.Comments({
      provider: "giscus",
      options: {
        repo: "theaj42/ajvanbeest-com",
        repoId: "R_kgDOPDfIhA",
        category: "General",
        categoryId: "DIC_kwDOPDfIhM4CsKiS",
        mapping: "pathname",
        strict: false,
        reactionsEnabled: true,
        inputPosition: "bottom",
      },
    }),
  ],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/theaj42/ajvanbeest-com",
      "About": "/about",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        { Component: Component.ReaderMode() },
      ],
    }),
    Component.Explorer({ sortFn: explorerSortFn }),
  ],
  right: [
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer({ sortFn: explorerSortFn }),
  ],
  right: [],
}
