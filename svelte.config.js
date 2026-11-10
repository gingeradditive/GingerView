import adapter from '@sveltejs/adapter-static';

// La build della demo va in una cartella separata: `build/` è tracciata e la scaricano le stampanti.
const outDir = process.env.BUILD_DIR || 'build';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			pages: outDir,
			assets: outDir,
			fallback: 'index.html',
			precompress: false,
			strict: true
		})
	}
};

export default config;
