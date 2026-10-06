declare module "mammoth/mammoth.browser" {
  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer },
    options: { convertImage: unknown },
  ): Promise<{ value: string; messages: { message: string }[] }>;
  export const images: {
    imgElement: (f: () => Promise<{ src: string }>) => unknown;
  };
}
