import type { Configuration } from 'webpack';
import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';
import path from 'path';

export const mainConfig: Configuration = {
  entry: './src/main/index.ts',
  module: {
    rules
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
    alias: {
      '@main': path.resolve(__dirname, 'src/main'),
      '@backend': path.resolve(__dirname, 'src/backend'),
      '@agents': path.resolve(__dirname, 'src/backend/agents'),
      '@workflows': path.resolve(__dirname, 'src/backend/workflows'),
      '@services': path.resolve(__dirname, 'src/backend/services'),
      '@rag': path.resolve(__dirname, 'src/backend/rag'),
      '@utils': path.resolve(__dirname, 'src/backend/utils'),
      '@config': path.resolve(__dirname, 'config')
    }
  },
  externals: {
    'better-sqlite3': 'commonjs better-sqlite3',
    'sharp': 'commonjs sharp',
    'sql.js': 'commonjs sql.js'
  }
};
