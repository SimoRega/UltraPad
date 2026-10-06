export type DesktopOAuthResult = { code?: string; error?: string };
declare global {
  interface Window {
    ultrapadDesktop?: {
      platform: string;
      prepareOAuth(): Promise<{ redirectTo: string }>;
      openOAuth(url: string): Promise<void>;
      cancelOAuth(): Promise<void>;
      onOAuthResult(callback: (result: DesktopOAuthResult) => void): () => void;
    };
  }
}
export const desktop = window.ultrapadDesktop;
