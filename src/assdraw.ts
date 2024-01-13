const c = 0.551915024494; // circle approximation

export default class AssDraw {
  public scale = 4;
  public text = "";

  new_event() {
    // osd_libass.c adds an event per line
    if (this.text.length > 0) {
      this.text += "\n";
    }
  }

  draw_start() {
    this.text = `${this.text}{\\p${this.scale}}`;
  }

  draw_stop() {
    this.text += "{\\p0}";
  }

  coord(x: number, y: number) {
    const scale = 2 ^ (this.scale - 1);
    const ix = Math.ceil(x * scale);
    const iy = Math.ceil(y * scale);
    this.text = `${this.text} ${ix} ${iy}`;
  }

  append(s: string) {
    this.text += s;
  }

  merge(other: AssDraw) {
    this.text += other.text;
  }

  pos(x: number, y: number) {
    this.append(`{\\pos(${x},${y})}`);
  }

  an(an: number) {
    this.append(`{\\an${an}}`);
  }

  move_to(x: number, y: number) {
    this.append(" m");
    this.coord(x, y);
  }

  line_to(x: number, y: number) {
    this.append(" l");
    this.coord(x, y);
  }

  bezier_curve(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number
  ) {
    this.append(" b");
    this.coord(x1, y1);
    this.coord(x2, y2);
    this.coord(x3, y3);
  }

  rect_ccw(x0: number, y0: number, x1: number, y1: number) {
    this.move_to(x0, y0);
    this.line_to(x0, y1);
    this.line_to(x1, y1);
    this.line_to(x1, y0);
  }

  rect_cw(x0: number, y0: number, x1: number, y1: number) {
    this.move_to(x0, y0);
    this.line_to(x1, y0);
    this.line_to(x1, y1);
    this.line_to(x0, y1);
  }

  hexagon_cw(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    r1: number,
    r2 = r1
  ) {
    this.move_to(x0 + r1, y0);
    if (x0 !== x1) {
      this.line_to(x1 - r2, y0);
    }
    this.line_to(x1, y0 + r2);
    if (x0 !== x1) {
      this.line_to(x1 - r2, y1);
    }
    this.line_to(x0 + r1, y1);
    this.line_to(x0, y0 + r1);
  }

  hexagon_ccw(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    r1: number,
    r2 = r1
  ) {
    this.move_to(x0 + r1, y0);
    this.line_to(x0, y0 + r1);
    this.line_to(x0 + r1, y1);
    if (x0 !== x1) {
      this.line_to(x1 - r2, y1);
    }
    this.line_to(x1, y0 + r2);
    if (x0 !== x1) {
      this.line_to(x1 - r2, y0);
    }
  }

  round_rect_cw(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    r1: number,
    r2 = r1
  ) {
    const c1 = c * r1; // circle approximation
    const c2 = c * r2; // circle approximation
    this.move_to(x0 + r1, y0);
    this.line_to(x1 - r2, y0); // top line
    if (r2 > 0) {
      this.bezier_curve(x1 - r2 + c2, y0, x1, y0 + r2 - c2, x1, y0 + r2); // top right corner
    }
    this.line_to(x1, y1 - r2); // right line
    if (r2 > 0) {
      this.bezier_curve(x1, y1 - r2 + c2, x1 - r2 + c2, y1, x1 - r2, y1); // bottom right corner
    }
    this.line_to(x0 + r1, y1); // bottom line
    if (r1 > 0) {
      this.bezier_curve(x0 + r1 - c1, y1, x0, y1 - r1 + c1, x0, y1 - r1); // bottom left corner
    }
    this.line_to(x0, y0 + r1); // left line
    if (r1 > 0) {
      this.bezier_curve(x0, y0 + r1 - c1, x0 + r1 - c1, y0, x0 + r1, y0); // top left corner
    }
  }

  round_rect_ccw(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    r1: number,
    r2 = r1
  ) {
    const c1 = c * r1; // circle approximation
    const c2 = c * r2; // circle approximation
    this.move_to(x0 + r1, y0);
    if (r1 > 0) {
      this.bezier_curve(x0 + r1 - c1, y0, x0, y0 + r1 - c1, x0, y0 + r1); // top left corner
    }
    this.line_to(x0, y1 - r1); // left line
    if (r1 > 0) {
      this.bezier_curve(x0, y1 - r1 + c1, x0 + r1 - c1, y1, x0 + r1, y1); // bottom left corner
    }
    this.line_to(x1 - r2, y1); // bottom line
    if (r2 > 0) {
      this.bezier_curve(x1 - r2 + c2, y1, x1, y1 - r2 + c2, x1, y1 - r2); // bottom right corner
    }
    this.line_to(x1, y0 + r2); // right line
    if (r2 > 0) {
      this.bezier_curve(x1, y0 + r2 - c2, x1 - r2 + c2, y0, x1 - r2, y0); // top right corner
    }
  }
}
