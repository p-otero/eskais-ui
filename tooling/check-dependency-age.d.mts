export declare const minimumAgeDays: number
export declare const youngDependencyExceptions: Readonly<Record<string, string>>
export declare const caretRangeDependencies: readonly string[]
export declare function parseDependency(spec: string): { name: string; version: string | undefined }
export declare function registryDependencies(registry: {
  items: readonly { dependencies?: readonly string[]; devDependencies?: readonly string[] }[]
}): string[]
export declare function findYoungDependencies(
  specs: readonly string[],
  published: ReadonlyMap<string, string>,
  now: number,
  options?: { minimumDays?: number; exceptions?: Readonly<Record<string, string>>; ranges?: readonly string[] },
): { problems: { spec: string; reason: string }[]; matured: string[] }
