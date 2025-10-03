declare module 'ebay-oauth-nodejs-client' {
  export class EbayAuthToken {
    constructor(options: {
      clientId: string;
      clientSecret: string;
      env?: string;
      redirectUri?: string;
    });

    generateUserAuthorizationUrl(environment: string, scopes: string[]): string;
    exchangeCodeForAccessToken(environment: string, code: string): Promise<string>;
    getAccessToken(environment: string, refreshToken: string): Promise<string>;
  }

  export default EbayAuthToken;
} 