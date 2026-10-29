const GLYPHS: Record<string, string[]> = {
  " ": ["     ", "     ", "     ", "     ", "     "],
  "'": ["  #  ", "  #  ", "     ", "     ", "     "],
  ",": ["     ", "     ", "     ", "  ## ", "  #  "],
  A: [" ### ", "#   #", "#####", "#   #", "#   #"],
  E: ["#####", "#    ", "#### ", "#    ", "#####"],
  H: ["#   #", "#   #", "#####", "#   #", "#   #"],
  P: ["#### ", "#   #", "#### ", "#    ", "#    "],
  S: [" ####", "#    ", " ### ", "    #", "#### "],
  T: ["#####", "  #  ", "  #  ", "  #  ", "  #  "],
  U: ["#   #", "#   #", "#   #", "#   #", " ### "],
  W: ["#   #", "#   #", "# # #", "# # #", " # # "],
  Y: ["#   #", " # # ", "  #  ", "  #  ", "  #  "],
  "?": [" ### ", "#   #", "  ## ", "     ", "  #  "],
};

const GREETING_LINES = ["HEY,", "WHAT'S UP?"];

export const renderAsciiGreeting = () =>
  GREETING_LINES.map((line) => {
    const glyphs = Array.from(line, (character) => GLYPHS[character] ?? GLYPHS[" "]);
    return Array.from({ length: 5 }, (_, row) =>
      glyphs
        .map((glyph) => glyph[row])
        .join("  ")
        .trimEnd(),
    ).join("\n");
  }).join("\n\n");
