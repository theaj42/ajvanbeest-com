import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "AJ Van Beest",
    pageTitleSuffix: " | Digital Garden",
    enableSPA: true,
    enablePopovers: true,
    analytics: {
      provider: "plausible",
    },
    locale: "en-US",
    baseUrl: "ajvanbeest.com",
    ignorePatterns: ["private", "templates", ".obsidian", "drafts"],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Inter",
        body: "Source Serif Pro",
        code: "JetBrains Mono",
      },
      colors: {
        // Gruvbox Material Light (for accessibility/preference)
        lightMode: {
          light: "#fbf1c7",           // bg0 (light)
          lightgray: "#ebdbb2",       // bg1
          gray: "#928374",            // gray
          darkgray: "#504945",        // fg (dark text)
          dark: "#282828",            // fg0 (headings)
          secondary: "#af3a03",       // orange (burnt)
          tertiary: "#427b58",        // aqua (muted)
          highlight: "rgba(215, 153, 33, 0.15)",  // yellow highlight
          textHighlight: "#d7992188", // yellow
        },
        // Gruvbox Material Dark
        darkMode: {
          light: "#1d2021",           // bg0 (hard contrast)
          lightgray: "#282828",       // bg1 (cards, borders)
          gray: "#504945",            // bg3 (muted elements)
          darkgray: "#d4be98",        // fg (main text - warm cream)
          dark: "#ddc7a1",            // fg0 (headings - brighter cream)
          secondary: "#e78a4e",       // orange (primary accent - links)
          tertiary: "#89b482",        // aqua (secondary accent - hover)
          highlight: "rgba(231, 138, 78, 0.15)",  // orange highlight
          textHighlight: "#d8a65788", // yellow
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "vitesse-light",
          dark: "vitesse-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false, parseTags: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // Comment out CustomOgImages to speed up build time
      Plugin.CustomOgImages(),
    ],
  },
}

export default config
