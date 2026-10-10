type Align = 'left' | 'center' | 'right';

const ALIGN_CODES: Record<Align, number> = { left: 0, center: 1, right: 2 };

/** Builds a raw ESC/POS byte stream. Text is restricted to the printable ASCII range (0-127) —
 * most cheap thermal printers' built-in fonts don't include the ₹ glyph, so amounts should be
 * formatted as "Rs." before being passed in here. */
export class EscPosBuilder {
  private bytes: number[] = [];

  init(): this {
    this.bytes.push(0x1b, 0x40);
    return this;
  }
  align(align: Align): this {
    this.bytes.push(0x1b, 0x61, ALIGN_CODES[align]);
    return this;
  }
  bold(on: boolean): this {
    this.bytes.push(0x1b, 0x45, on ? 1 : 0);
    return this;
  }
  text(value: string): this {
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      this.bytes.push(code < 128 ? code : 0x3f);
    }
    return this;
  }
  line(value = ''): this {
    this.text(value);
    this.bytes.push(0x0a);
    return this;
  }
  divider(char = '-', width = 32): this {
    this.line(char.repeat(width));
    return this;
  }
  feed(lines = 1): this {
    for (let i = 0; i < lines; i++) this.bytes.push(0x0a);
    return this;
  }
  cut(): this {
    this.feed(3);
    this.bytes.push(0x1d, 0x56, 0x42, 0x00);
    return this;
  }
  build(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}
