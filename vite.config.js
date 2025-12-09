import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import mdx from '@mdx-js/rollup';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        {
            enforce: 'pre',
            ...mdx(),
        },
        react({ include: /\.(jsx|js|mdx|md|tsx|ts)$/ }),
        tailwindcss(),
    ],
    assetsInclude: '**/*.lottie',
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:8788',
                secure: false,
                changeOrigin: true,
            },
        },
    },
});
