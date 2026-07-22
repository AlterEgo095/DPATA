module.exports = {
  apps: [{
    name: 'plagiatia',
    script: '.next/standalone/server.js',
    cwd: '/opt/plagiatia',
    interpreter: '/home/aenews/.bun/bin/bun',
    env: {
      NODE_ENV: 'production',
      PORT: 3004,
      HOSTNAME: '127.0.0.1',
      JWT_SECRET: 'PlagiatIA_Secret_Key_2024_Secure_JWT_Token!',
      JWT_EXPIRES_IN: '7d',
      DATABASE_URL: 'file:./db/plagiatia.db',
      NEXT_PUBLIC_APP_URL: 'https://plagiatia.aenews.net'
    },
    error_file: '/opt/plagiatia/logs/pm2-error.log',
    out_file: '/opt/plagiatia/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '500M',
    restart_delay: 4000
  }]
};
