# zeptocom.js

zeptocom.js is a web Forth serial terminal, which currently supports zeptoforth, Mecrisp, STM8 eForth, and ESP32Forth. It currently works with Chrome and newer versions of Chromium (even though I have got a report that Chromium does not properly handle serial ports on FreeBSD), and it should work with Opera and Edge. On all of the supported platforms it makes use of handshaking to control mass uploads of data. It also provides the option to select the newline format used by the terminal, which defaults to CRLF on zeptoforth and ESP32Forth and to LF on Mecrisp and STM8 eForth.

zeptocom.js provides edit areas in which one can edit and append code for upload, either as wholes or (when selected) as parts to the target. It supports multiple tabs, so one can have multiple edit areas at once; note that the edit area related functionality always applies to the current edit area. It also supports expanding any `#include` lines in an edit area within the edit area itself.

zeptocom.js provides a history mechanism for use with line input; this can be accessed with both the up and down arrows within the line input as well as a drop down menu at the right-hand side of the line input. It also supports history completion within the line input; this is carried out by use of the tab key within the line input, which completes the word being entered to the shortest word equal to or greater in length to the word being entered or, or if multiple longer words exist, the shortest common substring.

zeptocom.js provides the option to strip any uploaded data to the target of initial whitespace, blank lines, and line comments to speed up upload. Note that it does not strip `(` or `)` comments or `\\` comments after any non-whitespace content due to the complexities of mixing such with strings, where such should not be stripped out.

zeptocom.js provides the ability to `#include` content that is uploaded by any means, whether from the REPL line, from a file, from an edit area, or from another included file. This also applies when expanding content within an edit area. Note that the path of an included file will be relative to the current working directory, and if none is set the user will be prompted to select one.

zeptocom.js provides the capability to automatically replace *symbols* in uploaded content and content expanded within an edit area. Symbol files, which are specified either via the global symbol file or via `#symbols` lines within uploaded or expanded content. Symbol files have a file format shown by the following, for example:

    \ Here are some symbols for the STM32F407
    
    RCC_Base $40023800
    RCC_APB1ENR $40023840
    RCC_APB2ENR $40023844
    RCC_APB1LPENR $40023860
    RCC_APB2LPENR $40023864
    RCC_APB1ENR_USART2EN 17 bit
    RCC_APB1ENR_USART3EN 18 bit
    RCC_APB1ENR_UART4EN 19 bit
    RCC_APB1ENR_UART5EN 20 bit
    RCC_APB2ENR_USART1EN 4 bit
    RCC_APB2ENR_USART6EN 5 bit
    RCC_APB1LPENR_USART2LPEN  17 bit
    RCC_APB1LPENR_USART3LPEN 18 bit
    RCC_APB1LPENR_UART4LPEN 19 bit
    RCC_APB1LPENR_UART5LPEN 20 bit
    RCC_APB2LPENR_USART1LPEN 4 bit
    RCC_APB2LPENR_USART6LPEN 5 bit

`\` by itself specifies a comment, blank lines and whitespace are ignored (except within a symbol mapping's value), and symbol mappings are defined by a symbol separated by whitespace from a symbol mapping's value. If a symbol file containig the above is loaded, the following:

    RCC_APB2ENR_USART1EN RCC_APB2ENR bis!

will expand automatically to:

    4 bit $40023844 bis!

on uploading.

Note that symbols defined this way do not take up precious dictionary space on the target, so are useful for things such as, say, defining the mappings for the entire CMSIS for a target, for which there certainly would not be enough space for such to be loaded on-target.

Note that `#symbols` can be used like `#include` to define local symbols within content being uploaded, or within individual included files, that override the global symbols. Also ntoe that symbol files can themselves include files; one could use `#symbols` within them, but there lies dragons as one would be replacing content within the symbols file itself.
