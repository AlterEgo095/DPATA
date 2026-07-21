/**
 * PlagiatIA - Configuration PM2 pour Production
 * 
 * Domaine: plagiatia.aenews.net
 * Runtime: Bun
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 stop ecosystem.config.js
 *   pm2 restart ecosystem.config.js
 *   pm2 delete ecosystem.config.js
 * 
 * Documentation PM2: https://pm2.keymetrics.io/docs/usage/quick-start/
 */

module.exports = {
  /**
   * ========================================================================
   * APPLICATION PRINCIPALE - Next.js Standalone (Bun)
   * ========================================================================
   */
  apps: [
    {
      // Nom de l'application (pour pm2 list, logs, etc.)
      name: 'plagiatia',
      
      // Script d'entrée (généré par next build avec output: standalone)
      script: '.next/standalone/server.js',
      
      // Répertoire de l'application
      cwd: '/var/www/plagiatia',
      
      // Runtime à utiliser (Bun au lieu de Node.js)
      interpreter: 'bun',
      
      // Mode production
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '127.0.0.1'
      },
      
      // Mode développement (optionnel)
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        HOSTNAME: '127.0.0.1'
      },
      
      /**
       * GESTION DES PROCESSUS
       */
      // Nombre d'instances (1 pour Next.js car il gère son propre clustering)
      instances: 1,
      
      // Mode fork (recommandé pour Next.js)
      exec_mode: 'fork',
      
      /**
       * REDÉMARRAGE AUTOMATIQUE
       */
      // Redémarrage automatique en cas de crash
      autorestart: true,
      
      // Délai avant redémarrage (ms)
      restart_delay: 5000,
      
      // Nombre maximum de redémarrages par intervalle
      max_restarts: 10,
      
      // Fenêtre temporelle pour max_restarts (secondes)
      min_uptime: '10s',
      
      /**
       * MÉMOIRE
       */
      // Limite de mémoire avant redémarrage automatique (500MB)
      max_memory_restart: '500M',
      
      /**
       * LOGS
       */
      // Fichier de log de sortie
      out_file: '/var/www/plagiatia/logs/pm2-out.log',
      
      // Fichier d'erreur
      error_file: '/var/www/plagiatia/logs/pm2-error.log',
      
      // Fusion des logs au lieu de séparer par ID
      merge_logs: true,
      
      // Format des dates dans les logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Taille maximale des fichiers de log (10MB)
      log_file_size: '10M',
      
      // Rotation automatique des logs
      // Nécessite: pm2 install pm2-logrotate
      
      /**
       * OPTIMISATIONS
       */
      // Augmenter la limite de listeners (EventEmitter warning)
      node_args: '--max-old-space-size=512 --enable-source-maps',
    }
  ],
  
  /**
   * ========================================================================
   * DÉPLOIEMENT (Optionnel - pour déploiement via pm2 deploy)
   * ========================================================================
   * 
   * Pour utiliser le déploiement PM2:
   * 1. Configurer les infos ci-dessous
   * 2. Exécuter: pm2 deploy ecosystem.config.js production setup
   * 3. Ensuite: pm2 deploy ecosystem.config.js production
   */
  
  deploy: {
    production: {
      user: 'www-data',
      host: '95.111.226.63',
      ref: 'origin/main',
      repo: 'https://github.com/AlterEgo095/DPATA.git',
      path: '/var/www/plagiatia',
      'pre-deploy': 'git fetch origin all',
      'post-deploy': 
        'cp .env.production .env.local && ' +
        'bun install && ' +
        'bun run db:push && ' +
        'bun run build && ' +
        'pm2 reload ecosystem.config.js --env production',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};
