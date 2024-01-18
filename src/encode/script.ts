export interface Stats {
  timePos: number;
}

function getStats(): Stats {
  const timePos = mp.get_property_number("time-pos", 0);
  return { timePos };
}

/** Report encoding info back to main script during encoding. */
export function mainEncoding(logPath: string) {
  setInterval(function () {
    const stats = JSON.stringify(getStats());
    mp.utils.write_file("file://" + logPath, stats);
  }, 500);
}
