import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const config: ForgeConfig = {
  packagerConfig: {
    name: 'TaxLogic',
    executableName: 'taxlogic',
    asar: true,
    icon: './assets/icon',
    appBundleId: 'com.taxlogic.local',
    appCategoryType: 'public.app-category.finance',
    win32metadata: {
      CompanyName: 'TaxLogic',
      FileDescription: 'AI-powered local tax filing assistant for Austria',
      OriginalFilename: 'taxlogic.exe',
      ProductName: 'TaxLogic.local',
      InternalName: 'taxlogic'
    },
    extraResource: [
      './data/knowledge'
    ],
    ignore: [
      /^\/\.git/,
      /^\/\.env/,
      /^\/tests/,
      /^\/docs/,
      /\.md$/,
      /\.log$/
    ]
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'TaxLogic',
      setupIcon: './assets/icon.ico',
      iconUrl: 'https://raw.githubusercontent.com/taxlogic/taxlogic-local/main/assets/icon.ico'
    }),
    new MakerZIP({}, ['darwin', 'linux']),
    new MakerDMG({
      name: 'TaxLogic',
      icon: './assets/icon.icns',
      format: 'ULFO'
    }),
    new MakerDeb({
      options: {
        name: 'taxlogic',
        productName: 'TaxLogic',
        genericName: 'Tax Filing Assistant',
        description: 'AI-powered local tax filing assistant for Austria',
        categories: ['Finance', 'Office'],
        icon: './assets/icon.png',
        maintainer: 'TaxLogic Team'
      }
    }),
    new MakerRpm({
      options: {
        name: 'taxlogic',
        productName: 'TaxLogic',
        description: 'AI-powered local tax filing assistant for Austria',
        categories: ['Finance', 'Office'],
        icon: './assets/icon.png'
      }
    })
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      devContentSecurityPolicy: "default-src 'self' 'unsafe-inline' data:; script-src 'self' 'unsafe-eval' 'unsafe-inline' data:; connect-src 'self' http://localhost:* ws://localhost:* http://*:11434",
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/renderer/index.html',
            js: './src/renderer/index.tsx',
            name: 'main_window',
            preload: {
              js: './src/main/preload.ts'
            }
          }
        ]
      }
    })
  ]
};

export default config;
