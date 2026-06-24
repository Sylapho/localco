declare module 'multer' {
  type DiskStorageFile = {
    mimetype: string
  }

  type DiskStorageRequest = {
    params: Record<string, string | undefined>
  }

  type DiskStorageCallback = (error: Error | null, value: string) => void

  export function diskStorage(options: {
    destination?: string
    filename?: (
      req: DiskStorageRequest,
      file: DiskStorageFile,
      callback: DiskStorageCallback,
    ) => void
  }): unknown
}
