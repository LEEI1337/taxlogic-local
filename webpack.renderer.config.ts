import type { Configuration } from 'webpack';
import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';
import path from 'path';

rules.push({
  test: /\.css$/,
  use: [
    { loader: 'style-loader' },
    { loader: 'css-loader' },
    { loader: 'postcss-loader' }
  ]
});

export const rendererConfig: Configuration = {
  module: {
    rules: rules.filter((rule) => {
      // Exclude node-loader and asset-relocator-loader from renderer
      // These are only needed for main process native modules
      if (rule && typeof rule === 'object' && 'use' in rule) {
        const use = rule.use;
        if (use === 'node-loader') return false;
        if (typeof use === 'object' && use !== null && 'loader' in use &&
            (use as { loader: string }).loader === '@vercel/webpack-asset-relocator-loader') return false;
      }
      return true;
    })
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@components': path.resolve(__dirname, 'src/renderer/components'),
      '@pages': path.resolve(__dirname, 'src/renderer/pages'),
      '@stores': path.resolve(__dirname, 'src/renderer/stores'),
      '@styles': path.resolve(__dirname, 'src/renderer/styles')
    }
  }
};
