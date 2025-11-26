export default () => ({
  secrets: {
    jwt: process.env.JWT_SECRET,
  },
  app: {
    appLogoUrl:
      process.env.APP_LOGO_URL || 'https://glauk-app.vercel.app/logo.png',
    appName: process.env.APP_NAME || 'Glauk',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com',
    appBaseUrl: process.env.APP_BASE_URL || 'https://glauk-app.vercel.app',
    appClientBaseUrl:
      process.env.APP_CLIENT_BASE_URL || 'https://glauk-app.vercel.app',
    appProdBaseUrl: process.env.APP_PROD_BASE_URL || 'https://api.glauk.app',
    environment: process.env.ENV || 'development',
    appProdClientBaseUrl:
      process.env.APP_PROD_CLIENT_BASE_URL || 'https://www.glauk.app',
  },
  db: {
    prismaDbUrl: process.env.DATABASE_URL_ALT || process.env.DATABASE_URL,
  },
  mailer: {
    mailerUser: process.env.MAILER_USER,
    mailerPass: process.env.MAILER_PASS,
    mailerDefaultFrom: process.env.MAILER_DEFAULT_FROM,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
  },
  supabase: {
    url: process.env.SUPABASE_PROJECT_URL,
    projectId: process.env.SUPABASE_PROJECT_ID,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    model:
      process.env.OPEN_ROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT?.toString() || '6379'),
    password: process.env.REDIS_PASSWORD || '',
  },
});
