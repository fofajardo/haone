export interface BrandingProfile {
  name: string;
  shortName: string;
  logoUrl: string;
  logoUrlDark: string;
  logoAlt: string;
  letterheadUrl: string;
  issuerName: string;
  emailHeaderUrl: string;
  googleClientId: string;
  replyTo: string;
  spreadsheetId: string;
}

export interface EmailTemplate<T> {
  subject: (data: T, branding: BrandingProfile) => string;
  generateHtml: (data: T, branding: BrandingProfile) => string;
}
