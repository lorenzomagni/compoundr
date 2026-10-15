A single-line text field with a label, optional prefix and suffix, hint and error.

**Consumer provides:** `label`, and optionally `value` with `onChange` (controlled) or `defaultValue`, `placeholder`, `prefix`, `suffix`, `hint`, `error`, `numeric`, `disabled`, `type`.

- Set `numeric` for prices, rates and quantities: the value is typeset in `figure-md` mono.
- Put units in `prefix` or `suffix` ("$", "%"), never in the label.
- An error is written as a reason the user can act on ("Must be below the discount rate"); the component prefixes it with "Error:" so it is not colour-only.
- The 2px `focus-ring` outline appears on the whole field when the input is focused.
