type RegistryFile = { path: string; type: string; target?: string }
type RegistryItem = { name: string; files?: readonly RegistryFile[]; registryDependencies?: readonly string[] }
type RemovedFile = { target: string; movedTo: string[] }
type RemovedFilesReport = { item: string; itemRemoved: boolean; files: RemovedFile[] }[]

export declare function installedTarget(file: RegistryFile): string | undefined
export declare function itemName(dependency: string): string
export declare function removedFiles(
  fromItems: readonly RegistryItem[],
  toItems: readonly RegistryItem[],
): RemovedFilesReport
export declare function formatRemovedFiles(report: RemovedFilesReport): string
export declare function itemsAt(ref: string): RegistryItem[]
