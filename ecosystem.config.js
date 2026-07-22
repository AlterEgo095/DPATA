module.exports = {
  apps: [{
    name: 'plagiatia',
    script: '.next/standalone/server.js',
    cwd: '/opt/plagiatia',
    
    // Environment
    env: {
      NODE_ENV: 'production',
      PORT: 3004,
    },
    
    // Execution mode
    exec_mode: 'fork',
    instances: 1,
    
    // Stability settings
    max_memory_restart: '500M',      // Restart if memory exceeds 500MB
    min_uptime: '10000',             // Minimum uptime before considering stable
    
    // Restart strategy - AVOID CASCADE FAILURES
    max_restarts: 10,                // Max restarts before stopping (was unlimited)
    restart_delay: 3000,             // Wait 3s between restarts
    exp_backoff_restart_delay: 100,   // Exponential backoff start at 100ms
    
    // Logging with rotation
    error_file: '/opt/plagiatia/logs/pm2-error.log',
    out_file: '/opt/plagiatia/logs/pm2-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Process management
    kill_timeout: 5000,              // Graceful shutdown timeout
    wait_ready: true,                // Wait for ready signal
    listen_timeout: 10000,           // Port binding timeout
    
    // Auto-restart configuration
    autorestart: true,               // Restart on crash
    watch: false,                    // Disable watch in production
    
    // Environment-specific overrides
    env_production: {
      NODE_ENV: 'production',
    },
  }],
  
  // Deploy configuration (for future use)
  deploy: {
    production: {
      user: 'aenews',
      host: '95.111.226.63',
      ref: 'origin/main',
      repo: 'https://github.com/AlterEgo095/DPATA.git',
      path: '/opt/plagiatia',
      'pre-deploy': 'git fetch origin',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      env: {
        NODE_ENV: 'production',
      },
    },
  },
};

