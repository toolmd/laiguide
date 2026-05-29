import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    base: './', // relative paths so the build works in any subdirectory (e.g. PR previews)
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                admin: resolve(__dirname, 'admin.html'),
                changelog: resolve(__dirname, 'changelog.html'),
            },
        },
    },
    test: {
        environment: 'node',
        css: false,
        exclude: ['**/node_modules/**', 'e2e/**', 'dist/**', 'assets/**', 'test-results/**'],
    },
});
