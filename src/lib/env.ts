// Environment configuration with validation
// 🔒 SÉCURITÉ: Validation stricte des variables d'environnement en production

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
    environment: getEnvVar('NODE_ENV', 'development'),
  },
  auth: {
    // 🔒 SÉCURITÉ: En production, ces valeurs doivent être configurées via variables d'environnement
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

/**
 * Validate critical security configuration
 * Returns array of warnings/errors
 * In production, should be called at startup and fail hard on critical issues
 */
export function validateConfig(): { errors: string[]; warnings: string[]; isProductionReady: boolean } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const isProduction = config.app.environment === 'production';
  
  // 🔴 CRITIQUE: JWT Secret
  if (config.auth.jwtSecret === 'dpata-jwt-secret-change-in-production-2024') {
    const msg = 'CRITICAL: Using default JWT secret. Set JWT_SECRET env variable immediately!';
    if (isProduction) {
      errors.push(msg);
    } else {
      warnings.push(`DEV MODE: ${msg}`);
    }
  }
  
  // 🔴 CRITIQUE: Password Salt
  if (config.auth.passwordSalt === 'dpata-salt-2024-secure') {
    const msg = 'CRITICAL: Using default password salt. Set PASSWORD_SALT env variable immediately!';
    if (isProduction) {
      errors.push(msg);
    } else {
      warnings.push(`DEV MODE: ${msg}`);
    }
  }
  
  // 🟡 AVERTISSEMENT: CORS trop permissif en production
  if (isProduction && config.security.corsOrigins.includes('*')) {
    warnings.push('SECURITY: CORS is set to *. Restrict to specific origins in production.');
  }
  
  // 🟡 AVERTISSEMENT: Vérifier la complexité du secret JWT
  if (config.auth.jwtSecret.length < 32) {
    warnings.push('SECURITY: JWT_SECRET should be at least 32 characters for adequate entropy.');
  }
  
  // 🟢 INFO: Configuration base de données
  if (config.database.path.startsWith('./') && isProduction) {
    warnings.push('PERFORMANCE: Using relative database path. Consider absolute path in production.');
  }
  
  return {
    errors,
    warnings,
    isProductionReady: errors.length === 0,
  };
}

/**
 * Print security status to console at startup
 * Call this in your entry point (layout.ts or server startup)
 */
export function printSecurityStatus(): void {
  const validation = validateConfig();
  
  console.log('\n🔐 PlagiatIA - Security Status');
  console.log('━'.repeat(40));
  console.log(`Environment: ${config.app.environment.toUpperCase()}`);
  console.log(`Production Ready: ${validation.isProductionReady ? '✅ YES' : '❌ NO'}`);
  
  if (validation.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    validation.warnings.forEach(w => console.log(`   - ${w}`));
  }
  
  if (validation.errors.length > 0) {
    console.log('\n🚨 CRITICAL ERRORS:');
    validation.errors.forEach(e => console.log(`   - ${e}`));
    console.log('\n❌ Server CANNOT start in production with these errors.');
    
    if (config.app.environment === 'production') {
      throw new Error('Critical security configuration errors. Fix before starting server.');
    }
  }
  
  console.log('━'.repeat(40) + '\n');
}
