/**
 * PlagiatIA - PM2 Ecosystem Configuration
 * Université de Kinshasa (UNIKIN)
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 stop plagiatia
 *   pm2 restart plagiatia
 *   pm2 logs plagiatia
 *   pm2 monit
 */

module.exports = {
  /**
   * Application principale - Next.js Standalone
   */
  apps: [
    {
      name: 'plagiatia',
      
      // Chemin vers le serveur standalone généré par Next.js
      script: '.next/standalone/server.js',
      
      // Répertoire de travail
      cwd: '/var/www/plagiatia',
      
      // Environnement
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '127.0.0.1',
      },
      
      // Mode cluster (optionnel - décommenter pour multi-core)
      // instances: 'max',
      // exec_mode: 'cluster',
      
      // Gestion de la mémoire et redémarrage automatique
      max_memory_restart: '512M',
      autorestart: true,
      watch: false,
      
      // Configuration des logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/www/plagiatia/logs/pm2-error.log',
      out_file: '/var/www/plagiatia/logs/pm2-out.log',
      merge_logs: true,
      log_type: 'json',
      
      // Health check et redémarrage intelligent
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Source map support pour les erreurs en production
      source_map_support: true,
      
      // Configuration avancée
      node_args: '--max-old-space-size=512 --enable-source-maps',
      
      // Ignore les changements de fichiers (géré par git)
      ignore_watch: [
        'node_modules',
        '.next/cache',
        'logs',
        '*.log',
        '.git'
      ],
    }
  ],

  /**
   * Déploiement PM2 distant (optionnel)
   * Permet de déployer avec: pm2 deploy production update
   */
  deploy: {
    production: {
      user: 'www-data',
      host: ['your-server-ip'],
      ref: 'origin/main',
      repo: 'https://github.com/votre-username/plagiatia.git',
      path: '/var/www/plagiatia',
      'pre-deploy': 'git fetch --all && git checkout main && git pull origin main',
      'post-deploy': 'npm ci --production=false && npm run build && pm2 reload ecosystem.config.js --env production && pm2 save',
      env: {
        NODE_ENV: 'production'
      }
    }
  },

  /**
   * Module options
   */
  modules: {}
};
