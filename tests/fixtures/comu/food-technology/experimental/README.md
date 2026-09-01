# Experimental golden fixture

Place the verified golden DOCX here:

`full-correct.docx`

This file represents COMU / Applied Sciences / Food Technology / Bachelor /
Experimental, verified manually as `46 PASSED / 0 FAILED / 0 NOT_APPLICABLE`.

`experimental-indentation-fail.docx`

Derived manual/runtime negative fixture with exactly one intentionally invalid
academic body first-line indentation.

`experimental-typography-fail.docx`

Derived manual/runtime negative fixture with exactly one intentionally invalid
academic body run font size.

`experimental-paragraph-format-fail.docx`

Derived manual/runtime negative fixture with exactly one intentionally invalid
academic body paragraph line spacing.

`experimental-object-alignment-fail.docx`

Derived manual/runtime negative fixture with exactly one intentionally invalid
table object alignment.

`experimental-margin-fail.docx`

Derived manual/runtime negative fixture with exactly one intentionally invalid
right page margin.

`experimental-page-number-fail.docx`

Derived manual/runtime negative fixture with exactly one intentionally invalid
footer page number alignment.

`experimental-page-sequence-fail.docx`

Derived manual/runtime negative fixture with exactly one intentionally invalid
page number restart value at the main-text section transition.

Do not regenerate or edit this binary just to satisfy the regression. A failing
golden run after a production change is evidence to investigate first.
