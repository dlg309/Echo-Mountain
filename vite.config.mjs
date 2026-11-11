import {defineConfig} from 'vite';

// The existing dist/ directory is source, not Vite's disposable build output.
export default defineConfig({
  base:'/Echo-Mountain/',
  // Use the original Python server's port; open http://localhost:8000 to
  // retain the browser origin that contains existing local records.
  server:{host:'localhost',port:8000,strictPort:true},
  preview:{host:'localhost',port:8000,strictPort:true},
  build:{outDir:'build',emptyOutDir:true},
});
