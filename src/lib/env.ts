// Environment configuration with validation
function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  app: {
    name: getEnvVar('APP_NAME', 'PlagiatIA'),
    url: getEnvVar('APP_URL', 'http://localhost:3000'),
    university: getEnvVar('APP_UNIVERSITY', 'Université de Kinshasa'),
  },
  auth: {
    jwtSecret: getEnvVar('JWT_SECRET', 'dpata-jwt-secret-change-in-production-2024'),
    jwtExpiresIn: getEnvVar('JWT_EXPIRES_IN', '24h'),
    passwordSalt: getEnvVar('PASSWORD_SALT', 'dpata-salt-2024-secure'),
  },
  ia: {
    similarityThreshold: parseFloat(getEnvVar('IA_THRESHOLD', '0.20')),
    subjectThreshold: parseFloat(getEnvVar('IA_SUBJECT_THRESHOLD', '0.20')),
    model: getEnvVar('IA_MODEL', 'tfidf-cosine-v1'),
  },
  database: {
    path: getEnvVar('DB_PATH', './data/db.json'),
  },
  security: {
    maxLoginAttempts: parseInt(getEnvVar('MAX_LOGIN_ATTEMPTS', '5'), 10),
    lockoutDuration: parseInt(getEnvVar('LOCKOUT_DURATION_MS', '900000'), 10), // 15 min
    corsOrigins: getEnvVar('CORS_ORIGINS', '*').split(',').map(s => s.trim()),
  },
};

// Validate critical config on import
export function validateConfig(): string[] {
  const errors: string[] = [];
  
  if (config.auth.jwtSecret === 'dpata-jwt-secret-change-in-production-2024') {
    errors.push('WARNING: Using default JWT secret. Change JWT_SECRET in production.');
  }
  if (config.auth.passwordSalt === 'dpata-salt-2024-secure') {
    errors.push('WARNING: Using default password salt. Change PASSWORD_SALT in production.');
  }
  
  return errors;
}
