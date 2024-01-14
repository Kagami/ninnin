import type AssDraw from "../assdraw";
import { ArrayEntries } from "../polyfills";
import { bold } from "../utils";

// If optType is a "bool" or an "int", @value is the boolean/integer value of the option.
// Additionally, when optType is an "int":
//     - opts.step specifies the step on which the values are changed.
//     - opts.min specifies a minimum value for the option.
//     - opts.max specifies a maximum value for the option.
//     - opts.altDisplayNames is a int->string dict, which contains alternative display names
//       for certain values.
// If optType is a "list", @value is the index of the current option, inside opts.possibleValues.
// opts.possibleValues is a array in the format
// {
//		{value, displayValue}, -- Display value can be omitted.
// 		{value}
// }
// setValue will be called for the constructor argument.
// visibleCheckFn is a function to check for visibility, it can be used to hide options based on rules
export class EncOption<T, O> {
  protected value: T;
  protected opts: O;
  protected displayText: string;
  protected visibleCheckFn: (() => boolean) | null;

  constructor(
    displayText: string,
    value: T,
    opts: O,
    visibleCheckFn: (() => boolean) | null = null
  ) {
    this.displayText = displayText;
    this.opts = opts;
    this.visibleCheckFn = visibleCheckFn;
    this.value = value;
    this.setValue(value);
  }

  // Whether we have a "previous" option (for left key)
  hasPrevious() {
    return true;
  }
  // Analogous of hasPrevious.
  hasNext() {
    return true;
  }
  leftKey() {}
  rightKey() {}
  getValue() {
    return this.value;
  }
  setValue(value: T) {
    this.value = value;
  }
  getDisplayValue() {
    return "";
  }

  draw(ass: AssDraw, selected: boolean) {
    if (selected) {
      ass.append(`${bold(this.displayText)}: `);
    } else {
      ass.append(`${this.displayText}: `);
    }
    // left arrow unicode
    if (this.hasPrevious()) {
      ass.append("◀ ");
    }
    ass.append(this.getDisplayValue()!);
    // right arrow unicode
    if (this.hasNext()) {
      ass.append(" ▶");
    }
    ass.append("\\N");
  }

  // Check if this option should be visible by calling its visibleCheckFn
  optVisible() {
    if (!this.visibleCheckFn) return true;
    return this.visibleCheckFn();
  }
}

export class EncOptionBool extends EncOption<boolean, null> {
  leftKey() {
    this.value = !this.value;
  }
  rightKey() {
    this.value = !this.value;
  }
  getDisplayValue() {
    return this.value ? "yes" : "no";
  }
}

export class EncOptionInt extends EncOption<
  number,
  {
    step: number;
    min?: number;
    max?: number;
    altDisplayNames?: { [key: string]: string };
  }
> {
  hasPrevious() {
    if (this.opts.min) {
      return this.value > this.opts.min;
    } else {
      return true;
    }
  }
  hasNext() {
    if (this.opts.max) {
      return this.value < this.opts.max;
    } else {
      return true;
    }
  }
  leftKey() {
    this.value -= this.opts.step;
    if (this.opts.min && this.opts.min > this.value) {
      this.value = this.opts.min;
    }
  }
  rightKey() {
    this.value += this.opts.step;
    if (this.opts.max && this.opts.max < this.value) {
      this.value = this.opts.max;
    }
  }
  getDisplayValue() {
    if (this.opts.altDisplayNames && this.opts.altDisplayNames[this.value]) {
      return this.opts.altDisplayNames[this.value];
    } else {
      return this.value + "";
    }
  }
}

export type EncOptionListOpts<V> = ([V] | [V, string])[];

export class EncOptionList<V> extends EncOption<V, EncOptionListOpts<V>> {
  private index = 0;

  hasPrevious() {
    return this.index > 0;
  }
  hasNext() {
    return this.index < this.opts.length - 1;
  }
  leftKey() {
    if (this.index > 0) {
      this.index--;
    }
  }
  rightKey() {
    if (this.index < this.opts.length - 1) {
      this.index++;
    }
  }
  getValue() {
    return this.opts[this.index][0];
  }
  setValue(value: V) {
    let set = false;
    for (const [i, possibleValue] of ArrayEntries(this.opts)) {
      if (possibleValue[0] === value) {
        set = true;
        this.index = i;
        break;
      }
    }
    if (!set) {
      mp.msg.warn(
        `Tried to set invalid value ${value} to ${this.displayText} option.`
      );
    }
  }
  getDisplayValue() {
    return this.opts[this.index][1] || this.opts[this.index][0] + "";
  }
}
