// Compiled alone by test/server-data-types.test.ts: the augmentation below would change every file's error type.
import { expectTypeOf } from "vitest"

import type { DefaultServerError } from "@/components/ui/server-data"
import type {
  ServerInfiniteState,
  ServerPageState,
  SourceMutationOptions,
  SourceMutationState,
} from "@/components/ui/use-server-data"
import type { ServerQueryState, useServerQuery } from "@/components/ui/use-server-query"

class ApiError extends Error {
  readonly status = 500
}

declare module "@tanstack/react-query" {
  interface Register {
    defaultError: ApiError
  }
}

expectTypeOf<DefaultServerError>().toEqualTypeOf<ApiError>()
expectTypeOf<ReturnType<typeof useServerQuery<string>>["error"]>().toEqualTypeOf<ApiError | null>()
expectTypeOf<ServerQueryState<string>["error"]>().toEqualTypeOf<ApiError | null>()
expectTypeOf<ServerPageState<string>["error"]>().toEqualTypeOf<ApiError | null>()
expectTypeOf<ServerInfiniteState<string>["error"]>().toEqualTypeOf<ApiError | null>()
expectTypeOf<SourceMutationState<void, string>["error"]>().toEqualTypeOf<ApiError | null>()
expectTypeOf<
  Parameters<NonNullable<SourceMutationOptions<string, void, string>["onError"]>>[0]
>().toEqualTypeOf<ApiError>()
expectTypeOf<ReturnType<typeof useServerQuery<string, TypeError>>["error"]>().toEqualTypeOf<TypeError | null>()
