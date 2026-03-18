import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@actalk/inkos-core', 'node-fetch', 'formdata-node', 'agentkeepalive', 'abort-controller', 'form-data-encoder', 'event-target-shim', 'humanize-ms', 'openai', 'zod', '@anthropic-ai/sdk', 'jszip', 'cheerio', 'htmlparser2', 'domutils', 'dom-serializer', 'domhandler', 'entities', 'parse5', 'parse5-htmlparser2-tree-adapter', 'css-select', 'css-what', 'boolbase', 'nth-check', 'cheerio-select'] })],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        }
      }
    },
    plugins: [react()]
  }
})
