\ Copyright (c) 2023 Travis Bemann
\ 
\ Permission is hereby granted, free of charge, to any person obtaining a copy
\ of this software and associated documentation files (the "Software"), to deal
\ in the Software without restriction, including without limitation the rights
\ to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
\ copies of the Software, and to permit persons to whom the Software is
\ furnished to do so, subject to the following conditions:
\ 
\ The above copyright notice and this permission notice shall be included in
\ all copies or substantial portions of the Software.
\ 
\ THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
\ IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
\ FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
\ AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
\ LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
\ OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
\ SOFTWARE.

begin-module multitask-blinky

  led import
  task import

  \ Is there a running blinky task?
  false value blinky-flag

  \ The blinky task
  0 value blinky-task

  \ Our blinky exit exception
  : x-exit-blinky ( -- ) ;
  
  \ Do the actual blinking
  : do-blink ( -- )
    [:
      begin
        blinky-flag if 0 toggle-led 500 ms else pause then
      again
    ;] try dup ['] x-exit-blinky <> if ?raise else drop then
  ;
  
  \ Start (or restart) a blinky task
  : start-blink ( -- )
    blinky-task not if
      0 ['] do-blink 320 128 512 spawn dup to blinky-task run
    else
      0 ['] do-blink blinky-task init-task blinky-task run
    then
    true to blinky-flag
  ;

  \ Stop a blinky task
  : stop-blink ( -- )
    blinky-flag if
      false to blinky-flag
      ['] x-exit-blinky blinky-task signal
    then
  ;
  
end-module
  
multitask-blinky::start-blink
