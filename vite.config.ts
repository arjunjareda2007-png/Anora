import path from 'path';
import fs from 'fs';
import http from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const execAsync = promisify(exec);

function clerkBridgePlugin(): Plugin {
  return {
    name: 'clerk-bridge-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        
        if (url === '/api/clerk-oauth-url' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          try {
            if (fs.existsSync('/tmp/login.txt')) {
              const content = fs.readFileSync('/tmp/login.txt', 'utf-8');
              const match = content.match(/https:\/\/clerk\.clerk\.com\/oauth\/authorize\?[^\s\x1b]+/);
              const portMatch = content.match(/redirect_uri=http%3A%2F%2F127\.0\.0\.1%3A(\d+)%2Fcallback/);
              return res.end(JSON.stringify({
                oauthUrl: match ? match[0] : null,
                callbackPort: portMatch ? portMatch[1] : null,
                raw: content
              }));
            }
          } catch (e: any) {
            return res.end(JSON.stringify({ error: e.message }));
          }
          return res.end(JSON.stringify({ oauthUrl: null }));
        }

        if (url === '/api/save-clerk-key' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const { key } = JSON.parse(body || '{}');
              if (key && key.trim()) {
                const cleanKey = key.trim();
                let envContent = '';
                if (fs.existsSync('.env.local')) {
                  envContent = fs.readFileSync('.env.local', 'utf-8');
                }
                if (envContent.includes('VITE_CLERK_PUBLISHABLE_KEY=')) {
                  envContent = envContent.replace(/VITE_CLERK_PUBLISHABLE_KEY=.*(\r?\n|$)/, `VITE_CLERK_PUBLISHABLE_KEY=${cleanKey}\n`);
                } else {
                  envContent += `\nVITE_CLERK_PUBLISHABLE_KEY=${cleanKey}\n`;
                }
                fs.writeFileSync('.env.local', envContent.trim() + '\n');
                
                // Also write to .env as fallback
                let baseEnv = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf-8') : '';
                if (baseEnv.includes('VITE_CLERK_PUBLISHABLE_KEY=')) {
                  baseEnv = baseEnv.replace(/VITE_CLERK_PUBLISHABLE_KEY=.*(\r?\n|$)/, `VITE_CLERK_PUBLISHABLE_KEY=${cleanKey}\n`);
                } else {
                  baseEnv += `\nVITE_CLERK_PUBLISHABLE_KEY=${cleanKey}\n`;
                }
                fs.writeFileSync('.env', baseEnv.trim() + '\n');

                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ success: true, key: cleanKey }));
              }
              res.statusCode = 400;
              return res.end(JSON.stringify({ error: 'Key required' }));
            } catch (err: any) {
              res.statusCode = 500;
              return res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        if (url === '/api/clerk-callback' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const { callbackUrl } = JSON.parse(body || '{}');
              if (!callbackUrl) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ error: 'callbackUrl required' }));
              }

              // Send request to the local clerk listener
              try {
                const targetUrl = new URL(callbackUrl);
                const localUrl = `http://127.0.0.1:${targetUrl.port}${targetUrl.pathname}${targetUrl.search}`;
                
                await new Promise((resolve, reject) => {
                  http.get(localUrl, (resp) => {
                    let d = '';
                    resp.on('data', c => { d += c; });
                    resp.on('end', () => resolve(d));
                  }).on('error', reject);
                });

                // Wait 2 seconds for CLI to finish and pull env
                await new Promise(r => setTimeout(r, 2000));
                await execAsync('clerk env pull --app app_3KhC3bNg53VjiMecfQOfp2LfXoB --file .env.local');
                
                // Check if key is pulled
                let pulledKey = '';
                if (fs.existsSync('.env.local')) {
                  const content = fs.readFileSync('.env.local', 'utf-8');
                  const m = content.match(/VITE_CLERK_PUBLISHABLE_KEY=([^\s]+)/) || content.match(/CLERK_PUBLISHABLE_KEY=([^\s]+)/);
                  if (m) pulledKey = m[1];
                }

                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ success: true, key: pulledKey }));
              } catch (reqErr: any) {
                res.statusCode = 500;
                return res.end(JSON.stringify({ error: reqErr.message }));
              }
            } catch (err: any) {
              res.statusCode = 500;
              return res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const clerkKey = env.VITE_CLERK_PUBLISHABLE_KEY || env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY || '';
  
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR === 'true' ? false : true,
    },
    plugins: [react(), tailwindcss(), clerkBridgePlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.VITE_CLERK_PUBLISHABLE_KEY': JSON.stringify(clerkKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', '@clerk/clerk-react', '@clerk/themes'],
    }
  };
});
