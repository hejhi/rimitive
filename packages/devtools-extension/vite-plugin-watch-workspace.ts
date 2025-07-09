import { PluginOption } from 'vite';
import { resolve } from 'path';

export function watchWorkspace(): PluginOption {
  return {
    name: 'watch-workspace',
    configureServer(server) {
      // Watch workspace dependencies
      const workspacePaths = [
        resolve(__dirname, '../core/src'),
        resolve(__dirname, '../signals/src'),
        resolve(__dirname, '../devtools/src'),
      ];

      // Add paths to watcher
      workspacePaths.forEach((path) => {
        server.watcher.add(path);
      });

      // Force full reload when workspace files change
      server.watcher.on('change', (file) => {
        if (workspacePaths.some((path) => file.startsWith(path))) {
          console.log(`[watch-workspace] Workspace file changed: ${file}`);
          server.ws.send({
            type: 'full-reload',
            path: '*',
          });
        }
      });
    },
  };
}
