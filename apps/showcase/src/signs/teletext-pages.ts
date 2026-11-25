import {
  teletextMosaic,
  type TeletextColor,
  type TeletextPage,
  type TeletextRow,
  type TeletextSpan,
} from "@/components/ui/teletext-page"

const text = (value: string, fg: TeletextColor = "white", bg?: TeletextColor): TeletextSpan => ({
  text: value,
  fg,
  ...(bg ? { bg } : {}),
})

const padded = (value: string, width = 40) => value.padEnd(width).slice(0, width)

const banner = (title: string, fg: TeletextColor, bg: TeletextColor): TeletextRow => ({
  spans: [text(padded(` ${title}`), fg, bg)],
  doubleHeight: true,
  heading: true,
})

const blank: TeletextRow = [text("")]

const sun = teletextMosaic([
  "      ####      ",
  "    ########    ",
  "   ##########   ",
  "  ############  ",
  "  ############  ",
  "  ############  ",
  "   ##########   ",
  "    ########    ",
  "      ####      ",
])

const cloud = teletextMosaic([
  "     ######         ",
  "   ##########  ##   ",
  "  ################# ",
  " ###################",
  " ###################",
  "  ################# ",
])

const stripe = teletextMosaic(["#".repeat(80), "#".repeat(80), "#".repeat(80)])[0]!

const fastext = {
  red: { page: 101, label: "Headlines" },
  green: { page: 400, label: "Weather" },
  yellow: { page: 600, label: "TV guide" },
  blue: { page: 100, label: "Index" },
}

const index: TeletextPage = {
  title: "Index",
  rows: [
    banner("ESKAIS TEXT          INDEX", "yellow", "blue"),
    blank,
    [{ mosaic: stripe, fg: "cyan" }],
    [text(" NEWS"), text("                              ")],
    [text(" Headlines .................. ", "cyan"), text("101", "yellow")],
    [text(" Town and country ........... ", "cyan"), text("102", "yellow")],
    [text(" Markets .................... ", "cyan"), text("120", "yellow")],
    blank,
    [text(" WEATHER")],
    [text(" Today and tomorrow ......... ", "green"), text("400", "yellow")],
    blank,
    [text(" TELEVISION")],
    [text(" Tonight on channel one ..... ", "magenta"), text("600", "yellow")],
    blank,
    [{ mosaic: stripe, fg: "cyan" }],
    [text(" Type three digits to choose a page.", "white")],
    [text(" Coloured keys follow the bottom row.", "white")],
    blank,
    [text(" All stories and listings are fictional.", "green")],
  ],
  fastext,
}

const headline = (title: string, lines: string[]): TeletextRow[] => [
  banner("ESKAIS TEXT       HEADLINES", "white", "blue"),
  blank,
  [text(` ${title}`, "yellow")],
  blank,
  ...lines.map((line): TeletextRow => [text(` ${line}`)]),
]

const headlines: TeletextPage = {
  title: "Headlines",
  subpages: [
    headline("HARBOUR BRIDGE REOPENS AFTER REPAIRS", [
      "The swing bridge over Kestrel Harbour",
      "opened to traffic again this morning",
      "after eleven weeks of repairs to its",
      "old turning gear.",
      "",
      "Engineers said the 1920s mechanism",
      "now turns in under four minutes.",
      "",
      "Ferries return to the summer timetable",
      "from Monday.",
    ]),
    headline("LIBRARY KEEPS LATE HOURS ALL WINTER", [
      "Millbrook's central library will stay",
      "open until ten every weekday until",
      "the end of March.",
      "",
      "The council said evening visits rose",
      "by a third during the autumn trial.",
    ]),
    headline("ORCHARD FESTIVAL DRAWS RECORD CROWD", [
      "More than 12,000 people visited the",
      "Ashby Vale apple festival, where the",
      "longest peel ran to 4.2 metres.",
    ]),
  ],
  fastext,
}

const towns: [string, number, TeletextColor][] = [
  ["Kestrel Harbour", 12, "cyan"],
  ["Millbrook", 14, "green"],
  ["Ashby Vale", 9, "cyan"],
  ["High Fen", 7, "cyan"],
  ["Stonecross", 15, "yellow"],
]

const weather: TeletextPage = {
  title: "Weather",
  rows: [
    banner("ESKAIS TEXT         WEATHER", "black", "cyan"),
    blank,
    [text(padded(" TODAY", 26), "yellow"), { mosaic: sun[0]!, fg: "yellow" }],
    [text(padded(" Bright, light winds", 26)), { mosaic: sun[1]!, fg: "yellow" }],
    [text(padded(" from the west.", 26)), { mosaic: sun[2]!, fg: "yellow" }],
    blank,
    [text(padded(" TOMORROW", 26), "yellow"), { mosaic: cloud[0]!, fg: "white" }],
    [text(padded(" Cloud from the north,", 26)), { mosaic: cloud[1]!, fg: "white" }],
    [text(" a little rain later.")],
    blank,
    [text(" TOWN                 MAX  ", "cyan"), text("C", "cyan")],
    ...towns.map(([town, max, colour]): TeletextRow => [
      text(` ${town.padEnd(21)}`),
      text(String(max).padStart(3), colour),
    ]),
    blank,
    [text(" Frost likely on high ground tonight.", "yellow")],
    [text(" WARNING", "red"), text(" ice on untreated roads", "white"), { text: " !", fg: "red", flash: true }],
  ],
  fastext,
}

const listings: [string, string, string][] = [
  ["1800", "Six O'Clock Local", "news"],
  ["1830", "The Long Allotment", "gardening"],
  ["1900", "Quiz of the Week", "quiz"],
  ["1930", "Harbour Lights", "drama, part 3"],
  ["2030", "Night Sky Guide", "astronomy"],
  ["2100", "Film: The Lantern", "1958"],
  ["2245", "Late Weather", ""],
  ["2250", "Closedown", ""],
]

const tvGuide: TeletextPage = {
  title: "TV guide",
  rows: [
    banner("ESKAIS TEXT        TONIGHT", "yellow", "magenta"),
    blank,
    [text(" CHANNEL ONE", "cyan"), text("               Thursday", "white")],
    blank,
    ...listings.flatMap(([time, title, note]): TeletextRow[] => [
      [text(` ${time} `, "yellow"), text(title.padEnd(20)), text(note, "cyan")],
    ]),
    blank,
    [text(" Subtitles on 888", "green")],
  ],
  fastext,
}

const teletextDemoPages: Record<number, TeletextPage> = {
  100: index,
  101: headlines,
  400: weather,
  600: tvGuide,
}

export { teletextDemoPages }
