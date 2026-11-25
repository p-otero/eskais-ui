import { LiveSky } from "@/components/ui/live-sky"

export default function LiveSkyDemo() {
  return (
    <div className="w-full max-w-3xl">
      <LiveSky
        label="Sky over A Coruña"
        simulate={{
          location: { latitude: 43.37, longitude: -8.4, name: "A Coruña" },
          time: Date.UTC(2026, 10, 25, 11, 0),
          weather: { weatherCode: 63, precipitation: 2.4, rain: 2.4, cloudCover: 100, windSpeed: 22, temperature: 12 },
        }}
      />
    </div>
  )
}
