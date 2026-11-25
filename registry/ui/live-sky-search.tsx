"use client"

import { useAsyncOptions } from "@ui-sdk/react/async-options"
import { ComboboxStatus } from "@ui-sdk/react/combobox"
import { SearchIcon } from "lucide-react"
import { useRef } from "react"

import {
  Combobox,
  ComboboxClear,
  ComboboxContent,
  ComboboxControl,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import type { LiveSkyLabels } from "@/components/ui/live-sky-labels"
import type { PlaceSearcher, SkyPlace } from "@/components/ui/live-sky-weather"
import { isRecord } from "@/lib/narrow"

type PlaceOption = { value: string; label: string; detail: string }

const isPlaceOption = (item: unknown): item is PlaceOption =>
  isRecord(item) && typeof item.value === "string" && typeof item.label === "string" && typeof item.detail === "string"

const searchDebounceMs = 300
const minimumQueryLength = 2

type LiveSkySearchProps = {
  searchPlaces: PlaceSearcher
  onPlace: (place: SkyPlace) => void
  labels: LiveSkyLabels
}

/** A place search over the geocoder: debounced, stale answers dropped, each result named with its region and country. */
function LiveSkySearch({ searchPlaces, onPlace, labels }: LiveSkySearchProps) {
  const found = useRef(new Map<string, SkyPlace>())
  const places = useAsyncOptions<PlaceOption>(
    async (query, { signal }) => {
      const results = await searchPlaces(query, { signal })
      for (const place of results) found.current.set(place.id, place)
      return results.map((place) => ({
        value: place.id,
        label: place.name,
        detail: [place.region, place.country].filter(Boolean).join(", "),
      }))
    },
    { debounce: searchDebounceMs, minLength: minimumQueryLength },
  )

  return (
    <Combobox<string>
      items={places.items}
      filter={false}
      status={places.status}
      onQueryChange={(query: string) => places.setQuery(query)}
      itemToLabel={(value: string) => found.current.get(value)?.name ?? value}
      onValueChange={(value: string | null) => {
        const place = value === null ? undefined : found.current.get(value)
        if (place) onPlace(place)
      }}
    >
      <ComboboxControl data-slot="live-sky-search">
        <SearchIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <ComboboxInput aria-label={labels.search} placeholder={labels.searchPlaceholder} />
        <ComboboxClear />
      </ComboboxControl>
      <ComboboxContent>
        <ComboboxStatus className="sr-only">
          {(state) =>
            state.status === "error"
              ? labels.searchFailed
              : state.loading
                ? labels.searching
                : labels.places(state.count)
          }
        </ComboboxStatus>
        <ComboboxEmpty>
          {(state) =>
            places.status === "error"
              ? labels.searchFailed
              : state.empty && !state.loading && state.query.trim().length >= minimumQueryLength
                ? labels.noPlaces(state.query)
                : null
          }
        </ComboboxEmpty>
        <ComboboxList>
          {(state) =>
            state.items.filter(isPlaceOption).map((option) => (
              <ComboboxItem key={option.value} value={option.value} label={option.label}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{option.label}</span>
                  {option.detail ? (
                    <span className="truncate text-caption text-muted-foreground">{option.detail}</span>
                  ) : null}
                </span>
              </ComboboxItem>
            ))
          }
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export { LiveSkySearch }
