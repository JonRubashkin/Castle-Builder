// A tiny, pure SVG-path tokenizer + validator. The renderer draws each symbol's
// path via the browser's Path2D, but tests run in a DOM-less (node) environment
// and Path2D is unavailable there — so we validate "well-formedness" with this
// pure parser instead of pixel-testing. It is intentionally lenient about the
// SVG spec's finer points (implicit repeated coordinate sets are grouped under
// the same command letter, which is fine for validation) but strict enough to
// reject a garbled `d` string (unknown command, wrong argument count).

// Args required per command (lowercased). Repeats are allowed (e.g. "L x y x y").
const CMD_ARGS: Record<string, number> = {
  m: 2,
  l: 2,
  h: 1,
  v: 1,
  c: 6,
  s: 4,
  q: 4,
  t: 2,
  a: 7,
  z: 0,
};

export interface PathCommand {
  cmd: string; // the command letter as written (case preserved)
  args: number[];
}

// Parse a path `d` string into a flat command list, or return null if malformed
// (unknown command letter, an argument count that doesn't divide evenly, or a
// path that doesn't begin with a move command).
export function parsePath(d: string): PathCommand[] | null {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens || tokens.length === 0) return null;

  const commands: PathCommand[] = [];
  let cur: string | null = null;
  let nums: number[] = [];

  const flush = (): boolean => {
    if (cur === null) return true;
    const need = CMD_ARGS[cur.toLowerCase()];
    if (need === undefined) return false; // unknown command letter
    if (need === 0) {
      if (nums.length !== 0) return false; // Z takes no args
      commands.push({ cmd: cur, args: [] });
    } else {
      if (nums.length === 0 || nums.length % need !== 0) return false;
      for (let i = 0; i < nums.length; i += need) {
        commands.push({ cmd: cur, args: nums.slice(i, i + need) });
      }
    }
    nums = [];
    return true;
  };

  for (const tok of tokens) {
    if (/[a-zA-Z]/.test(tok)) {
      if (!flush()) return null;
      cur = tok;
    } else {
      if (cur === null) return null; // a number before any command
      nums.push(Number(tok));
    }
  }
  if (!flush()) return null;

  if (commands.length === 0) return null;
  const first = commands[0]!.cmd.toLowerCase();
  if (first !== "m") return null; // a path must start with a move
  return commands;
}

// A path string is well-formed if it parses.
export function isWellFormedPath(d: string): boolean {
  return parsePath(d) !== null;
}
